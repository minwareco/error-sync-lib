import { Alert, AlertContent, CacheName, Error, ErrorGroup, ErrorPriority, Ticket, TicketContent } from './models';
import { AlertProviderInterface, CacheProviderInterface, ErrorProviderInterface, TicketProviderInterface } from './interfaces';

const crypto = require('crypto');

export type SynchronizerError = {
  message: string,
  errorGroup?: ErrorGroup,
}

export type SynchronizerResult = {
  completedErrorGroups: ErrorGroup[],
  errors: SynchronizerError[],
  exitCode: number,
}

export type SynchronizerConfig = {
  serverErrorProvider?: ErrorProviderInterface,
  clientErrorProvider?: ErrorProviderInterface,
  ticketProvider: TicketProviderInterface,
  alertProvider: AlertProviderInterface,
  cacheProvider: CacheProviderInterface,
}

export class Synchronizer {
  private config: SynchronizerConfig;

  public constructor(config: SynchronizerConfig) {
    this.config = config;
  }

  public async run(): Promise<SynchronizerResult> {
    let result: SynchronizerResult = {
      completedErrorGroups: [],
      errors: [],
      exitCode: 0
    };

    try {
      const errors = await this.config.serverErrorProvider.getErrors(24, 1000);
      const errorGroups: ErrorGroup[] = [];

      // build up the error groups from raw errors, which drive all downstream work
      errors.forEach((error) => this.addToErrorGroups(error, errorGroups));

      // for each error group, create / update a ticket and alert as needed. in most cases, no work
      // is done because the ticket + alert has already been created and does not need to be updated.
      for (const errorGroup of errorGroups) {
        try {
          this.syncErrorGroup(errorGroup);
          result.completedErrorGroups.push(errorGroup);
        } catch (e) {
          result.errors.push({
            message: e.message || e,
            errorGroup,
          });

          console.error('Failed to synchronize an error into the ticketing and/or alerting system.');
          console.error(`The relevant error is named "${errorGroup.name}"`);
          console.error('The exception which occurred is:', e);
        }
      }

      // persist all cached data changes
      this.config.cacheProvider.saveAllCaches();
    } catch (e) {
      result.exitCode = 1;
      result.errors.push({
        message: e.message || e,
      });

      console.error(e);
    }

    if (result.errors.length > 0) {
      console.error('Some errors were not synchronized to the ticketing and/or alerting system. Please see errors above.');
      result.exitCode = 2;
    }

    return result;
  }

  private async syncErrorGroup(errorGroup: ErrorGroup) {
    errorGroup.priority = this.determineErrorPriority(errorGroup);
    errorGroup.ticket = await this.config.cacheProvider.getObject(errorGroup.clientId, CacheName.Tickets);
    errorGroup.alert = await this.config.cacheProvider.getObject(errorGroup.clientId, CacheName.Alerts);

    // if our ticket cache does not know about the error, then we search in the source-of-truth
    // ticketing system. if it is not there either, then we will end up creating a new ticket.
    if (!errorGroup.ticket) {
      errorGroup.ticket = await this.config.ticketProvider.findTicket(errorGroup.clientId);
    }

    const freshTicketContent = await this.config.ticketProvider.generateTicketContent(errorGroup);
    const freshAlertContent = await this.config.alertProvider.generateAlertContent(errorGroup);
    let isTicketReopened = false;

    // create / update ticket
    if (!errorGroup.ticket) {
      errorGroup.ticket = await this.config.ticketProvider.createTicket(freshTicketContent);
      freshAlertContent.ticketUrl = errorGroup.ticket.url;
    } else if (this.doesTicketNeedUpdate(errorGroup.ticket, freshTicketContent)) {
      Object.assign(errorGroup.ticket, freshTicketContent);
      errorGroup.ticket = await this.config.ticketProvider.updateTicket(errorGroup.ticket);
    }

    // if the ticket is closed and meets certain conditions, then reopen it
    if (this.doesTicketNeedReopening(errorGroup.ticket)) {
      errorGroup.ticket = await this.config.ticketProvider.reopenTicket(errorGroup.ticket);
      isTicketReopened = true;
    }

    this.config.cacheProvider.setObject(errorGroup.ticket.id, errorGroup.ticket, CacheName.Tickets, false);

    // if our alert cache does not know about the error, then we search in the source-of-truth
    // alert system. if it is not there either, then we will end up creating a new alert.
    if (!errorGroup.alert) {
      errorGroup.alert = await this.config.alertProvider.findAlert(errorGroup.clientId);
    }

    // create / update alert
    if (!errorGroup.alert) {
      errorGroup.alert = await this.config.alertProvider.createAlert(freshAlertContent);
    } else if (isTicketReopened || this.doesAlertNeedUpdate(errorGroup.alert, freshAlertContent)) {
      Object.assign(errorGroup.alert, freshAlertContent);
      errorGroup.alert = await this.config.alertProvider.updateAlert(errorGroup.alert);
    }

    this.config.cacheProvider.setObject(errorGroup.alert.id, errorGroup.alert, CacheName.Alerts, false);
  }

  private createErrorGroup(error: Error): ErrorGroup {
    // truncate the error to the first 500 characters
    const maxNameLength = 500;
    if (error.name.length > maxNameLength) {
      error.name = error.name.substr(0, maxNameLength);
    }

    // wipe out line numbers
    let normalizedName = error.name;
    normalizedName = normalizedName.replace(/\.(php|js|jsx|ts|tsx|py|go|java)[:@]\d+/i, '.$1:XXX');

    // remove TypeError prefix from client errors that some browsers may emit
    normalizedName = normalizedName.replace(/(TypeError:\s*)/i, '');

    // generate clientId from the normalized name
    const hash = crypto.createHash('md5').update(normalizedName).digest('hex');

    return {
      name: normalizedName,
      type: error.type,
      priority: ErrorPriority.P5,
      clientId: hash,
      count: error.count,
      countType: error.countType,
      ticket: null,
      alert: null,
      instances: [error],
    };
  }

  private addToErrorGroups(error: Error, errorGroups: ErrorGroup[]) {
    const newErrorGroup = this.createErrorGroup(error);

    for (let i = 0; i < errorGroups.length; ++i) {
      const existingErrorGroup = errorGroups[i];

      // if we have already seen this error, tack it onto the existing group as another instance
      if (newErrorGroup.name === existingErrorGroup.name) {
        existingErrorGroup.instances.push(error);
        return;
      }
    }

    // we have not seen this error before, so add it to the root array
    errorGroups.push(newErrorGroup);
  }

  private doesTicketNeedReopening(existingTicket: Ticket): boolean {
    if (existingTicket.isOpen) {
      return false;
    }

    // only re-open if the ticket has been closed for 24 hours
    const currentDate = new Date();
    const resolutionDate = new Date(existingTicket.resolutionDate);
    const diffSeconds = (currentDate.getTime() - resolutionDate.getTime()) / 1000;
    return (diffSeconds >= (60 * 60 * 24));
  }

  private doesTicketNeedUpdate(existingTicket: Ticket, freshTicketContent: TicketContent): boolean {
    return existingTicket.summary !== freshTicketContent.summary ||
      existingTicket.description !== freshTicketContent.description ||
      existingTicket.priority !== freshTicketContent.priority;
  }

  private doesAlertNeedUpdate(existingAlert: Alert, freshAlertContent: AlertContent): boolean {
    return existingAlert.summary !== freshAlertContent.summary ||
      existingAlert.description !== freshAlertContent.description ||
      existingAlert.priority !== freshAlertContent.priority ||
      existingAlert.ticketUrl !== freshAlertContent.ticketUrl;
  }

  private determineErrorPriority(errorGroup: ErrorGroup): ErrorPriority {
    return ErrorPriority.P5; // TODO
  }
}

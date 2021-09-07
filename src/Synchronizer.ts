import { Alert, AlertContent, CacheName, Error, ErrorGroup, ErrorPriority, Ticket, TicketContent } from './models';
import {
  AlertProviderInterface,
  CacheProviderInterface,
  ErrorProviderInterface,
  PrioritizationProviderInterface,
  TicketProviderInterface
} from './interfaces';
import { ErrorCountPrioritizationProvider } from "./providers";

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

export type SynchronizerErrorProviderConfig = {
  name: string,
  provider: ErrorProviderInterface,
  prioritizationProvider?: PrioritizationProviderInterface,
  lookbackHours?: number,
  maxErrors?: number,
}

export type SynchronizerConfig = {
  errors: SynchronizerErrorProviderConfig[],
  ticketProvider: TicketProviderInterface,
  alertProvider: AlertProviderInterface,
  cacheProvider: CacheProviderInterface,
}

export class Synchronizer {
  private config: SynchronizerConfig;

  public constructor(config: SynchronizerConfig) {
    this.config = config;

    // validate config
    if (this.config.errors.length === 0) {
      throw new Error('There must be at least one error provider set in the configuration');
    }

    // apply defaults for anything which is not set
    for (let provider of this.config.errors) {
      provider.lookbackHours ??= 24;
      provider.maxErrors ??= 1000;
      provider.prioritizationProvider ??= new ErrorCountPrioritizationProvider();
    }
  }

  public async run(): Promise<SynchronizerResult> {
    let finalResult: SynchronizerResult = {
      completedErrorGroups: [],
      errors: [],
      exitCode: 0
    };

    // run all error provider synchronizations in parallel
    try {
      const errorPromises = this.config.errors.map(async (errorConfig) => {
        try {
          this.runForErrorProvider(errorConfig, finalResult);
        } catch (e) {
          finalResult.exitCode = 1;
          finalResult.errors.push({
            message: e.message || e,
          });

          console.error(e);
        }
      });

      // check for any promise rejections from our error provider synchronizations
      const providerResults = await Promise.allSettled(errorPromises);
      for (const [index, providerResult] of providerResults.entries()) {
        if (providerResult.status === 'rejected') {
          const providerName = this.config.errors[index].name;
          console.error('An unexpected exception occurred while trying to synchronize errors for the ' +
            `provider named "${providerName}":`, providerResult.reason);
          finalResult.exitCode = 2;
          finalResult.errors.push({
            message: providerResult.reason.message || providerResult.reason,
          });
        }
      }
    } catch (e) {
      finalResult.exitCode = 3;
      finalResult.errors.push({
        message: e.message || e,
      });

      console.error('An unexpected exception occurred while running the error synchronizations', e);
    }

    // persist all cached data changes
    try {
      this.config.cacheProvider.saveAllCaches();
    } catch (e) {
      finalResult.exitCode = 4;
      finalResult.errors.push({
        message: e.message || e,
      });

      console.error('An unexpected exception occurred while running the error synchronizations', e);
    }

    if (finalResult.errors.length > 0) {
      console.error('Some errors were not synchronized to the ticketing and/or alerting system. Please see errors above.');
      finalResult.exitCode = finalResult.exitCode || 5;
    }

    return finalResult;
  }

  private async runForErrorProvider(errorConfig: SynchronizerErrorProviderConfig, result: SynchronizerResult) {
    const errors = await errorConfig.provider.getErrors(errorConfig.lookbackHours, errorConfig.maxErrors);
    const errorGroups: ErrorGroup[] = [];

    // build up the error groups from raw errors, which drive all downstream work
    errors.forEach((error) => this.addToErrorGroups(error, errorGroups, errorConfig.name));

    // for each error group, create / update a ticket and alert as needed. in most cases, no work
    // is done because the ticket + alert has already been created and does not need to be updated.
    for (const errorGroup of errorGroups) {
      try {
        this.syncErrorGroup(errorGroup, errorConfig);
        result.completedErrorGroups.push(errorGroup);
      } catch (e) {
        result.errors.push({
          message: e.message || e,
          errorGroup,
        });

        console.error('Failed to synchronize an error into the ticketing and/or alerting system.');
        console.error(`The relevant error is named "${errorGroup.name}" from provider "${errorConfig.name}"`);
        console.error('The exception which occurred is:', e);
      }
    }
  }

  private async syncErrorGroup(errorGroup: ErrorGroup, errorConfig: SynchronizerErrorProviderConfig) {
    errorGroup.priority = await errorConfig.prioritizationProvider.determinePriority(errorGroup);
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

  private createErrorGroup(error: Error, sourceName: string): ErrorGroup {
    // truncate the error to the first 500 characters
    const maxNameLength = 500;
    error.name = `[${sourceName}] ${error.name}`.substr(0, maxNameLength);

    // wipe out line numbers
    let normalizedName = error.name;
    normalizedName = normalizedName.replace(/\.(js|jsx|ts|tsx|php|py|go|java|cpp|h|c|cs|ex|exs|rb)[:@]\d+/i, '.$1:XXX');

    // remove TypeError prefix from client errors that some browsers may emit
    normalizedName = normalizedName.replace(/(TypeError:\s*)/i, '');

    // generate clientId from the normalized name
    const hash = crypto.createHash('md5').update(normalizedName).digest('hex');

    return {
      name: normalizedName,
      sourceName,
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

  private addToErrorGroups(error: Error, errorGroups: ErrorGroup[], sourceName: string) {
    const newErrorGroup = this.createErrorGroup(error, sourceName);

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
}

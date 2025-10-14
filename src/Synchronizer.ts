import crypto from 'crypto';
import { Alert, AlertContent, CacheName, Error, ErrorGroup, ErrorPriority, Ticket, TicketContent } from './models';
import {
  AlertProviderInterface,
  CacheProviderInterface,
  ErrorProviderInterface,
  PrioritizationProviderInterface,
  TicketProviderInterface
} from './interfaces';
import { ErrorCountPrioritizationProvider, JiraTicketProvider } from "./providers";

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
    for (const provider of this.config.errors) {
      provider.lookbackHours ??= 24;
      provider.maxErrors ??= 1000;
      provider.prioritizationProvider ??= new ErrorCountPrioritizationProvider();
    }
  }

  public async run(): Promise<SynchronizerResult> {
    const finalResult: SynchronizerResult = {
      completedErrorGroups: [],
      errors: [],
      exitCode: 0
    };

    // run all error provider synchronizations in parallel
    try {
      const errorPromises = await this.config.errors.map((errorConfig) => this.runForErrorProvider(errorConfig, finalResult));

      // check for any promise rejections from our error provider synchronizations
      const providerResults = await Promise.allSettled(errorPromises);
      for (const [index, providerResult] of providerResults.entries()) {
        if (providerResult.status === 'rejected') {
          const providerName = this.config.errors[index].name;
          console.error('An exception occurred while trying to synchronize errors for the ' +
            `provider named "${providerName}":`, providerResult.reason);
          finalResult.exitCode = 1;
          finalResult.errors.push({
            message: providerResult.reason.message || providerResult.reason,
          });
        }
      }
    } catch (e) {
      finalResult.exitCode = 2;
      finalResult.errors.push({
        message: e.message || e,
      });

      console.error('An unexpected exception occurred while running the error synchronizations', e);
    }

    // persist all cached data changes
    try {
      await this.config.cacheProvider.saveAllCaches();
    } catch (e) {
      finalResult.exitCode = 3;
      finalResult.errors.push({
        message: e.message || e,
      });

      console.error('An unexpected exception occurred while running the error synchronizations', e);
    }

    if (finalResult.errors.length > 0) {
      console.error('Some errors were not synchronized to the ticketing and/or alerting system. Please see errors above.');
      finalResult.exitCode = finalResult.exitCode || 4;
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
        await this.syncErrorGroup(errorGroup, errorConfig);
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
    // determine the appropriate priority
    const { priority, priorityReason } = await errorConfig.prioritizationProvider.determinePriority(errorGroup);
    errorGroup.priority = priority;
    errorGroup.priorityReason = priorityReason;

    // read any cached version of the ticket and alert
    errorGroup.ticket = await this.config.cacheProvider.getObject(errorGroup.clientId, CacheName.Tickets);
    errorGroup.alert = await this.config.cacheProvider.getObject(errorGroup.clientId, CacheName.Alerts);

    // if our ticket cache does not know about the error, then we search in the source-of-truth
    // ticketing system. if it is not there either, then we will end up creating a new ticket.
    if (!errorGroup.ticket) {
      console.log(`Refreshing ticket from provider for ID: ${errorGroup.clientId}`);
      errorGroup.ticket = await this.config.ticketProvider.findTicket(errorGroup.clientId);
    }

    const freshTicketContent = await this.config.ticketProvider.generateTicketContent(errorGroup);
    const freshAlertContent = await this.config.alertProvider.generateAlertContent(errorGroup);
    let isTicketReopened = false;

    // create / update ticket
    if (!errorGroup.ticket) {
      console.log(`Creating new ticket for: ${errorGroup.name}`);
      errorGroup.ticket = await this.config.ticketProvider.createTicket(freshTicketContent);
      freshAlertContent.ticketUrl = errorGroup.ticket.url;
    } else if (this.doesTicketNeedUpdate(errorGroup.ticket, freshTicketContent)) {
      console.log(`Updating ticket content for ID: ${errorGroup.ticket.id}`);
      Object.assign(errorGroup.ticket, freshTicketContent);
      errorGroup.ticket = await this.config.ticketProvider.updateTicket(errorGroup.ticket);
    }
    
    const shouldIgnore = (
      errorGroup.ticket.labels.includes('ignore') ||
      errorGroup.ticket.labels.includes('wont fix')
    );

    // if the ticket is closed and meets certain conditions, then reopen it
    if (!shouldIgnore && this.doesTicketNeedReopening(errorGroup.ticket)) {
      console.log(`Reopening ticket for ID: ${errorGroup.ticket.id}`);
      errorGroup.ticket = await this.config.ticketProvider.reopenTicket(errorGroup.ticket);
      isTicketReopened = true;
    }

    await this.config.cacheProvider.setObject(errorGroup.clientId, errorGroup.ticket, CacheName.Tickets, false);

    // if our alert cache does not know about the error, then we search in the source-of-truth
    // alert system. if it is not there either, then we will end up creating a new alert.
    if (!errorGroup.alert) {
      console.log(`Refreshing alert from provider for ID: ${errorGroup.clientId}`);
      errorGroup.alert = await this.config.alertProvider.findAlert(errorGroup.clientId);
      if (!errorGroup.alert) {
        console.log(`Existing alert not found from provider for ID: ${errorGroup.clientId}`);
      }
    }

    if (shouldIgnore || !errorGroup.ticket.isOpen) {
      // if a ticket has been closed or is being ignored, then close the alert if it
      // is currently open
      if (errorGroup.alert?.status === 'open') {
        console.log(`Auto-closing alert for ID: ${errorGroup.alert.clientId}`);
        await this.config.alertProvider.closeAlert(errorGroup.alert);
        errorGroup.alert.status = 'closed';
      }
    } else if (!errorGroup.alert) {
      console.log(`Creating new alert for: ${errorGroup.name}`);
      errorGroup.alert = await this.config.alertProvider.createAlert(freshAlertContent);
    } else if (isTicketReopened || this.doesAlertNeedUpdate(errorGroup.alert, freshAlertContent)) {
      console.log(`Updating alert priority for ID: ${errorGroup.alert.clientId}`);
      if (isTicketReopened) {
        console.log('isTicketReopened: ', isTicketReopened);
      }
      console.log('Existing alert: ', errorGroup.alert);
      console.log('New alert: ', freshAlertContent);
      Object.assign(errorGroup.alert, freshAlertContent);
      await this.config.alertProvider.updateAlert(errorGroup.alert);
    }

    await this.config.cacheProvider.setObject(errorGroup.clientId, errorGroup.alert, CacheName.Alerts, false);
  }

  private createErrorGroup(error: Error, sourceName: string): ErrorGroup {
    // truncate the error to the first 500 characters
    const maxNameLength = 500;
    error.name = error.name.substr(0, maxNameLength);

    // wipe out line numbers
    let normalizedName = error.name;
    normalizedName = normalizedName.replace(/\.(js|jsx|ts|tsx|php|py|go|java|cpp|h|c|cs|ex|exs|rb)[:@]\d+/i, '.$1:XXX');

    // remove TypeError prefix from client errors that some browsers may emit
    normalizedName = normalizedName.replace(/(TypeError:\s*)/i, '');
    // trim space that might not be preserved consistently in all alter/ticket providers
    normalizedName = normalizedName.trim();

    // generate clientId from the error source name and normalized error name
    const clientIdInput = `${sourceName}:${normalizedName}`;
    const clientId = crypto.createHash('md5').update(clientIdInput).digest('hex');

    return {
      name: normalizedName,
      sourceName,
      type: error.type,
      priority: ErrorPriority.P5, // to be set later after aggregation is completed
      priorityReason: 'Unknown', // to be set later after aggregation is completed
      clientId,
      mixpanelIds: error.mixpanelIds ?? [],
      userEmails: error.userEmails ?? [],
      count: error.count,
      countType: error.countType,
      countPeriodHours: error.countPeriodHours,
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
        existingErrorGroup.mixpanelIds = Array.from(new Set([...existingErrorGroup.mixpanelIds, ...(error.mixpanelIds ?? [])]));
        existingErrorGroup.userEmails = Array.from(new Set([...existingErrorGroup.userEmails, ...(error.userEmails ?? [])]));
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
    return !JiraTicketProvider.sameTicketContent(existingTicket, freshTicketContent);
  }

  private doesAlertNeedUpdate(existingAlert: Alert, freshAlertContent: AlertContent): boolean {
    return existingAlert.summary.trim() !== freshAlertContent.summary.trim()
      || existingAlert.description.trim() !== freshAlertContent.description.trim()
      // Don't check priority at this time
      // || existingAlert.priority !== freshAlertContent.priority
      || existingAlert.ticketUrl !== freshAlertContent.ticketUrl;
  }
}

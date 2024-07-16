import { Alert, AlertContent, ErrorGroup, ErrorPriority } from '../models';
import { AlertProviderInterface } from '../interfaces';
import opsGenie from 'opsgenie-sdk';

export type OpsGenieAlertProviderConfig = {
  host: string,
  apiKey: string,
  priorityMap?: Record<string, string>,
}

export class OpsGenieAlertProvider implements AlertProviderInterface {
  private config: OpsGenieAlertProviderConfig;

  constructor(config: OpsGenieAlertProviderConfig) {
    this.config = JSON.parse(JSON.stringify(config));

    opsGenie.configure({
      api_key: this.config.apiKey,
    });

    // use default priority mappings if they are not provided
    if (!this.config.priorityMap) {
      this.config.priorityMap = {
        [ErrorPriority.P1]: 'P1',
        [ErrorPriority.P2]: 'P2',
        [ErrorPriority.P3]: 'P3',
        [ErrorPriority.P4]: 'P4',
        [ErrorPriority.P5]: 'P5',
      };
    }
  }

  public async findAlert(clientId: string): Promise<Alert|undefined> {
    const opsgenieAlert: any = await new Promise((resolve, reject) => {
      opsGenie.alertV2.get({
        identifier: clientId,
        identifierType: 'alias',
      }, (error, response) => {
        if (!error) {
          return resolve(response.data);
        } else if (error.httpStatusCode === 404) {
          return resolve(undefined);
        } else if (error instanceof Error) {
          return reject(error);
        } else {
          return reject(new Error(error.message || error));
        }
      });
    });

    if (!opsgenieAlert) {
      return undefined;
    } else {
      return {
        id: clientId,
        clientId,
        summary: opsgenieAlert.message,
        description: opsgenieAlert.description,
        priority: opsgenieAlert.priority,
        labels: [],
        ticketUrl: opsgenieAlert.details['Ticket Link'],
        status: opsgenieAlert.status,
      }
    }
  }

  public async createAlert(alertContent: AlertContent): Promise<Alert> {
    const priority = this.config.priorityMap[alertContent.priority];

    await new Promise((resolve, reject) => {
      opsGenie.alertV2.create({
        message: alertContent.summary,
        description: alertContent.description,
        alias: alertContent.clientId,
        priority: priority,
        details: {
          'Ticket Link': alertContent.ticketUrl,
        },
      }, (error, response) => {
        return (error ? reject(error) : resolve(response));
      });
    });

    return Object.assign(alertContent, {
      id: alertContent.clientId
    })
  }

  public async updateAlert(alert: Alert): Promise<Alert> {
    // an OpsGenie alert cannot be updated, so we just recreate it
    await this.closeAlert(alert);
    return await this.createAlert(alert);
  }

  public async closeAlert(alert: Alert): Promise<void> {
    await new Promise((resolve, reject) => {
      opsGenie.alertV2.close({
        identifier: alert.clientId,
        identifierType: 'alias',
      }, {
        note: `Auto-closed by error-sync-lib`,
      }, (error, response) => {
        return (error ? reject(error) : resolve(response));
      });
    });
  }

  public async generateAlertContent(errorGroup: ErrorGroup): Promise<AlertContent> {
    const summary = `[${errorGroup.type}] [${errorGroup.sourceName}] ${errorGroup.name}`.substr(0, 130).trim();

    return {
      clientId: errorGroup.clientId,
      summary,
      description: errorGroup.name,
      priority: this.config.priorityMap[errorGroup.priority],
      labels: [],
      ticketUrl: errorGroup.ticket?.url,
      status: 'open',
    }
  }
}

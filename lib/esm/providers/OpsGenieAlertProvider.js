import { ErrorPriority } from '../models';
import opsGenie from 'opsgenie-sdk';
export class OpsGenieAlertProvider {
    constructor(config) {
        this.config = JSON.parse(JSON.stringify(config));
        opsGenie.configure({
            api_key: this.config.apiKey,
        });
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
    async findAlert(clientId) {
        const opsgenieAlert = await new Promise((resolve, reject) => {
            opsGenie.alertV2.get({
                identifier: clientId,
                identifierType: 'alias',
            }, (error, response) => {
                if (!error) {
                    return resolve(response.data);
                }
                else if (error.httpStatusCode === 404) {
                    return resolve(undefined);
                }
                else if (error instanceof Error) {
                    return reject(error);
                }
                else {
                    return reject(new Error(error.message || error));
                }
            });
        });
        if (!opsgenieAlert) {
            return undefined;
        }
        else {
            return {
                id: clientId,
                clientId,
                summary: opsgenieAlert.message,
                description: opsgenieAlert.description,
                priority: opsgenieAlert.priority,
                labels: [],
                ticketUrl: opsgenieAlert.details['Ticket Link'],
                status: opsgenieAlert.status,
            };
        }
    }
    async createAlert(alertContent) {
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
        });
    }
    async updateAlert(alert) {
        await this.closeAlert(alert);
        return await this.createAlert(alert);
    }
    async closeAlert(alert) {
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
    async generateAlertContent(errorGroup) {
        var _a;
        const summary = `[${errorGroup.type}] [${errorGroup.sourceName}] ${errorGroup.name}`.substr(0, 130).trim();
        return {
            clientId: errorGroup.clientId,
            summary,
            description: errorGroup.name,
            priority: this.config.priorityMap[errorGroup.priority],
            labels: [],
            ticketUrl: (_a = errorGroup.ticket) === null || _a === void 0 ? void 0 : _a.url,
            status: 'open',
        };
    }
}
//# sourceMappingURL=OpsGenieAlertProvider.js.map
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { ErrorPriority } from '../models';
const opsgenie = require('opsgenie-sdk');
export class OpsGenieAlertProvider {
    constructor(config) {
        this.config = JSON.parse(JSON.stringify(config));
        opsgenie.configure({
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
    findAlert(clientId) {
        return __awaiter(this, void 0, void 0, function* () {
            const opsgenieAlert = yield new Promise((resolve, reject) => {
                opsgenie.alertV2.get({
                    identifier: clientId,
                    identifierType: 'alias',
                }, (error, response) => {
                    return (error ? reject(error) : resolve(response.data));
                });
            });
            return {
                id: clientId,
                clientId,
                summary: opsgenieAlert.message,
                description: opsgenieAlert.description,
                priority: opsgenieAlert.priority,
                labels: [],
                ticketUrl: opsgenieAlert.details['Ticket Link'],
            };
        });
    }
    createAlert(alertContent) {
        return __awaiter(this, void 0, void 0, function* () {
            const priority = this.config.priorityMap[alertContent.priority];
            yield new Promise((resolve, reject) => {
                opsgenie.alertV2.create({
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
        });
    }
    updateAlert(alert) {
        return __awaiter(this, void 0, void 0, function* () {
            yield new Promise((resolve, reject) => {
                opsgenie.alertV2.close({
                    identifier: alert.clientId,
                    identifierType: 'alias',
                }, (error, response) => {
                    return (error ? reject(error) : resolve(response));
                });
            });
            return this.createAlert(alert);
        });
    }
    generateAlertContent(errorGroup) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const summary = `[BUG] ${errorGroup.name}`.substr(0, 130);
            return {
                clientId: errorGroup.clientId,
                summary,
                description: errorGroup.name,
                priority: this.config.priorityMap[errorGroup.priority],
                labels: [],
                ticketUrl: (_a = errorGroup.ticket) === null || _a === void 0 ? void 0 : _a.url
            };
        });
    }
}
//# sourceMappingURL=OpsGenieAlertProvider.js.map
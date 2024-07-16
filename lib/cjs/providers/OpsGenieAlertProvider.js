"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpsGenieAlertProvider = void 0;
const models_1 = require("../models");
const opsgenie_sdk_1 = __importDefault(require("opsgenie-sdk"));
class OpsGenieAlertProvider {
    constructor(config) {
        this.config = JSON.parse(JSON.stringify(config));
        opsgenie_sdk_1.default.configure({
            api_key: this.config.apiKey,
        });
        if (!this.config.priorityMap) {
            this.config.priorityMap = {
                [models_1.ErrorPriority.P1]: 'P1',
                [models_1.ErrorPriority.P2]: 'P2',
                [models_1.ErrorPriority.P3]: 'P3',
                [models_1.ErrorPriority.P4]: 'P4',
                [models_1.ErrorPriority.P5]: 'P5',
            };
        }
    }
    findAlert(clientId) {
        return __awaiter(this, void 0, void 0, function* () {
            const opsgenieAlert = yield new Promise((resolve, reject) => {
                opsgenie_sdk_1.default.alertV2.get({
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
        });
    }
    createAlert(alertContent) {
        return __awaiter(this, void 0, void 0, function* () {
            const priority = this.config.priorityMap[alertContent.priority];
            yield new Promise((resolve, reject) => {
                opsgenie_sdk_1.default.alertV2.create({
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
            yield this.closeAlert(alert);
            return yield this.createAlert(alert);
        });
    }
    closeAlert(alert) {
        return __awaiter(this, void 0, void 0, function* () {
            yield new Promise((resolve, reject) => {
                opsgenie_sdk_1.default.alertV2.close({
                    identifier: alert.clientId,
                    identifierType: 'alias',
                }, {
                    note: `Auto-closed by error-sync-lib`,
                }, (error, response) => {
                    return (error ? reject(error) : resolve(response));
                });
            });
        });
    }
    generateAlertContent(errorGroup) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
}
exports.OpsGenieAlertProvider = OpsGenieAlertProvider;
//# sourceMappingURL=OpsGenieAlertProvider.js.map
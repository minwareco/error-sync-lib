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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Synchronizer = void 0;
const models_1 = require("./models");
const crypto = require('crypto');
class Synchronizer {
    constructor(config) {
        this.config = config;
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            let result = {
                completedErrorGroups: [],
                errors: [],
                exitCode: 0
            };
            try {
                const errors = yield this.config.serverErrorProvider.getErrors(24, 1000);
                const errorGroups = [];
                errors.forEach((error) => this.addToErrorGroups(error, errorGroups));
                for (const errorGroup of errorGroups) {
                    try {
                        this.syncErrorGroup(errorGroup);
                        result.completedErrorGroups.push(errorGroup);
                    }
                    catch (e) {
                        result.errors.push({
                            message: e.message || e,
                            errorGroup,
                        });
                        console.error('Failed to synchronize an error into the ticketing and/or alerting system.');
                        console.error(`The relevant error is named "${errorGroup.name}"`);
                        console.error('The exception which occurred is:', e);
                    }
                }
                this.config.cacheProvider.saveAllCaches();
            }
            catch (e) {
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
        });
    }
    syncErrorGroup(errorGroup) {
        return __awaiter(this, void 0, void 0, function* () {
            errorGroup.priority = this.determineErrorPriority(errorGroup);
            errorGroup.ticket = yield this.config.cacheProvider.getObject(errorGroup.clientId, models_1.CacheName.Tickets);
            errorGroup.alert = yield this.config.cacheProvider.getObject(errorGroup.clientId, models_1.CacheName.Alerts);
            if (!errorGroup.ticket) {
                errorGroup.ticket = yield this.config.ticketProvider.findTicket(errorGroup.clientId);
            }
            const freshTicketContent = yield this.config.ticketProvider.generateTicketContent(errorGroup);
            const freshAlertContent = yield this.config.alertProvider.generateAlertContent(errorGroup);
            let isTicketReopened = false;
            if (!errorGroup.ticket) {
                errorGroup.ticket = yield this.config.ticketProvider.createTicket(freshTicketContent);
                freshAlertContent.ticketUrl = errorGroup.ticket.url;
            }
            else if (this.doesTicketNeedUpdate(errorGroup.ticket, freshTicketContent)) {
                Object.assign(errorGroup.ticket, freshTicketContent);
                errorGroup.ticket = yield this.config.ticketProvider.updateTicket(errorGroup.ticket);
            }
            if (this.doesTicketNeedReopening(errorGroup.ticket)) {
                errorGroup.ticket = yield this.config.ticketProvider.reopenTicket(errorGroup.ticket);
                isTicketReopened = true;
            }
            this.config.cacheProvider.setObject(errorGroup.ticket.id, errorGroup.ticket, models_1.CacheName.Tickets, false);
            if (!errorGroup.alert) {
                errorGroup.alert = yield this.config.alertProvider.findAlert(errorGroup.clientId);
            }
            if (!errorGroup.alert) {
                errorGroup.alert = yield this.config.alertProvider.createAlert(freshAlertContent);
            }
            else if (isTicketReopened || this.doesAlertNeedUpdate(errorGroup.alert, freshAlertContent)) {
                Object.assign(errorGroup.alert, freshAlertContent);
                errorGroup.alert = yield this.config.alertProvider.updateAlert(errorGroup.alert);
            }
            this.config.cacheProvider.setObject(errorGroup.alert.id, errorGroup.alert, models_1.CacheName.Alerts, false);
        });
    }
    createErrorGroup(error) {
        const maxNameLength = 500;
        if (error.name.length > maxNameLength) {
            error.name = error.name.substr(0, maxNameLength);
        }
        let normalizedName = error.name;
        normalizedName = normalizedName.replace(/\.(php|js|jsx|ts|tsx|py|go|java)[:@]\d+/i, '.$1:XXX');
        normalizedName = normalizedName.replace(/(TypeError:\s*)/i, '');
        const hash = crypto.createHash('md5').update(normalizedName).digest('hex');
        return {
            name: normalizedName,
            type: error.type,
            priority: models_1.ErrorPriority.P5,
            clientId: hash,
            count: error.count,
            countType: error.countType,
            ticket: null,
            alert: null,
            instances: [error],
        };
    }
    addToErrorGroups(error, errorGroups) {
        const newErrorGroup = this.createErrorGroup(error);
        for (let i = 0; i < errorGroups.length; ++i) {
            const existingErrorGroup = errorGroups[i];
            if (newErrorGroup.name === existingErrorGroup.name) {
                existingErrorGroup.instances.push(error);
                return;
            }
        }
        errorGroups.push(newErrorGroup);
    }
    doesTicketNeedReopening(existingTicket) {
        if (existingTicket.isOpen) {
            return false;
        }
        const currentDate = new Date();
        const resolutionDate = new Date(existingTicket.resolutionDate);
        const diffSeconds = (currentDate.getTime() - resolutionDate.getTime()) / 1000;
        return (diffSeconds >= (60 * 60 * 24));
    }
    doesTicketNeedUpdate(existingTicket, freshTicketContent) {
        return existingTicket.summary !== freshTicketContent.summary ||
            existingTicket.description !== freshTicketContent.description ||
            existingTicket.priority !== freshTicketContent.priority;
    }
    doesAlertNeedUpdate(existingAlert, freshAlertContent) {
        return existingAlert.summary !== freshAlertContent.summary ||
            existingAlert.description !== freshAlertContent.description ||
            existingAlert.priority !== freshAlertContent.priority ||
            existingAlert.ticketUrl !== freshAlertContent.ticketUrl;
    }
    determineErrorPriority(errorGroup) {
        return models_1.ErrorPriority.P5;
    }
}
exports.Synchronizer = Synchronizer;
//# sourceMappingURL=Synchronizer.js.map
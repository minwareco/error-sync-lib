var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import crypto from 'crypto';
import { CacheName, ErrorPriority } from './models';
import { ErrorCountPrioritizationProvider } from "./providers";
export class Synchronizer {
    constructor(config) {
        var _a, _b, _c;
        this.config = config;
        if (this.config.errors.length === 0) {
            throw new Error('There must be at least one error provider set in the configuration');
        }
        for (const provider of this.config.errors) {
            (_a = provider.lookbackHours) !== null && _a !== void 0 ? _a : (provider.lookbackHours = 24);
            (_b = provider.maxErrors) !== null && _b !== void 0 ? _b : (provider.maxErrors = 1000);
            (_c = provider.prioritizationProvider) !== null && _c !== void 0 ? _c : (provider.prioritizationProvider = new ErrorCountPrioritizationProvider());
        }
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const finalResult = {
                completedErrorGroups: [],
                errors: [],
                exitCode: 0
            };
            try {
                const errorPromises = this.config.errors.map((errorConfig) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        this.runForErrorProvider(errorConfig, finalResult);
                    }
                    catch (e) {
                        finalResult.exitCode = 1;
                        finalResult.errors.push({
                            message: e.message || e,
                        });
                        console.error(e);
                    }
                }));
                const providerResults = yield Promise.allSettled(errorPromises);
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
            }
            catch (e) {
                finalResult.exitCode = 3;
                finalResult.errors.push({
                    message: e.message || e,
                });
                console.error('An unexpected exception occurred while running the error synchronizations', e);
            }
            try {
                this.config.cacheProvider.saveAllCaches();
            }
            catch (e) {
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
        });
    }
    runForErrorProvider(errorConfig, result) {
        return __awaiter(this, void 0, void 0, function* () {
            const errors = yield errorConfig.provider.getErrors(errorConfig.lookbackHours, errorConfig.maxErrors);
            const errorGroups = [];
            errors.forEach((error) => this.addToErrorGroups(error, errorGroups, errorConfig.name));
            for (const errorGroup of errorGroups) {
                try {
                    this.syncErrorGroup(errorGroup, errorConfig);
                    result.completedErrorGroups.push(errorGroup);
                }
                catch (e) {
                    result.errors.push({
                        message: e.message || e,
                        errorGroup,
                    });
                    console.error('Failed to synchronize an error into the ticketing and/or alerting system.');
                    console.error(`The relevant error is named "${errorGroup.name}" from provider "${errorConfig.name}"`);
                    console.error('The exception which occurred is:', e);
                }
            }
        });
    }
    syncErrorGroup(errorGroup, errorConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            errorGroup.priority = yield errorConfig.prioritizationProvider.determinePriority(errorGroup);
            errorGroup.ticket = yield this.config.cacheProvider.getObject(errorGroup.clientId, CacheName.Tickets);
            errorGroup.alert = yield this.config.cacheProvider.getObject(errorGroup.clientId, CacheName.Alerts);
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
            this.config.cacheProvider.setObject(errorGroup.ticket.id, errorGroup.ticket, CacheName.Tickets, false);
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
            this.config.cacheProvider.setObject(errorGroup.alert.id, errorGroup.alert, CacheName.Alerts, false);
        });
    }
    createErrorGroup(error, sourceName) {
        const maxNameLength = 500;
        error.name = `[${sourceName}] ${error.name}`.substr(0, maxNameLength);
        let normalizedName = error.name;
        normalizedName = normalizedName.replace(/\.(js|jsx|ts|tsx|php|py|go|java|cpp|h|c|cs|ex|exs|rb)[:@]\d+/i, '.$1:XXX');
        normalizedName = normalizedName.replace(/(TypeError:\s*)/i, '');
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
    addToErrorGroups(error, errorGroups, sourceName) {
        const newErrorGroup = this.createErrorGroup(error, sourceName);
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
}
//# sourceMappingURL=Synchronizer.js.map
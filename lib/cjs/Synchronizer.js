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
exports.Synchronizer = void 0;
const crypto_1 = __importDefault(require("crypto"));
const models_1 = require("./models");
const providers_1 = require("./providers");
class Synchronizer {
    constructor(config) {
        var _a, _b, _c;
        this.config = config;
        if (this.config.errors.length === 0) {
            throw new Error('There must be at least one error provider set in the configuration');
        }
        for (const provider of this.config.errors) {
            (_a = provider.lookbackHours) !== null && _a !== void 0 ? _a : (provider.lookbackHours = 24);
            (_b = provider.maxErrors) !== null && _b !== void 0 ? _b : (provider.maxErrors = 1000);
            (_c = provider.prioritizationProvider) !== null && _c !== void 0 ? _c : (provider.prioritizationProvider = new providers_1.ErrorCountPrioritizationProvider());
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
                const errorPromises = yield this.config.errors.map((errorConfig) => this.runForErrorProvider(errorConfig, finalResult));
                const providerResults = yield Promise.allSettled(errorPromises);
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
            }
            catch (e) {
                finalResult.exitCode = 2;
                finalResult.errors.push({
                    message: e.message || e,
                });
                console.error('An unexpected exception occurred while running the error synchronizations', e);
            }
            try {
                yield this.config.cacheProvider.saveAllCaches();
            }
            catch (e) {
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
        });
    }
    runForErrorProvider(errorConfig, result) {
        return __awaiter(this, void 0, void 0, function* () {
            const errors = yield errorConfig.provider.getErrors(errorConfig.lookbackHours, errorConfig.maxErrors);
            const errorGroups = [];
            errors.forEach((error) => this.addToErrorGroups(error, errorGroups, errorConfig.name));
            for (const errorGroup of errorGroups) {
                try {
                    yield this.syncErrorGroup(errorGroup, errorConfig);
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
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const { priority, priorityReason } = yield errorConfig.prioritizationProvider.determinePriority(errorGroup);
            errorGroup.priority = priority;
            errorGroup.priorityReason = priorityReason;
            errorGroup.ticket = yield this.config.cacheProvider.getObject(errorGroup.clientId, models_1.CacheName.Tickets);
            errorGroup.alert = yield this.config.cacheProvider.getObject(errorGroup.clientId, models_1.CacheName.Alerts);
            if (!errorGroup.ticket) {
                console.log(`Refreshing ticket from provider for ID: ${errorGroup.clientId}`);
                errorGroup.ticket = yield this.config.ticketProvider.findTicket(errorGroup.clientId);
            }
            const freshTicketContent = yield this.config.ticketProvider.generateTicketContent(errorGroup);
            const freshAlertContent = yield this.config.alertProvider.generateAlertContent(errorGroup);
            let isTicketReopened = false;
            if (!errorGroup.ticket) {
                console.log(`Creating new ticket for: ${errorGroup.name}`);
                errorGroup.ticket = yield this.config.ticketProvider.createTicket(freshTicketContent);
                freshAlertContent.ticketUrl = errorGroup.ticket.url;
            }
            else if (this.doesTicketNeedUpdate(errorGroup.ticket, freshTicketContent)) {
                console.log(`Updating ticket content for ID: ${errorGroup.ticket.id}`);
                Object.assign(errorGroup.ticket, freshTicketContent);
                errorGroup.ticket = yield this.config.ticketProvider.updateTicket(errorGroup.ticket);
            }
            const shouldIgnore = (errorGroup.ticket.labels.includes('ignore') ||
                errorGroup.ticket.labels.includes('wont fix'));
            if (!shouldIgnore && this.doesTicketNeedReopening(errorGroup.ticket)) {
                console.log(`Reopening ticket for ID: ${errorGroup.ticket.id}`);
                errorGroup.ticket = yield this.config.ticketProvider.reopenTicket(errorGroup.ticket);
                isTicketReopened = true;
            }
            yield this.config.cacheProvider.setObject(errorGroup.clientId, errorGroup.ticket, models_1.CacheName.Tickets, false);
            if (!errorGroup.alert) {
                console.log(`Refreshing alert from provider for ID: ${errorGroup.clientId}`);
                errorGroup.alert = yield this.config.alertProvider.findAlert(errorGroup.clientId);
            }
            if (shouldIgnore || !errorGroup.ticket.isOpen) {
                if (((_a = errorGroup.alert) === null || _a === void 0 ? void 0 : _a.status) === 'open') {
                    console.log(`Auto-closing alert for ID: ${errorGroup.alert.clientId}`);
                    yield this.config.alertProvider.closeAlert(errorGroup.alert);
                    errorGroup.alert.status = 'closed';
                }
            }
            else if (!errorGroup.alert) {
                console.log(`Creating new alert for: ${errorGroup.name}`);
                errorGroup.alert = yield this.config.alertProvider.createAlert(freshAlertContent);
            }
            else if (isTicketReopened || this.doesAlertNeedUpdate(errorGroup.alert, freshAlertContent)) {
                console.log(`Updating alert content for ID: ${errorGroup.alert.clientId}`);
                Object.assign(errorGroup.alert, freshAlertContent);
                errorGroup.alert = yield this.config.alertProvider.updateAlert(errorGroup.alert);
            }
            yield this.config.cacheProvider.setObject(errorGroup.clientId, errorGroup.alert, models_1.CacheName.Alerts, false);
        });
    }
    createErrorGroup(error, sourceName) {
        const maxNameLength = 500;
        error.name = error.name.substr(0, maxNameLength);
        let normalizedName = error.name;
        normalizedName = normalizedName.replace(/\.(js|jsx|ts|tsx|php|py|go|java|cpp|h|c|cs|ex|exs|rb)[:@]\d+/i, '.$1:XXX');
        normalizedName = normalizedName.replace(/(TypeError:\s*)/i, '');
        normalizedName = normalizedName.trim();
        const clientIdInput = `${sourceName}:${normalizedName}`;
        const clientId = crypto_1.default.createHash('md5').update(clientIdInput).digest('hex');
        return {
            name: normalizedName,
            sourceName,
            type: error.type,
            priority: models_1.ErrorPriority.P5,
            priorityReason: 'Unknown',
            clientId,
            count: error.count,
            countType: error.countType,
            countPeriodHours: error.countPeriodHours,
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
exports.Synchronizer = Synchronizer;
//# sourceMappingURL=Synchronizer.js.map
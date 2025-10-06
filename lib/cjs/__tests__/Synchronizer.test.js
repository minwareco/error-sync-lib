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
const Synchronizer_1 = require("../Synchronizer");
const models_1 = require("../models");
class MockErrorProvider {
    constructor() {
        this.errors = [];
    }
    setErrors(errors) {
        this.errors = errors;
    }
    getErrors(hoursBack, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.errors;
        });
    }
}
class MockTicketProvider {
    findTicket(clientId) {
        return __awaiter(this, void 0, void 0, function* () {
            return null;
        });
    }
    createTicket(content) {
        return __awaiter(this, void 0, void 0, function* () {
            return Object.assign(Object.assign({}, content), { id: '123', url: 'http://test.com', isOpen: true, resolutionDate: undefined });
        });
    }
    updateTicket(ticket) {
        return __awaiter(this, void 0, void 0, function* () {
            return ticket;
        });
    }
    reopenTicket(ticket) {
        return __awaiter(this, void 0, void 0, function* () {
            return ticket;
        });
    }
    generateTicketContent(errorGroup) {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                clientId: errorGroup.clientId,
                summary: 'Test',
                description: 'Test Description',
                priority: 'P3',
                labels: [],
                ticketType: 'bug'
            };
        });
    }
}
class MockAlertProvider {
    findAlert(clientId) {
        return __awaiter(this, void 0, void 0, function* () {
            return null;
        });
    }
    createAlert(content) {
        return __awaiter(this, void 0, void 0, function* () {
            return Object.assign(Object.assign({}, content), { id: '123' });
        });
    }
    updateAlert(alert) {
        return __awaiter(this, void 0, void 0, function* () {
            return alert;
        });
    }
    closeAlert(alert) {
        return __awaiter(this, void 0, void 0, function* () {
            return;
        });
    }
    generateAlertContent(errorGroup) {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                clientId: errorGroup.clientId,
                summary: 'Test Alert',
                description: 'Test Alert Description',
                priority: 'P3',
                ticketUrl: '',
                labels: [],
                status: 'open'
            };
        });
    }
}
class MockCacheProvider {
    getObject(key, cacheName) {
        return __awaiter(this, void 0, void 0, function* () {
            return null;
        });
    }
    setObject(key, value, cacheName, persist) {
        return __awaiter(this, void 0, void 0, function* () {
            return;
        });
    }
    saveAllCaches() {
        return __awaiter(this, void 0, void 0, function* () {
            return;
        });
    }
    clearAllCaches() {
        return __awaiter(this, void 0, void 0, function* () {
            return;
        });
    }
}
describe('Synchronizer', () => {
    let mockErrorProvider;
    let mockTicketProvider;
    let mockAlertProvider;
    let mockCacheProvider;
    let config;
    beforeEach(() => {
        mockErrorProvider = new MockErrorProvider();
        mockTicketProvider = new MockTicketProvider();
        mockAlertProvider = new MockAlertProvider();
        mockCacheProvider = new MockCacheProvider();
        config = {
            errors: [{
                    name: 'test-provider',
                    provider: mockErrorProvider,
                }],
            ticketProvider: mockTicketProvider,
            alertProvider: mockAlertProvider,
            cacheProvider: mockCacheProvider,
        };
    });
    describe('mixpanelIds handling', () => {
        it('should handle merging errors with undefined mixpanelIds', () => __awaiter(void 0, void 0, void 0, function* () {
            const errorWithMixpanelIds = {
                name: 'JavaScript Error: Cannot read property',
                type: models_1.ErrorType.BROWSER,
                count: 3,
                countType: models_1.ErrorCountType.USERS,
                mixpanelIds: ['user1', 'user2'],
                countPeriodHours: 24,
            };
            const errorWithUndefinedMixpanelIds = {
                name: 'JavaScript Error: Cannot read property',
                type: models_1.ErrorType.BROWSER,
                count: 2,
                countType: models_1.ErrorCountType.USERS,
                countPeriodHours: 24,
            };
            mockErrorProvider.setErrors([errorWithMixpanelIds, errorWithUndefinedMixpanelIds]);
            const synchronizer = new Synchronizer_1.Synchronizer(config);
            const result = yield synchronizer.run();
            expect(result.exitCode).toBe(0);
            expect(result.errors).toHaveLength(0);
            expect(result.completedErrorGroups).toHaveLength(1);
            const errorGroup = result.completedErrorGroups[0];
            expect(errorGroup.mixpanelIds).toEqual(['user1', 'user2']);
            expect(errorGroup.instances).toHaveLength(2);
        }));
        it('should handle both errors having undefined mixpanelIds', () => __awaiter(void 0, void 0, void 0, function* () {
            const error1 = {
                name: 'Network Error: Timeout',
                type: models_1.ErrorType.CLIENT,
                count: 5,
                countType: models_1.ErrorCountType.TRX,
                countPeriodHours: 24,
            };
            const error2 = {
                name: 'Network Error: Timeout',
                type: models_1.ErrorType.CLIENT,
                count: 3,
                countType: models_1.ErrorCountType.TRX,
                countPeriodHours: 24,
            };
            mockErrorProvider.setErrors([error1, error2]);
            const synchronizer = new Synchronizer_1.Synchronizer(config);
            const result = yield synchronizer.run();
            expect(result.exitCode).toBe(0);
            expect(result.errors).toHaveLength(0);
            expect(result.completedErrorGroups).toHaveLength(1);
            const errorGroup = result.completedErrorGroups[0];
            expect(errorGroup.mixpanelIds).toEqual([]);
            expect(errorGroup.instances).toHaveLength(2);
        }));
        it('should merge defined and undefined mixpanelIds correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            const errorWithIds = {
                name: 'Database Connection Failed',
                type: models_1.ErrorType.SERVER,
                count: 4,
                countType: models_1.ErrorCountType.TRX,
                mixpanelIds: ['session1', 'session2'],
                countPeriodHours: 24,
            };
            const errorWithoutIds = {
                name: 'Database Connection Failed',
                type: models_1.ErrorType.SERVER,
                count: 2,
                countType: models_1.ErrorCountType.TRX,
                countPeriodHours: 24,
            };
            const errorWithMoreIds = {
                name: 'Database Connection Failed',
                type: models_1.ErrorType.SERVER,
                count: 1,
                countType: models_1.ErrorCountType.TRX,
                mixpanelIds: ['session2', 'session3'],
                countPeriodHours: 24,
            };
            mockErrorProvider.setErrors([errorWithIds, errorWithoutIds, errorWithMoreIds]);
            const synchronizer = new Synchronizer_1.Synchronizer(config);
            const result = yield synchronizer.run();
            expect(result.exitCode).toBe(0);
            expect(result.errors).toHaveLength(0);
            expect(result.completedErrorGroups).toHaveLength(1);
            const errorGroup = result.completedErrorGroups[0];
            expect(errorGroup.mixpanelIds).toEqual(expect.arrayContaining(['session1', 'session2', 'session3']));
            expect(errorGroup.mixpanelIds).toHaveLength(3);
            expect(errorGroup.instances).toHaveLength(3);
        }));
    });
});
//# sourceMappingURL=Synchronizer.test.js.map
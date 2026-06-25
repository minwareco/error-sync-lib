"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const OpsGenieAlertProvider_1 = require("../../providers/OpsGenieAlertProvider");
const models_1 = require("../../models");
const opsgenie_sdk_1 = __importDefault(require("opsgenie-sdk"));
jest.mock('opsgenie-sdk', () => ({
    configure: jest.fn(),
    alertV2: {
        create: jest.fn(),
        get: jest.fn(),
        close: jest.fn(),
    },
}));
describe('OpsGenieAlertProvider', () => {
    const config = {
        host: 'api.opsgenie.com',
        apiKey: 'test-api-key',
    };
    let provider;
    const mockCreate = opsgenie_sdk_1.default.alertV2.create;
    const mockGet = opsgenie_sdk_1.default.alertV2.get;
    beforeEach(() => {
        jest.clearAllMocks();
        provider = new OpsGenieAlertProvider_1.OpsGenieAlertProvider(config);
    });
    const makeErrorGroup = (labels) => ({
        name: 'minware.com failed synthetic check',
        sourceName: 'new-relic-synthetic-main-app',
        type: models_1.ErrorType.DATA,
        priority: models_1.ErrorPriority.P1,
        priorityReason: 'test',
        clientId: 'abc123',
        count: 1,
        countType: models_1.ErrorCountType.TRX,
        mixpanelIds: [],
        countPeriodHours: 1,
        ticket: { url: 'https://example.atlassian.net/browse/MW-1' },
        alert: null,
        instances: [{
                name: 'minware.com failed synthetic check',
                type: models_1.ErrorType.DATA,
                count: 1,
                countType: models_1.ErrorCountType.TRX,
                countPeriodHours: 1,
                ...(labels ? { labels } : {}),
            }],
        userEmails: [],
    });
    describe('generateAlertContent', () => {
        it('should populate labels from the first error instance', async () => {
            const errorGroup = makeErrorGroup(['synthetic', 'monitoring', 'minware-app']);
            const content = await provider.generateAlertContent(errorGroup);
            expect(content.labels).toEqual(['synthetic', 'monitoring', 'minware-app']);
        });
        it('should default to an empty label array when the error has no labels', async () => {
            const errorGroup = makeErrorGroup(undefined);
            const content = await provider.generateAlertContent(errorGroup);
            expect(content.labels).toEqual([]);
        });
    });
    describe('createAlert', () => {
        it('should send labels as OpsGenie tags', async () => {
            mockCreate.mockImplementation((_payload, cb) => cb(null, { data: {} }));
            await provider.createAlert({
                clientId: 'abc123',
                summary: '[data] [src] failed synthetic check',
                description: 'failed synthetic check',
                priority: 'P1',
                labels: ['synthetic', 'monitoring'],
                ticketUrl: 'https://example.atlassian.net/browse/MW-1',
                status: 'open',
            });
            expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ tags: ['synthetic', 'monitoring'] }), expect.any(Function));
        });
        it('should send an empty tags array when there are no labels', async () => {
            mockCreate.mockImplementation((_payload, cb) => cb(null, { data: {} }));
            await provider.createAlert({
                clientId: 'abc123',
                summary: 'summary',
                description: 'desc',
                priority: 'P1',
                labels: [],
                ticketUrl: undefined,
                status: 'open',
            });
            expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ tags: [] }), expect.any(Function));
        });
    });
    describe('findAlert', () => {
        it('should map OpsGenie tags back into labels', async () => {
            mockGet.mockImplementation((_params, cb) => cb(null, {
                data: {
                    message: 'summary',
                    description: 'desc',
                    priority: 'P1',
                    tags: ['synthetic', 'monitoring'],
                    details: { 'Ticket Link': 'https://example.atlassian.net/browse/MW-1' },
                    status: 'open',
                },
            }));
            const alert = await provider.findAlert('abc123');
            expect(alert === null || alert === void 0 ? void 0 : alert.labels).toEqual(['synthetic', 'monitoring']);
        });
        it('should default to an empty label array when the alert has no tags', async () => {
            mockGet.mockImplementation((_params, cb) => cb(null, {
                data: {
                    message: 'summary',
                    description: 'desc',
                    priority: 'P1',
                    details: { 'Ticket Link': undefined },
                    status: 'open',
                },
            }));
            const alert = await provider.findAlert('abc123');
            expect(alert === null || alert === void 0 ? void 0 : alert.labels).toEqual([]);
        });
    });
});
//# sourceMappingURL=OpsGenieAlertProvider.test.js.map
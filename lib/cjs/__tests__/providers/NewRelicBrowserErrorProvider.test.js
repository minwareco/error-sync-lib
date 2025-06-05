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
const NewRelicBrowserErrorProvider_1 = require("../../providers/NewRelicBrowserErrorProvider");
const models_1 = require("../../models");
const newrelic_api_client_1 = __importDefault(require("newrelic-api-client"));
jest.mock('newrelic-api-client', () => ({
    insights: {
        query: jest.fn()
    }
}));
describe('NewRelicBrowserErrorProvider', () => {
    const config = {
        accountId: 'test-account-id',
        appName: 'test-app-name',
        appConfigId: 'test-app-config-id',
    };
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('constructor', () => {
        it('should create instance with basic config', () => {
            const provider = new NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider(config);
            expect(provider).toBeInstanceOf(NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider);
        });
        it('should handle excludedeHosts typo for backward compatibility', () => {
            const configWithTypo = Object.assign(Object.assign({}, config), { excludedeHosts: ['bot.example.com'] });
            const provider = new NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider(configWithTypo);
            expect(provider).toBeInstanceOf(NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider);
        });
    });
    describe('getErrors', () => {
        it('should fetch errors and map them correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockErrorsResponse = {
                statusCode: 200,
                body: {
                    facets: [
                        {
                            name: 'Test Error',
                            results: [
                                {
                                    count: 10
                                },
                                {
                                    max: 123
                                },
                                {
                                    members: ['guid-123']
                                },
                                {
                                    members: ['mixpanel-123']
                                }
                            ]
                        }
                    ]
                }
            };
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(null, mockErrorsResponse, mockErrorsResponse.body);
            });
            const provider = new NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider(config);
            const errors = yield provider.getErrors(24, 100);
            expect(errors).toHaveLength(1);
            expect(errors[0].type).toBe(models_1.ErrorType.BROWSER);
            expect(errors[0].count).toBe(10);
            expect(errors[0].countType).toBe(models_1.ErrorCountType.TRX);
            expect(errors[0].countPeriodHours).toBe(24);
            expect(errors[0].debugUrl).toContain('guid-123');
        }));
        it('should handle user count when userIdField is provided', () => __awaiter(void 0, void 0, void 0, function* () {
            const configWithUserId = Object.assign(Object.assign({}, config), { userIdField: 'userId' });
            const mockErrorsResponse = {
                statusCode: 200,
                body: {
                    facets: [
                        {
                            name: 'Test Error',
                            uniqueCount: 5,
                            results: [
                                {
                                    count: 10
                                },
                                {
                                    max: 123
                                },
                                {
                                    members: ['guid-123']
                                },
                                {
                                    members: ['mixpanel-123']
                                },
                                {
                                    uniqueCount: 5
                                }
                            ]
                        }
                    ]
                }
            };
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                expect(nrql).toContain('uniqueCount(userId)');
                callback(null, mockErrorsResponse, mockErrorsResponse.body);
            });
            const provider = new NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider(configWithUserId);
            const errors = yield provider.getErrors();
            expect(errors).toHaveLength(1);
            expect(errors[0].uniqueCount).toBe(5);
            expect(errors[0].countType).toBe(models_1.ErrorCountType.USERS);
        }));
        it('should use default parameters when none provided', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockErrorsResponse = {
                statusCode: 200,
                body: { facets: [] }
            };
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                expect(nrql).toContain('SINCE 24 hours ago');
                expect(nrql).toContain('LIMIT 1000');
                callback(null, mockErrorsResponse, mockErrorsResponse.body);
            });
            const provider = new NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider(config);
            const errors = yield provider.getErrors();
            expect(errors).toEqual([]);
        }));
        it('should handle custom time period and limit', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockErrorsResponse = {
                statusCode: 200,
                body: { facets: [] }
            };
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                expect(nrql).toContain('SINCE 48 hours ago');
                expect(nrql).toContain('LIMIT 500');
                callback(null, mockErrorsResponse, mockErrorsResponse.body);
            });
            const provider = new NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider(config);
            yield provider.getErrors(48, 500);
        }));
        it('should construct correct NRQL query for browser errors', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockErrorsResponse = {
                statusCode: 200,
                body: { facets: [] }
            };
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                expect(nrql).toContain('FROM JavaScriptError');
                expect(nrql).toContain('FACET `errorMessage`');
                expect(nrql).toContain('uniques(mixpanelId)');
                expect(nrql).toContain('uniques(entityGuid)');
                expect(nrql).not.toContain('User-Agent');
                callback(null, mockErrorsResponse, mockErrorsResponse.body);
            });
            const provider = new NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider(config);
            yield provider.getErrors();
        }));
        it('should handle multiple errors in response', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockErrorsResponse = {
                statusCode: 200,
                body: {
                    facets: [
                        {
                            name: 'Error 1',
                            results: [
                                { count: 5 },
                                { max: 111 },
                                { members: ['guid-111'] },
                                { members: ['mixpanel-111'] }
                            ]
                        },
                        {
                            name: 'Error 2',
                            results: [
                                { count: 15 },
                                { max: 222 },
                                { members: ['guid-222'] },
                                { members: ['mixpanel-222'] }
                            ]
                        }
                    ]
                }
            };
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(null, mockErrorsResponse, mockErrorsResponse.body);
            });
            const provider = new NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider(config);
            const errors = yield provider.getErrors();
            expect(errors).toHaveLength(2);
            expect(errors[0].name).toBe('Error 1');
            expect(errors[0].count).toBe(5);
            expect(errors[1].name).toBe('Error 2');
            expect(errors[1].count).toBe(15);
        }));
        it('should handle empty response', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockErrorsResponse = {
                statusCode: 200,
                body: { facets: [] }
            };
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(null, mockErrorsResponse, mockErrorsResponse.body);
            });
            const provider = new NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider(config);
            const errors = yield provider.getErrors();
            expect(errors).toEqual([]);
        }));
        it('should handle server errors (status > 500) by returning empty array', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockErrorsResponse = {
                statusCode: 503,
                body: { error: 'Service Unavailable' }
            };
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(null, mockErrorsResponse, mockErrorsResponse.body);
            });
            const provider = new NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider(config);
            const errors = yield provider.getErrors();
            expect(errors).toEqual([]);
        }));
        it('should reject on API errors', () => __awaiter(void 0, void 0, void 0, function* () {
            const apiError = new Error('API Error');
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(apiError, null, null);
            });
            const provider = new NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider(config);
            yield expect(provider.getErrors()).rejects.toThrow('API Error');
        }));
        it('should reject on response body errors', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockErrorsResponse = {
                statusCode: 200,
                body: { error: 'Invalid query' }
            };
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(null, mockErrorsResponse, mockErrorsResponse.body);
            });
            const provider = new NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider(config);
            yield expect(provider.getErrors()).rejects.toBe('Invalid query');
        }));
        it('should reject on non-200 status codes (excluding server errors)', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockErrorsResponse = {
                statusCode: 400,
                body: { message: 'Bad Request' }
            };
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(null, mockErrorsResponse, mockErrorsResponse.body);
            });
            const provider = new NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider(config);
            yield expect(provider.getErrors()).rejects.toEqual({ message: 'Bad Request' });
        }));
        it('should set correct debug URL for browser errors', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockErrorsResponse = {
                statusCode: 200,
                body: {
                    facets: [
                        {
                            name: 'Test Error',
                            results: [
                                { count: 10 },
                                { max: 123 },
                                { members: ['test-entity-guid'] },
                                { members: ['mixpanel-123'] }
                            ]
                        }
                    ]
                }
            };
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(null, mockErrorsResponse, mockErrorsResponse.body);
            });
            const provider = new NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider(config);
            const errors = yield provider.getErrors();
            expect(errors[0].debugUrl).toContain('one.newrelic.com');
            expect(errors[0].debugUrl).toContain('test-entity-guid');
            expect(errors[0].debugUrl).toContain('duration=86400000');
        }));
        it('should handle missing mixpanelIds gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockErrorsResponse = {
                statusCode: 200,
                body: {
                    facets: [
                        {
                            name: 'Test Error',
                            results: [
                                { count: 10 },
                                { max: 123 },
                                { members: ['guid-123'] },
                                { members: [] }
                            ]
                        }
                    ]
                }
            };
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(null, mockErrorsResponse, mockErrorsResponse.body);
            });
            const provider = new NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider(config);
            const errors = yield provider.getErrors();
            expect(errors[0].mixpanelIds).toEqual([]);
        }));
        it('should prioritize uniqueCount over count when available', () => __awaiter(void 0, void 0, void 0, function* () {
            const configWithUserId = Object.assign(Object.assign({}, config), { userIdField: 'userId' });
            const mockErrorsResponse = {
                statusCode: 200,
                body: {
                    facets: [
                        {
                            name: 'Test Error',
                            results: [
                                { count: 100 },
                                { max: 123 },
                                { members: ['guid-123'] },
                                { members: ['mixpanel-123'] },
                                { uniqueCount: 25 }
                            ]
                        }
                    ]
                }
            };
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(null, mockErrorsResponse, mockErrorsResponse.body);
            });
            const provider = new NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider(configWithUserId);
            const errors = yield provider.getErrors();
            expect(errors[0].count).toBe(25);
            expect(errors[0].countType).toBe(models_1.ErrorCountType.USERS);
        }));
        it('should use transaction count when uniqueCount is 0', () => __awaiter(void 0, void 0, void 0, function* () {
            const configWithUserId = Object.assign(Object.assign({}, config), { userIdField: 'userId' });
            const mockErrorsResponse = {
                statusCode: 200,
                body: {
                    facets: [
                        {
                            name: 'Test Error',
                            results: [
                                { count: 50 },
                                { max: 123 },
                                { members: ['guid-123'] },
                                { members: ['mixpanel-123'] },
                                { uniqueCount: 0 }
                            ]
                        }
                    ]
                }
            };
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(null, mockErrorsResponse, mockErrorsResponse.body);
            });
            const provider = new NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider(configWithUserId);
            const errors = yield provider.getErrors();
            expect(errors[0].count).toBe(50);
            expect(errors[0].countType).toBe(models_1.ErrorCountType.TRX);
        }));
    });
});
//# sourceMappingURL=NewRelicBrowserErrorProvider.test.js.map
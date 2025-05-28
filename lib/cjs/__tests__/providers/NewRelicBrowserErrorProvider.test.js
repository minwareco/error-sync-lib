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
    describe('getAppIdToEntityGuidMap', () => {
        it('should fetch and cache the appId to entityGuid map', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockMapResponse = {
                statusCode: 200,
                body: {
                    results: [{
                            events: [
                                { appId: 123, entityGuid: 'guid-123' },
                                { appId: 456, entityGuid: 'guid-456' }
                            ]
                        }]
                }
            };
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                if (nrql.includes('uniques(entityGuid') && nrql.includes('uniques(appId')) {
                    callback(null, mockMapResponse, mockMapResponse.body);
                }
            });
            const provider = new NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider(config);
            const getMapMethod = provider.getAppIdToEntityGuidMap.bind(provider);
            const map1 = yield getMapMethod();
            expect(map1.get(123)).toBe('guid-123');
            expect(map1.get(456)).toBe('guid-456');
            expect(newrelic_api_client_1.default.insights.query).toHaveBeenCalledTimes(1);
            const map2 = yield getMapMethod();
            expect(newrelic_api_client_1.default.insights.query).toHaveBeenCalledTimes(1);
            expect(map2).toBe(map1);
        }));
        it('should handle API errors when fetching the map', () => __awaiter(void 0, void 0, void 0, function* () {
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(new Error('API Error'), null, null);
            });
            const provider = new NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider(config);
            const getMapMethod = provider.getAppIdToEntityGuidMap.bind(provider);
            yield expect(getMapMethod()).rejects.toThrow('API Error');
            expect(newrelic_api_client_1.default.insights.query).toHaveBeenCalledTimes(1);
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(null, { statusCode: 200, body: { results: [{ events: [] }] } }, { results: [{ events: [] }] });
            });
            yield getMapMethod();
            expect(newrelic_api_client_1.default.insights.query).toHaveBeenCalledTimes(2);
        }));
        it('should reuse in-progress promise when multiple calls are made', () => __awaiter(void 0, void 0, void 0, function* () {
            let resolvePromise;
            const delayPromise = new Promise((resolve) => {
                resolvePromise = resolve;
            });
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                delayPromise.then(() => {
                    callback(null, {
                        statusCode: 200,
                        body: {
                            results: [{
                                    events: [{ appId: 123, entityGuid: 'guid-123' }]
                                }]
                        }
                    }, {
                        results: [{
                                events: [{ appId: 123, entityGuid: 'guid-123' }]
                            }]
                    });
                });
            });
            const provider = new NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider(config);
            const getMapMethod = provider.getAppIdToEntityGuidMap.bind(provider);
            const promise1 = getMapMethod();
            const promise2 = getMapMethod();
            resolvePromise();
            const [map1, map2] = yield Promise.all([promise1, promise2]);
            expect(newrelic_api_client_1.default.insights.query).toHaveBeenCalledTimes(1);
            expect(map1).toBe(map2);
            expect(map1.get(123)).toBe('guid-123');
        }));
    });
    describe('getErrors', () => {
        it('should fetch errors and map them correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockMapResponse = {
                statusCode: 200,
                body: {
                    results: [{
                            events: [
                                { appId: 123, entityGuid: 'guid-123' }
                            ]
                        }]
                }
            };
            const mockErrorsResponse = {
                statusCode: 200,
                body: {
                    metadata: {
                        contents: {
                            contents: [
                                {
                                    alias: 'count',
                                    contents: {
                                        function: 'count'
                                    }
                                },
                                {
                                    alias: 'appId',
                                    contents: {
                                        function: 'max'
                                    }
                                },
                                {
                                    alias: 'mixpanelIds',
                                    contents: {
                                        function: 'uniques'
                                    }
                                }
                            ]
                        }
                    },
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
                                    members: []
                                }
                            ]
                        }
                    ]
                }
            };
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                if (nrql.includes('uniques(entityGuid') && nrql.includes('uniques(appId')) {
                    callback(null, mockMapResponse, mockMapResponse.body);
                }
                else if (nrql.includes('FROM JavaScriptError')) {
                    callback(null, mockErrorsResponse, mockErrorsResponse.body);
                }
            });
            const provider = new NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider(config);
            const mockMap = new Map([[123, 'guid-123']]);
            jest.spyOn(provider, 'getAppIdToEntityGuidMap').mockResolvedValue(mockMap);
            provider.appIdToEntityGuid = mockMap;
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
            const mockMapResponse = {
                statusCode: 200,
                body: {
                    results: [{
                            events: [
                                { appId: 123, entityGuid: 'guid-123' }
                            ]
                        }]
                }
            };
            const mockErrorsResponse = {
                statusCode: 200,
                body: {
                    metadata: {
                        contents: {
                            contents: [
                                {
                                    alias: 'count',
                                    contents: {
                                        function: 'count'
                                    }
                                },
                                {
                                    alias: 'appId',
                                    contents: {
                                        function: 'max'
                                    }
                                },
                                {
                                    alias: 'mixpanelIds',
                                    contents: {
                                        function: 'uniques'
                                    }
                                },
                                {
                                    alias: 'uniqueCount',
                                    contents: {
                                        function: 'uniqueCount'
                                    }
                                }
                            ]
                        }
                    },
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
                                    members: []
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
                if (nrql.includes('uniques(entityGuid') && nrql.includes('uniques(appId')) {
                    callback(null, mockMapResponse, mockMapResponse.body);
                }
                else if (nrql.includes('FROM JavaScriptError')) {
                    expect(nrql).toContain('uniqueCount(userId)');
                    callback(null, mockErrorsResponse, mockErrorsResponse.body);
                }
            });
            const provider = new NewRelicBrowserErrorProvider_1.NewRelicBrowserErrorProvider(configWithUserId);
            provider.appIdToEntityGuid = new Map([[123, 'guid-123']]);
            const errors = yield provider.getErrors();
            expect(errors).toHaveLength(1);
            expect(errors[0].uniqueCount).toBe(5);
            expect(errors[0].countType).toBe(models_1.ErrorCountType.USERS);
        }));
    });
});
//# sourceMappingURL=NewRelicBrowserErrorProvider.test.js.map
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { NewRelicBrowserErrorProvider } from '../../providers/NewRelicBrowserErrorProvider';
import { ErrorCountType, ErrorType } from '../../models';
import newrelicApi from 'newrelic-api-client';
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
            newrelicApi.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                if (nrql.includes('uniques(entityGuid') && nrql.includes('uniques(appId')) {
                    callback(null, mockMapResponse, mockMapResponse.body);
                }
            });
            const provider = new NewRelicBrowserErrorProvider(config);
            const getMapMethod = provider.getAppIdToEntityGuidMap.bind(provider);
            const map1 = yield getMapMethod();
            expect(map1.get(123)).toBe('guid-123');
            expect(map1.get(456)).toBe('guid-456');
            expect(newrelicApi.insights.query).toHaveBeenCalledTimes(1);
            const map2 = yield getMapMethod();
            expect(newrelicApi.insights.query).toHaveBeenCalledTimes(1);
            expect(map2).toBe(map1);
        }));
        it('should handle API errors when fetching the map', () => __awaiter(void 0, void 0, void 0, function* () {
            newrelicApi.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(new Error('API Error'), null, null);
            });
            const provider = new NewRelicBrowserErrorProvider(config);
            const getMapMethod = provider.getAppIdToEntityGuidMap.bind(provider);
            yield expect(getMapMethod()).rejects.toThrow('API Error');
            expect(newrelicApi.insights.query).toHaveBeenCalledTimes(1);
            newrelicApi.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(null, { statusCode: 200, body: { results: [{ events: [] }] } }, { results: [{ events: [] }] });
            });
            yield getMapMethod();
            expect(newrelicApi.insights.query).toHaveBeenCalledTimes(2);
        }));
        it('should reuse in-progress promise when multiple calls are made', () => __awaiter(void 0, void 0, void 0, function* () {
            let resolvePromise;
            const delayPromise = new Promise((resolve) => {
                resolvePromise = resolve;
            });
            newrelicApi.insights.query.mockImplementation((nrql, appConfigId, callback) => {
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
            const provider = new NewRelicBrowserErrorProvider(config);
            const getMapMethod = provider.getAppIdToEntityGuidMap.bind(provider);
            const promise1 = getMapMethod();
            const promise2 = getMapMethod();
            resolvePromise();
            const [map1, map2] = yield Promise.all([promise1, promise2]);
            expect(newrelicApi.insights.query).toHaveBeenCalledTimes(1);
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
                    facets: [
                        {
                            name: 'Test Error',
                            results: [
                                {
                                    'count(*)': 10,
                                    'max(appId)': 123
                                }
                            ]
                        }
                    ]
                }
            };
            newrelicApi.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                if (nrql.includes('uniques(entityGuid') && nrql.includes('uniques(appId')) {
                    callback(null, mockMapResponse, mockMapResponse.body);
                }
                else if (nrql.includes('FROM JavaScriptError')) {
                    callback(null, mockErrorsResponse, mockErrorsResponse.body);
                }
            });
            const provider = new NewRelicBrowserErrorProvider(config);
            const mockMap = new Map([[123, 'guid-123']]);
            jest.spyOn(provider, 'getAppIdToEntityGuidMap').mockResolvedValue(mockMap);
            provider.appIdToEntityGuid = mockMap;
            const errors = yield provider.getErrors(24, 100);
            expect(errors).toHaveLength(1);
            expect(errors[0].type).toBe(ErrorType.BROWSER);
            expect(errors[0]['count(*)']).toBe(10);
            expect(errors[0].countType).toBe(ErrorCountType.TRX);
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
                    facets: [
                        {
                            name: 'Test Error',
                            results: [
                                {
                                    'count(*)': 10,
                                    'max(appId)': 123,
                                    'uniqueCount(userId)': 5
                                }
                            ]
                        }
                    ]
                }
            };
            newrelicApi.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                if (nrql.includes('uniques(entityGuid') && nrql.includes('uniques(appId')) {
                    callback(null, mockMapResponse, mockMapResponse.body);
                }
                else if (nrql.includes('FROM JavaScriptError')) {
                    expect(nrql).toContain('uniqueCount(userId)');
                    callback(null, mockErrorsResponse, mockErrorsResponse.body);
                }
            });
            const provider = new NewRelicBrowserErrorProvider(configWithUserId);
            provider.appIdToEntityGuid = new Map([[123, 'guid-123']]);
            const mockUniqueCount = 5;
            newrelicApi.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                if (nrql.includes('uniques(entityGuid') && nrql.includes('uniques(appId')) {
                    callback(null, mockMapResponse, mockMapResponse.body);
                }
                else if (nrql.includes('FROM JavaScriptError')) {
                    const modifiedResponse = JSON.parse(JSON.stringify(mockErrorsResponse));
                    modifiedResponse.body.facets[0].uniqueCount = mockUniqueCount;
                    callback(null, modifiedResponse, modifiedResponse.body);
                }
            });
            const errors = yield provider.getErrors();
            expect(errors).toHaveLength(1);
            expect(errors[0]['uniqueCount(userId)']).toBe(5);
            expect(errors[0].uniqueCount).toBe(5);
            expect(errors[0].countType).toBe(ErrorCountType.USERS);
        }));
    });
});
//# sourceMappingURL=NewRelicBrowserErrorProvider.test.js.map
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { NewRelicServerErrorProvider } from '../../providers/NewRelicServerErrorProvider';
import { ErrorCountType, ErrorType } from '../../models';
import newrelicApi from 'newrelic-api-client';
jest.mock('newrelic-api-client', () => ({
    insights: {
        query: jest.fn()
    }
}));
describe('NewRelicServerErrorProvider', () => {
    const config = {
        accountId: 'test-account-id',
        appName: 'test-app-name',
        appConfigId: 'test-app-config-id',
    };
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('getErrors', () => {
        it('should fetch server errors and map them correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockErrorsResponse = {
                statusCode: 200,
                body: {
                    facets: [
                        {
                            name: 'Database connection failed',
                            results: [
                                {
                                    count: 15
                                },
                                {
                                    max: 456
                                },
                                {
                                    members: ['guid-456']
                                }
                            ]
                        }
                    ]
                }
            };
            newrelicApi.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                expect(nrql).toContain('TransactionError');
                expect(nrql).toContain('error.message');
                expect(nrql).toContain("`request.headers.User-Agent` NOT LIKE '%Bot%'");
                callback(null, mockErrorsResponse, mockErrorsResponse.body);
            });
            const provider = new NewRelicServerErrorProvider(config);
            const errors = yield provider.getErrors(24, 100);
            expect(errors).toHaveLength(1);
            expect(errors[0].type).toBe(ErrorType.SERVER);
            expect(errors[0].count).toBe(15);
            expect(errors[0].countType).toBe(ErrorCountType.TRX);
            expect(errors[0].countPeriodHours).toBe(24);
            expect(errors[0].debugUrl).toContain('rpm.newrelic.com');
            expect(errors[0].debugUrl).toContain('filterable_errors');
            expect(errors[0].debugUrl).toContain('error.message');
        }));
        it('should handle user count when userIdField is provided', () => __awaiter(void 0, void 0, void 0, function* () {
            const configWithUserId = Object.assign(Object.assign({}, config), { userIdField: 'userId' });
            const mockErrorsResponse = {
                statusCode: 200,
                body: {
                    facets: [
                        {
                            name: 'Authentication failed',
                            uniqueCount: 8,
                            results: [
                                {
                                    count: 20
                                },
                                {
                                    max: 789
                                },
                                {
                                    members: ['guid-789']
                                },
                                {
                                    uniqueCount: 8
                                }
                            ]
                        }
                    ]
                }
            };
            newrelicApi.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                expect(nrql).toContain('uniqueCount(userId)');
                expect(nrql).toContain('TransactionError');
                callback(null, mockErrorsResponse, mockErrorsResponse.body);
            });
            const provider = new NewRelicServerErrorProvider(configWithUserId);
            const errors = yield provider.getErrors();
            expect(errors).toHaveLength(1);
            expect(errors[0].uniqueCount).toBe(8);
            expect(errors[0].countType).toBe(ErrorCountType.USERS);
        }));
        it('should handle backward compatibility with excludedeHosts typo', () => __awaiter(void 0, void 0, void 0, function* () {
            const configWithTypo = Object.assign(Object.assign({}, config), { excludedeHosts: ['bot.example.com'] });
            const mockErrorsResponse = {
                statusCode: 200,
                body: {
                    facets: [
                        {
                            name: 'Test Server Error',
                            results: [
                                { count: 5 },
                                { max: 123 },
                                { members: ['guid-123'] }
                            ]
                        }
                    ]
                }
            };
            newrelicApi.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(null, mockErrorsResponse, mockErrorsResponse.body);
            });
            const provider = new NewRelicServerErrorProvider(configWithTypo);
            const errors = yield provider.getErrors();
            expect(errors).toHaveLength(1);
            expect(errors[0].name).toBe('Test Server Error');
        }));
        it('should handle API errors gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            newrelicApi.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(new Error('API Error'), null, null);
            });
            const provider = new NewRelicServerErrorProvider(config);
            yield expect(provider.getErrors()).rejects.toThrow('API Error');
        }));
        it('should handle non-200 status codes', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockErrorResponse = {
                statusCode: 400,
                body: { error: 'Bad Request' }
            };
            newrelicApi.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(null, mockErrorResponse, mockErrorResponse.body);
            });
            const provider = new NewRelicServerErrorProvider(config);
            yield expect(provider.getErrors()).rejects.toEqual('Bad Request');
        }));
        it('should return empty array for 500+ status codes', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockServerErrorResponse = {
                statusCode: 503,
                body: { error: 'Service Unavailable' }
            };
            newrelicApi.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(null, mockServerErrorResponse, mockServerErrorResponse.body);
            });
            const provider = new NewRelicServerErrorProvider(config);
            const errors = yield provider.getErrors();
            expect(errors).toEqual([]);
        }));
        it('should handle response body errors', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockResponseWithError = {
                statusCode: 200,
                body: { error: 'Query timeout' }
            };
            newrelicApi.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(null, mockResponseWithError, mockResponseWithError.body);
            });
            const provider = new NewRelicServerErrorProvider(config);
            yield expect(provider.getErrors()).rejects.toBe('Query timeout');
        }));
    });
});
//# sourceMappingURL=NewRelicServerErrorProvider.test.js.map
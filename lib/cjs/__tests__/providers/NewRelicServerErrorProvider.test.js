"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const NewRelicServerErrorProvider_1 = require("../../providers/NewRelicServerErrorProvider");
const models_1 = require("../../models");
const newrelic_api_client_1 = __importDefault(require("newrelic-api-client"));
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
        it('should fetch server errors and map them correctly', async () => {
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
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                expect(nrql).toContain('TransactionError');
                expect(nrql).toContain('error.message');
                expect(nrql).toContain("`request.headers.User-Agent` NOT LIKE '%Bot%'");
                callback(null, mockErrorsResponse, mockErrorsResponse.body);
            });
            const provider = new NewRelicServerErrorProvider_1.NewRelicServerErrorProvider(config);
            const errors = await provider.getErrors(24, 100);
            expect(errors).toHaveLength(1);
            expect(errors[0].type).toBe(models_1.ErrorType.SERVER);
            expect(errors[0].count).toBe(15);
            expect(errors[0].countType).toBe(models_1.ErrorCountType.TRX);
            expect(errors[0].countPeriodHours).toBe(24);
            expect(errors[0].debugUrl).toContain('rpm.newrelic.com');
            expect(errors[0].debugUrl).toContain('filterable_errors');
            expect(errors[0].debugUrl).toContain('error.message');
        });
        it('should handle user count when userIdField is provided', async () => {
            const configWithUserId = {
                ...config,
                userIdField: 'userId'
            };
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
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                expect(nrql).toContain('uniqueCount(userId)');
                expect(nrql).toContain('TransactionError');
                callback(null, mockErrorsResponse, mockErrorsResponse.body);
            });
            const provider = new NewRelicServerErrorProvider_1.NewRelicServerErrorProvider(configWithUserId);
            const errors = await provider.getErrors();
            expect(errors).toHaveLength(1);
            expect(errors[0].uniqueCount).toBe(8);
            expect(errors[0].countType).toBe(models_1.ErrorCountType.USERS);
        });
        it('should handle backward compatibility with excludedeHosts typo', async () => {
            const configWithTypo = {
                ...config,
                excludedeHosts: ['bot.example.com']
            };
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
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(null, mockErrorsResponse, mockErrorsResponse.body);
            });
            const provider = new NewRelicServerErrorProvider_1.NewRelicServerErrorProvider(configWithTypo);
            const errors = await provider.getErrors();
            expect(errors).toHaveLength(1);
            expect(errors[0].name).toBe('Test Server Error');
        });
        it('should handle API errors gracefully', async () => {
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(new Error('API Error'), null, null);
            });
            const provider = new NewRelicServerErrorProvider_1.NewRelicServerErrorProvider(config);
            await expect(provider.getErrors()).rejects.toThrow('API Error');
        });
        it('should handle non-200 status codes', async () => {
            const mockErrorResponse = {
                statusCode: 400,
                body: { error: 'Bad Request' }
            };
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(null, mockErrorResponse, mockErrorResponse.body);
            });
            const provider = new NewRelicServerErrorProvider_1.NewRelicServerErrorProvider(config);
            await expect(provider.getErrors()).rejects.toEqual('Bad Request');
        });
        it('should return empty array for 500+ status codes', async () => {
            const mockServerErrorResponse = {
                statusCode: 503,
                body: { error: 'Service Unavailable' }
            };
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(null, mockServerErrorResponse, mockServerErrorResponse.body);
            });
            const provider = new NewRelicServerErrorProvider_1.NewRelicServerErrorProvider(config);
            const errors = await provider.getErrors();
            expect(errors).toEqual([]);
        });
        it('should handle response body errors', async () => {
            const mockResponseWithError = {
                statusCode: 200,
                body: { error: 'Query timeout' }
            };
            newrelic_api_client_1.default.insights.query.mockImplementation((nrql, appConfigId, callback) => {
                callback(null, mockResponseWithError, mockResponseWithError.body);
            });
            const provider = new NewRelicServerErrorProvider_1.NewRelicServerErrorProvider(config);
            await expect(provider.getErrors()).rejects.toBe('Query timeout');
        });
    });
});
//# sourceMappingURL=NewRelicServerErrorProvider.test.js.map
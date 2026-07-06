import { NewRelicServerErrorProvider, NewRelicServerErrorProviderConfig } from '../../providers/NewRelicServerErrorProvider';
import { ErrorCountType, ErrorType } from '../../models';
import newrelicApi from 'newrelic-api-client';

// Mock the newrelic-api-client
jest.mock('newrelic-api-client', () => ({
  insights: {
    query: jest.fn()
  }
}));

describe('NewRelicServerErrorProvider', () => {
  // Sample configuration for testing
  const config: NewRelicServerErrorProviderConfig = {
    accountId: 'test-account-id',
    appName: 'test-app-name',
    appConfigId: 'test-app-config-id',
  };

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getErrors', () => {
    it('should fetch server errors and map them correctly', async () => {
      // Mock the errors query response
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

      // Setup the mock implementation
      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          // Verify it's querying the TransactionError table for server errors
          expect(nrql).toContain('TransactionError');
          expect(nrql).toContain('error.message');
          expect(nrql).toContain("`request.headers.User-Agent` NOT LIKE '%Bot%'");
          callback(null, mockErrorsResponse, mockErrorsResponse.body);
        }
      );

      // Create provider instance
      const provider = new NewRelicServerErrorProvider(config);
      
      // Call getErrors
      const errors = await provider.getErrors(24, 100);
      
      // Verify the errors are mapped correctly
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe(ErrorType.SERVER);
      expect(errors[0].count).toBe(15);
      expect(errors[0].countType).toBe(ErrorCountType.TRX);
      expect(errors[0].countPeriodHours).toBe(24);
      
      // Verify the debug URL is the server-style URL
      expect(errors[0].debugUrl).toContain('rpm.newrelic.com');
      expect(errors[0].debugUrl).toContain('filterable_errors');
      expect(errors[0].debugUrl).toContain('error.message');
    });

    it('should handle user count when userIdField is provided', async () => {
      // Create config with userIdField
      const configWithUserId = {
        ...config,
        userIdField: 'userId'
      };

      // Mock the errors query response with user count
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

      // Setup the mock implementation
      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          expect(nrql).toContain('uniqueCount(userId)');
          expect(nrql).toContain('TransactionError');
          callback(null, mockErrorsResponse, mockErrorsResponse.body);
        }
      );

      // Create provider instance
      const provider = new NewRelicServerErrorProvider(configWithUserId);
      
      // Call getErrors
      const errors = await provider.getErrors();
      
      // Verify the errors are mapped correctly with user count
      expect(errors).toHaveLength(1);
      expect((errors[0] as any).uniqueCount).toBe(8);
      expect(errors[0].countType).toBe(ErrorCountType.USERS);
    });

    it('should handle backward compatibility with excludedeHosts typo', async () => {
      // Create config with the typo property
      const configWithTypo = {
        ...config,
        excludedeHosts: ['bot.example.com'] as [string]
      };

      // Mock response
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

      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          callback(null, mockErrorsResponse, mockErrorsResponse.body);
        }
      );

      // Create provider instance - should not throw error with typo
      const provider = new NewRelicServerErrorProvider(configWithTypo);
      
      // Call getErrors - should work normally
      const errors = await provider.getErrors();
      
      expect(errors).toHaveLength(1);
      expect(errors[0].name).toBe('Test Server Error');
    });

    it('should handle API errors gracefully', async () => {
      // Setup mock to return an error
      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          callback(new Error('API Error'), null, null);
        }
      );

      const provider = new NewRelicServerErrorProvider(config);
      
      // Should reject with the error
      await expect(provider.getErrors()).rejects.toThrow('API Error');
    });

    it('should handle non-200 status codes', async () => {
      // Setup mock to return non-200 status
      const mockErrorResponse = {
        statusCode: 400,
        body: { error: 'Bad Request' }
      };

      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          callback(null, mockErrorResponse, mockErrorResponse.body);
        }
      );

      const provider = new NewRelicServerErrorProvider(config);
      
      // Should reject with the response body
      await expect(provider.getErrors()).rejects.toEqual('Bad Request');
    });

    it('should return empty array for 500+ status codes', async () => {
      // Setup mock to return 500+ status
      const mockServerErrorResponse = {
        statusCode: 503,
        body: { error: 'Service Unavailable' }
      };

      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          callback(null, mockServerErrorResponse, mockServerErrorResponse.body);
        }
      );

      const provider = new NewRelicServerErrorProvider(config);
      
      // Should resolve with empty array
      const errors = await provider.getErrors();
      expect(errors).toEqual([]);
    });

    it('should handle response body errors', async () => {
      // Setup mock to return response with error in body
      const mockResponseWithError = {
        statusCode: 200,
        body: { error: 'Query timeout' }
      };

      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          callback(null, mockResponseWithError, mockResponseWithError.body);
        }
      );

      const provider = new NewRelicServerErrorProvider(config);
      
      // Should reject with the body error
      await expect(provider.getErrors()).rejects.toBe('Query timeout');
    });
  });
}); 
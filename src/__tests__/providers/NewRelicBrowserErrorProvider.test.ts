import { NewRelicBrowserErrorProvider, NewRelicBrowserErrorProviderConfig } from '../../providers/NewRelicBrowserErrorProvider';
import { ErrorCountType, ErrorType } from '../../models';
import newrelicApi from 'newrelic-api-client';

// Mock the newrelic-api-client
jest.mock('newrelic-api-client', () => ({
  insights: {
    query: jest.fn()
  }
}));

describe('NewRelicBrowserErrorProvider', () => {
  // Sample configuration for testing
  const config: NewRelicBrowserErrorProviderConfig = {
    accountId: 'test-account-id',
    appName: 'test-app-name',
    appConfigId: 'test-app-config-id',
  };

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with basic config', () => {
      const provider = new NewRelicBrowserErrorProvider(config);
      expect(provider).toBeInstanceOf(NewRelicBrowserErrorProvider);
    });

    it('should handle excludedeHosts typo for backward compatibility', () => {
      const configWithTypo = {
        ...config,
        excludedeHosts: ['bot.example.com'] as [string]
      };
      
      const provider = new NewRelicBrowserErrorProvider(configWithTypo);
      expect(provider).toBeInstanceOf(NewRelicBrowserErrorProvider);
    });
  });

  describe('getErrors', () => {
    it('should fetch errors and map them correctly', async () => {
      // Mock the errors query response
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

      // Setup the mock implementation
      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          callback(null, mockErrorsResponse, mockErrorsResponse.body);
        }
      );

      // Create provider instance
      const provider = new NewRelicBrowserErrorProvider(config);
      
      // Call getErrors
      const errors = await provider.getErrors(24, 100);
      
      // Verify the errors are mapped correctly
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe(ErrorType.BROWSER);
      expect(errors[0].count).toBe(10); // The count property from the response
      expect(errors[0].countType).toBe(ErrorCountType.TRX);
      expect(errors[0].countPeriodHours).toBe(24);
      
      // Verify the URL includes the entityGuid parameter with the correct value
      expect(errors[0].debugUrl).toContain('guid-123');
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

      // Setup the mock implementation - using a single implementation
      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          expect(nrql).toContain('uniqueCount(userId)');
          callback(null, mockErrorsResponse, mockErrorsResponse.body);
        }
      );

      // Create provider instance
      const provider = new NewRelicBrowserErrorProvider(configWithUserId);
      
      // Call getErrors
      const errors = await provider.getErrors();
      
      // Verify the errors are mapped correctly with user count
      expect(errors).toHaveLength(1);
      expect((errors[0] as any).uniqueCount).toBe(5); // The uniqueCount property from the facet object
      expect(errors[0].countType).toBe(ErrorCountType.USERS);
    });

    it('should use default parameters when none provided', async () => {
      const mockErrorsResponse = {
        statusCode: 200,
        body: { facets: [] }
      };

      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          // Verify default values are used in the query
          expect(nrql).toContain('SINCE 24 hours ago');
          expect(nrql).toContain('LIMIT 1000');
          callback(null, mockErrorsResponse, mockErrorsResponse.body);
        }
      );

      const provider = new NewRelicBrowserErrorProvider(config);
      const errors = await provider.getErrors();
      
      expect(errors).toEqual([]);
    });

    it('should handle custom time period and limit', async () => {
      const mockErrorsResponse = {
        statusCode: 200,
        body: { facets: [] }
      };

      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          expect(nrql).toContain('SINCE 48 hours ago');
          expect(nrql).toContain('LIMIT 500');
          callback(null, mockErrorsResponse, mockErrorsResponse.body);
        }
      );

      const provider = new NewRelicBrowserErrorProvider(config);
      await provider.getErrors(48, 500);
    });

    it('should construct correct NRQL query for browser errors', async () => {
      const mockErrorsResponse = {
        statusCode: 200,
        body: { facets: [] }
      };

      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          // Verify browser-specific query structure
          expect(nrql).toContain('FROM JavaScriptError');
          expect(nrql).toContain('FACET `errorMessage`');
          expect(nrql).toContain('uniques(mixpanelId)');
          expect(nrql).toContain('uniques(entityGuid)');
          expect(nrql).not.toContain('User-Agent'); // Browser errors don't filter by User-Agent
          callback(null, mockErrorsResponse, mockErrorsResponse.body);
        }
      );

      const provider = new NewRelicBrowserErrorProvider(config);
      await provider.getErrors();
    });

    it('should handle multiple errors in response', async () => {
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

      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          callback(null, mockErrorsResponse, mockErrorsResponse.body);
        }
      );

      const provider = new NewRelicBrowserErrorProvider(config);
      const errors = await provider.getErrors();
      
      expect(errors).toHaveLength(2);
      expect(errors[0].name).toBe('Error 1');
      expect(errors[0].count).toBe(5);
      expect(errors[1].name).toBe('Error 2');
      expect(errors[1].count).toBe(15);
    });

    it('should handle empty response', async () => {
      const mockErrorsResponse = {
        statusCode: 200,
        body: { facets: [] }
      };

      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          callback(null, mockErrorsResponse, mockErrorsResponse.body);
        }
      );

      const provider = new NewRelicBrowserErrorProvider(config);
      const errors = await provider.getErrors();
      
      expect(errors).toEqual([]);
    });

    it('should handle server errors (status > 500) by returning empty array', async () => {
      const mockErrorsResponse = {
        statusCode: 503,
        body: { error: 'Service Unavailable' }
      };

      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          callback(null, mockErrorsResponse, mockErrorsResponse.body);
        }
      );

      const provider = new NewRelicBrowserErrorProvider(config);
      const errors = await provider.getErrors();
      
      expect(errors).toEqual([]);
    });

    it('should reject on API errors', async () => {
      const apiError = new Error('API Error');

      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          callback(apiError, null, null);
        }
      );

      const provider = new NewRelicBrowserErrorProvider(config);
      
      await expect(provider.getErrors()).rejects.toThrow('API Error');
    });

    it('should reject on response body errors', async () => {
      const mockErrorsResponse = {
        statusCode: 200,
        body: { error: 'Invalid query' }
      };

      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          callback(null, mockErrorsResponse, mockErrorsResponse.body);
        }
      );

      const provider = new NewRelicBrowserErrorProvider(config);
      
      await expect(provider.getErrors()).rejects.toBe('Invalid query');
    });

    it('should reject on non-200 status codes (excluding server errors)', async () => {
      const mockErrorsResponse = {
        statusCode: 400,
        body: { message: 'Bad Request' }
      };

      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          callback(null, mockErrorsResponse, mockErrorsResponse.body);
        }
      );

      const provider = new NewRelicBrowserErrorProvider(config);
      
      await expect(provider.getErrors()).rejects.toEqual({ message: 'Bad Request' });
    });

    it('should set correct debug URL for browser errors', async () => {
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

      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          callback(null, mockErrorsResponse, mockErrorsResponse.body);
        }
      );

      const provider = new NewRelicBrowserErrorProvider(config);
      const errors = await provider.getErrors();
      
      expect(errors[0].debugUrl).toContain('one.newrelic.com');
      expect(errors[0].debugUrl).toContain('test-entity-guid');
      expect(errors[0].debugUrl).toContain('duration=86400000'); // 24 hours in ms
    });

    it('should handle missing mixpanelIds gracefully', async () => {
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
                { members: [] } // Empty mixpanel IDs
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

      const provider = new NewRelicBrowserErrorProvider(config);
      const errors = await provider.getErrors();
      
      expect(errors[0].mixpanelIds).toEqual([]);
    });

    it('should prioritize uniqueCount over count when available', async () => {
      const configWithUserId = {
        ...config,
        userIdField: 'userId'
      };

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

      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          callback(null, mockErrorsResponse, mockErrorsResponse.body);
        }
      );

      const provider = new NewRelicBrowserErrorProvider(configWithUserId);
      const errors = await provider.getErrors();
      
      // Should use uniqueCount (25) instead of count (100)
      expect(errors[0].count).toBe(25);
      expect(errors[0].countType).toBe(ErrorCountType.USERS);
    });

    it('should use transaction count when uniqueCount is 0', async () => {
      const configWithUserId = {
        ...config,
        userIdField: 'userId'
      };

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

      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          callback(null, mockErrorsResponse, mockErrorsResponse.body);
        }
      );

      const provider = new NewRelicBrowserErrorProvider(configWithUserId);
      const errors = await provider.getErrors();
      
      // Should fall back to transaction count (50) when uniqueCount is 0
      expect(errors[0].count).toBe(50);
      expect(errors[0].countType).toBe(ErrorCountType.TRX);
    });
  });
}); 
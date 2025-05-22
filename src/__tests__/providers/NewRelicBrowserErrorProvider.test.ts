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

  describe('getAppIdToEntityGuidMap', () => {
    it('should fetch and cache the appId to entityGuid map', async () => {
      // Mock the newrelic API response for the map query
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

      // Setup the mock implementation
      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          // Check if this is the map query
          if (nrql.includes('uniques(entityGuid') && nrql.includes('uniques(appId')) {
            callback(null, mockMapResponse, mockMapResponse.body);
          }
        }
      );

      // Create provider instance
      const provider = new NewRelicBrowserErrorProvider(config);
      
      // Access the private method using type assertion
      const getMapMethod = (provider as any).getAppIdToEntityGuidMap.bind(provider);
      
      // Call the method
      const map1 = await getMapMethod();
      
      // Verify the map contains the expected entries
      expect(map1.get(123)).toBe('guid-123');
      expect(map1.get(456)).toBe('guid-456');
      
      // Verify the API was called once
      expect(newrelicApi.insights.query).toHaveBeenCalledTimes(1);
      
      // Call the method again - should use cached result
      const map2 = await getMapMethod();
      
      // Verify the API was still only called once (using cache)
      expect(newrelicApi.insights.query).toHaveBeenCalledTimes(1);
      
      // Verify the maps are the same instance
      expect(map2).toBe(map1);
    });

    it('should handle API errors when fetching the map', async () => {
      // Mock the newrelic API to return an error
      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          callback(new Error('API Error'), null, null);
        }
      );

      // Create provider instance
      const provider = new NewRelicBrowserErrorProvider(config);
      
      // Access the private method using type assertion
      const getMapMethod = (provider as any).getAppIdToEntityGuidMap.bind(provider);
      
      // Call the method and expect it to throw
      await expect(getMapMethod()).rejects.toThrow('API Error');
      
      // Verify the API was called
      expect(newrelicApi.insights.query).toHaveBeenCalledTimes(1);
      
      // Mock a successful response for the next call
      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          callback(null, { statusCode: 200, body: { results: [{ events: [] }] } }, { results: [{ events: [] }] });
        }
      );
      
      // Call the method again - should retry since previous call failed
      await getMapMethod();
      
      // Verify the API was called again
      expect(newrelicApi.insights.query).toHaveBeenCalledTimes(2);
    });

    it('should reuse in-progress promise when multiple calls are made', async () => {
      // Create a delayed mock response
      let resolvePromise: (value: void) => void;
      const delayPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      // Mock the newrelic API with a delayed response
      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          // Wait for the promise to resolve before calling back
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
        }
      );

      // Create provider instance
      const provider = new NewRelicBrowserErrorProvider(config);
      
      // Access the private method using type assertion
      const getMapMethod = (provider as any).getAppIdToEntityGuidMap.bind(provider);
      
      // Start two concurrent calls
      const promise1 = getMapMethod();
      const promise2 = getMapMethod();
      
      // Resolve the delay
      resolvePromise();
      
      // Wait for both promises
      const [map1, map2] = await Promise.all([promise1, promise2]);
      
      // Verify the API was only called once
      expect(newrelicApi.insights.query).toHaveBeenCalledTimes(1);
      
      // Verify both calls returned the same map
      expect(map1).toBe(map2);
      expect(map1.get(123)).toBe('guid-123');
    });
  });

  describe('getErrors', () => {
    it('should fetch errors and map them correctly', async () => {
      // Mock the map query response
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

      // Mock the errors query response
      const mockErrorsResponse = {
        statusCode: 200,
        body: {
          metadata: {
            contents: {
              contents: [
                {
                  alias: 'count'
                },
                {
                  alias: 'appId',
                },
              ]
            }
          },
          facets: [
            {
              name: 'Test Error',
              results: [
                {
                  count: 10,
                },
                {
                  appId: 123
                }
              ]
            }
          ]
        }
      };

      // Setup the mock implementation
      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          // Check which query is being made
          if (nrql.includes('uniques(entityGuid') && nrql.includes('uniques(appId')) {
            callback(null, mockMapResponse, mockMapResponse.body);
          } else if (nrql.includes('FROM JavaScriptError')) {
            callback(null, mockErrorsResponse, mockErrorsResponse.body);
          }
        }
      );

      // Create provider instance
      const provider = new NewRelicBrowserErrorProvider(config);
      
      // Create a map with the test data
      const mockMap = new Map([[123, 'guid-123']]);
      
      // Mock the getAppIdToEntityGuidMap method to return our mock map
      jest.spyOn(provider as any, 'getAppIdToEntityGuidMap').mockResolvedValue(mockMap);
      
      // Also set the map directly to ensure it's available
      (provider as any).appIdToEntityGuid = mockMap;
      
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

      // Mock the map query response
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

      // Mock the errors query response with user count
      const mockErrorsResponse = {
        statusCode: 200,
        body: {
          facets: [
            {
              name: 'Test Error',
              results: [
                {
                  count: 10,
                },
                {
                  appId: 123,
                },
                {
                  uniqueCount: 5
                }
              ]
            }
          ]
        }
      };

      // Setup the mock implementation
      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          // Check which query is being made
          if (nrql.includes('uniques(entityGuid') && nrql.includes('uniques(appId')) {
            callback(null, mockMapResponse, mockMapResponse.body);
          } else if (nrql.includes('FROM JavaScriptError')) {
            // Verify that the userIdField is included in the query
            expect(nrql).toContain('uniqueCount(userId)');
            callback(null, mockErrorsResponse, mockErrorsResponse.body);
          }
        }
      );

      // Create provider instance
      const provider = new NewRelicBrowserErrorProvider(configWithUserId);
      
      // Mock the appIdToEntityGuid map
      (provider as any).appIdToEntityGuid = new Map([[123, 'guid-123']]);
      
      // Manually set the uniqueCount property to simulate the provider's behavior
      const mockUniqueCount = 5;
      
      // Override the insights.query implementation to set uniqueCount
      (newrelicApi.insights.query as jest.Mock).mockImplementation(
        (nrql, appConfigId, callback) => {
          if (nrql.includes('uniques(entityGuid') && nrql.includes('uniques(appId')) {
            callback(null, mockMapResponse, mockMapResponse.body);
          } else if (nrql.includes('FROM JavaScriptError')) {
            // Create a modified response with uniqueCount
            const modifiedResponse = JSON.parse(JSON.stringify(mockErrorsResponse));
            // Add the uniqueCount property that the implementation expects
            modifiedResponse.body.facets[0].uniqueCount = mockUniqueCount;
            callback(null, modifiedResponse, modifiedResponse.body);
          }
        }
      );
      
      // Call getErrors
      const errors = await provider.getErrors();
      
      // Verify the errors are mapped correctly with user count
      expect(errors).toHaveLength(1);
      expect(errors[0]['uniqueCount(userId)']).toBe(5); // The uniqueCount property from the response
      expect((errors[0] as any).uniqueCount).toBe(5); // The uniqueCount property that the implementation uses
      expect(errors[0].countType).toBe(ErrorCountType.USERS);
    });
  });
}); 
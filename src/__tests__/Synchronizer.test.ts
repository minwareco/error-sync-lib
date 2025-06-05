import { Synchronizer, SynchronizerConfig, SynchronizerErrorProviderConfig } from '../Synchronizer';
import { Error, ErrorType, ErrorCountType, Ticket, TicketContent, Alert, AlertContent, CacheName, ErrorGroup } from '../models';
import { 
  ErrorProviderInterface, 
  TicketProviderInterface, 
  AlertProviderInterface, 
  CacheProviderInterface 
} from '../interfaces';

// Mock implementations for testing
class MockErrorProvider implements ErrorProviderInterface {
  private errors: Error[] = [];

  setErrors(errors: Error[]) {
    this.errors = errors;
  }

  async getErrors(hoursBack: number, limit: number): Promise<Error[]> {
    return this.errors;
  }
}

class MockTicketProvider implements TicketProviderInterface {
  async findTicket(clientId: string): Promise<Ticket | null> { 
    return null; 
  }
  
  async createTicket(content: TicketContent): Promise<Ticket> { 
    return { 
      ...content,
      id: '123', 
      url: 'http://test.com', 
      isOpen: true, 
      resolutionDate: undefined 
    }; 
  }
  
  async updateTicket(ticket: Ticket): Promise<Ticket> { 
    return ticket; 
  }
  
  async reopenTicket(ticket: Ticket): Promise<Ticket> { 
    return ticket; 
  }
  
  async generateTicketContent(errorGroup: ErrorGroup): Promise<TicketContent> { 
    return { 
      clientId: errorGroup.clientId,
      summary: 'Test', 
      description: 'Test Description',
      priority: 'P3',
      labels: [],
      ticketType: 'bug'
    }; 
  }
}

class MockAlertProvider implements AlertProviderInterface {
  async findAlert(clientId: string): Promise<Alert | null> { 
    return null; 
  }
  
  async createAlert(content: AlertContent): Promise<Alert> { 
    return { 
      ...content,
      id: '123'
    }; 
  }
  
  async updateAlert(alert: Alert): Promise<Alert> { 
    return alert; 
  }
  
  async closeAlert(alert: Alert): Promise<void> { 
    return; 
  }
  
  async generateAlertContent(errorGroup: ErrorGroup): Promise<AlertContent> { 
    return { 
      clientId: errorGroup.clientId,
      summary: 'Test Alert', 
      description: 'Test Alert Description', 
      priority: 'P3', 
      ticketUrl: '',
      labels: [],
      status: 'open'
    }; 
  }
}

class MockCacheProvider implements CacheProviderInterface {
  async getObject<T>(key: string, cacheName: CacheName): Promise<T | null> { 
    return null; 
  }
  
  async setObject<T>(key: string, value: T, cacheName: CacheName, persist: boolean): Promise<void> { 
    return; 
  }
  
  async saveAllCaches(): Promise<void> { 
    return; 
  }
  
  async clearAllCaches(): Promise<void> { 
    return; 
  }
}

describe('Synchronizer', () => {
  let mockErrorProvider: MockErrorProvider;
  let mockTicketProvider: MockTicketProvider;
  let mockAlertProvider: MockAlertProvider;
  let mockCacheProvider: MockCacheProvider;
  let config: SynchronizerConfig;

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
    it('should handle merging errors with undefined mixpanelIds', async () => {
      // Create two errors with the same name (will be grouped) where one has undefined mixpanelIds
      const errorWithMixpanelIds: Error = {
        name: 'JavaScript Error: Cannot read property',
        type: ErrorType.BROWSER,
        count: 3,
        countType: ErrorCountType.USERS,
        mixpanelIds: ['user1', 'user2'],
        countPeriodHours: 24,
      };

      const errorWithUndefinedMixpanelIds: Error = {
        name: 'JavaScript Error: Cannot read property', // Same name - will trigger merge
        type: ErrorType.BROWSER,
        count: 2,
        countType: ErrorCountType.USERS,
        // mixpanelIds is intentionally undefined
        countPeriodHours: 24,
      };

      mockErrorProvider.setErrors([errorWithMixpanelIds, errorWithUndefinedMixpanelIds]);

      const synchronizer = new Synchronizer(config);
      const result = await synchronizer.run();

      // Should succeed now that we handle undefined mixpanelIds properly
      expect(result.exitCode).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.completedErrorGroups).toHaveLength(1);
      
      // Verify the merged mixpanelIds contains only the defined values
      const errorGroup = result.completedErrorGroups[0];
      expect(errorGroup.mixpanelIds).toEqual(['user1', 'user2']);
      expect(errorGroup.instances).toHaveLength(2);
    });

    it('should handle both errors having undefined mixpanelIds', async () => {
      // Two errors with same name, both with undefined mixpanelIds
      const error1: Error = {
        name: 'Network Error: Timeout',
        type: ErrorType.CLIENT,
        count: 5,
        countType: ErrorCountType.TRX,
        // mixpanelIds undefined
        countPeriodHours: 24,
      };

      const error2: Error = {
        name: 'Network Error: Timeout', // Same name - will trigger merge
        type: ErrorType.CLIENT,
        count: 3,
        countType: ErrorCountType.TRX,
        // mixpanelIds undefined
        countPeriodHours: 24,
      };

      mockErrorProvider.setErrors([error1, error2]);

      const synchronizer = new Synchronizer(config);
      const result = await synchronizer.run();

      // Should succeed with empty mixpanelIds array
      expect(result.exitCode).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.completedErrorGroups).toHaveLength(1);
      
      // Verify the merged mixpanelIds is an empty array
      const errorGroup = result.completedErrorGroups[0];
      expect(errorGroup.mixpanelIds).toEqual([]);
      expect(errorGroup.instances).toHaveLength(2);
    });

    it('should merge defined and undefined mixpanelIds correctly', async () => {
      // Test case with mixed scenarios
      const errorWithIds: Error = {
        name: 'Database Connection Failed',
        type: ErrorType.SERVER,
        count: 4,
        countType: ErrorCountType.TRX,
        mixpanelIds: ['session1', 'session2'],
        countPeriodHours: 24,
      };

      const errorWithoutIds: Error = {
        name: 'Database Connection Failed', // Same name
        type: ErrorType.SERVER,
        count: 2,
        countType: ErrorCountType.TRX,
        // mixpanelIds undefined
        countPeriodHours: 24,
      };

      const errorWithMoreIds: Error = {
        name: 'Database Connection Failed', // Same name
        type: ErrorType.SERVER,
        count: 1,
        countType: ErrorCountType.TRX,
        mixpanelIds: ['session2', 'session3'], // Some overlap, some new
        countPeriodHours: 24,
      };

      mockErrorProvider.setErrors([errorWithIds, errorWithoutIds, errorWithMoreIds]);

      const synchronizer = new Synchronizer(config);
      const result = await synchronizer.run();

      expect(result.exitCode).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.completedErrorGroups).toHaveLength(1);
      
      // Verify the merged mixpanelIds contains unique values from all defined arrays
      const errorGroup = result.completedErrorGroups[0];
      expect(errorGroup.mixpanelIds).toEqual(expect.arrayContaining(['session1', 'session2', 'session3']));
      expect(errorGroup.mixpanelIds).toHaveLength(3); // Should be unique
      expect(errorGroup.instances).toHaveLength(3);
    });
  });
}); 
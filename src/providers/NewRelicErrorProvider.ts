import { Error, ErrorCountType, ErrorType } from '../models';
import { ErrorProviderInterface } from '../interfaces';
import newrelicApi from 'newrelic-api-client';

export enum NewRelicErrorProviderType {
  SERVER = 'server',
  BROWSER = 'browser'
}

export type NewRelicErrorProviderConfig = {
  accountId: string,
  appName: string,
  appConfigId: string,
  type: NewRelicErrorProviderType,
  includeHosts?: [string],
  excludeHosts?: [string],
  excludeUserAgents?: [string],
  userIdField?: string
}

type FieldConfiguration = {
  name: string,
  nrql: string,
  resultProperty: string,
}

const fieldConfiguration: Record<string, FieldConfiguration> = {
  count: {
    name: 'count',
    nrql: 'count(*)',
    resultProperty: 'count',
  },
  mixpanelIds: {
    name: 'mixpanelIds',
    nrql: 'uniques(mixpanelId)',
    resultProperty: 'members',
  },
  uniqueCount: {
    name: 'uniqueCount',
    nrql: 'uniqueCount(userId)',
    resultProperty: 'uniqueCount',
  },
  appId: {
    name: 'appId',
    nrql: 'max(appId)',
    resultProperty: 'appId',
  },
}

type TableConfiguration = {
  tableName: string,
  facetField: string,
  errorType: ErrorType,
  includeUserAgentFilter: boolean,
  includeMixpanelIds: boolean,
}

const tableConfiguration: Record<NewRelicErrorProviderType, TableConfiguration> = {
  [NewRelicErrorProviderType.SERVER]: {
    tableName: 'TransactionError',
    facetField: 'error.message',
    errorType: ErrorType.SERVER,
    includeUserAgentFilter: true,
    includeMixpanelIds: false,
  },
  [NewRelicErrorProviderType.BROWSER]: {
    tableName: 'JavaScriptError',
    facetField: 'errorMessage',
    errorType: ErrorType.BROWSER,
    includeUserAgentFilter: false,
    includeMixpanelIds: true,
  },
}

export class NewRelicErrorProvider implements ErrorProviderInterface {
  private config: NewRelicErrorProviderConfig;
  private appIdToEntityGuid: Map<number, string> | null = null;
  private appIdToEntityGuidPromise: Promise<Map<number, string>> | null = null;

  public constructor(config: NewRelicErrorProviderConfig) {
    this.config = config;
  }

  /**
   * Gets the mapping of appId to entityGuid with instance-level caching
   * Only used for browser errors
   */
  private async getAppIdToEntityGuidMap(hoursBack = 25): Promise<Map<number, string>> {
    // Only needed for browser errors
    if (this.config.type !== NewRelicErrorProviderType.BROWSER) {
      return new Map();
    }

    // Return cached map if available
    if (this.appIdToEntityGuid) {
      return this.appIdToEntityGuid;
    }

    // Return in-progress promise if one exists
    if (this.appIdToEntityGuidPromise) {
      return this.appIdToEntityGuidPromise;
    }

    // Create and cache the promise
    this.appIdToEntityGuidPromise = this.fetchAppIdToEntityGuidMap(hoursBack);
    
    try {
      // Wait for the promise to resolve and cache the result
      const map = await this.appIdToEntityGuidPromise;
      this.appIdToEntityGuid = map;
      return map;
    } catch (error) {
      // Clear the promise cache on error so we can retry
      this.appIdToEntityGuidPromise = null;
      throw error;
    }
  }

  private async fetchAppIdToEntityGuidMap(hoursBack = 25): Promise<Map<number, string>> {
    const nrql = `SELECT uniques(entityGuid, 1000), uniques(appId, 1000) FROM JavaScriptError SINCE ${hoursBack} hours ago UNTIL now`;

    return new Promise((resolve, reject) => {
      newrelicApi.insights.query(nrql, this.config.appConfigId, (error, response, body) => {
        if (error) {
          return reject(error);
        } else if (response.statusCode !== 200) {
          return reject(response.body);
        } else if (response.statusCode > 500) {
          return resolve(new Map());
        } else if (response.body?.error) {
          return reject(response.body.error);
        }

        const map = new Map<number, string>();

        if (Array.isArray(body.results) && body.results.length > 0) {
          const events = body.results[0]?.events || [];
          events.forEach(event => {
            if (event.entityGuid && event.appId) {
              map.set(event.appId, event.entityGuid);
            }
          });
        }

        resolve(map);
      });
    });
  }

  private buildDebugUrl(appId: number, errorName: string, entityGuid?: string): string {
    if (this.config.type === NewRelicErrorProviderType.SERVER) {
      const filters = [{
        key: 'error.message',
        value: errorName,
        like: false
      }];
      const encodedFilters = encodeURIComponent(JSON.stringify(filters));
      return `https://rpm.newrelic.com/accounts/${this.config.accountId}/applications/${appId}/filterable_errors#/table?top_facet=transactionUiName&primary_facet=error.class&barchart=barchart&filters=${encodedFilters}`;
    } else {
      // Browser errors
      const hoursInMs = 24 * 3600000; // Default to 24 hours
      return `https://one.newrelic.com/nr1-core/errors-inbox/entity-inbox/${entityGuid}?duration=${hoursInMs}`;
    }
  }

  public async getErrors(hoursBack = 24, limit = 1000): Promise<Error[]> {
    const tableConfig = tableConfiguration[this.config.type];
    
    // Ensure we have the appId to entityGuid mapping for browser errors
    await this.getAppIdToEntityGuidMap(hoursBack + 1);

    // Build the field list based on configuration
    const fields = [
      fieldConfiguration.count,
      fieldConfiguration.appId,
    ];

    if (tableConfig.includeMixpanelIds) {
      fields.push(fieldConfiguration.mixpanelIds);
    }

    if (this.config.userIdField) {
      fields.push(fieldConfiguration.uniqueCount);
    }

    // Build the NRQL query with conditional filters
    let nrql = `
      SELECT ${fields.map(f => f.nrql).join(', ')}
      FROM ${tableConfig.tableName}
      WHERE \`appName\` = '${this.config.appName}'
    `;

    if (tableConfig.includeUserAgentFilter) {
      nrql += ` AND \`request.headers.User-Agent\` NOT LIKE '%Bot%'`;
    }

    nrql += `
      FACET \`${tableConfig.facetField}\`
      SINCE ${hoursBack} hours ago
      LIMIT ${limit}
    `;

    return new Promise((resolve, reject) => {
      newrelicApi.insights.query(nrql, this.config.appConfigId, (error, response, body) => {
        if (error) {
          return reject(error);
        } else if (response.statusCode != 200) {
          return reject(response.body);
        } else if (response.statusCode > 500) {
          return resolve([]);
        } else if (response.body.error) {
          return reject(response.body.error);
        }

        const errors = [];

        body.facets.forEach((newRelicError) => {
          // Map the query results to named properties
          newRelicError.results.forEach((row, index) => {
            const field = fields[index];
            newRelicError[field.name] = row[field.resultProperty];
          });

          // Set standard error properties
          newRelicError.type = tableConfig.errorType;
          newRelicError.count = (newRelicError.uniqueCount > 0 ? newRelicError.uniqueCount : newRelicError.count);
          newRelicError.countType = newRelicError.uniqueCount > 0 ? ErrorCountType.USERS : ErrorCountType.TRX;
          newRelicError.countPeriodHours = hoursBack;
          // This might not be set for all error so fallback to an empty array
          newRelicError.mixpanelIds ??= [];

          // Generate debug URL
          const appId = newRelicError.appId;
          const entityGuid = this.appIdToEntityGuid?.get(appId);
          newRelicError.debugUrl = this.buildDebugUrl(appId, newRelicError.name, entityGuid);

          errors.push(newRelicError);
        });

        resolve(errors);
      });
    });
  }
} 
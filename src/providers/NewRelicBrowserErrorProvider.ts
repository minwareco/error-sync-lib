import { Error, ErrorCountType, ErrorType } from '../models';
import { ErrorProviderInterface } from '../interfaces';
import newrelicApi from 'newrelic-api-client';

export type NewRelicBrowserErrorProviderConfig = {
  accountId: string,
  appName: string,
  appConfigId: string,
  includeHosts?: [string],
  excludedeHosts?: [string],
  excludeUserAgents?: [string],
  userIdField?: string
}

export class NewRelicBrowserErrorProvider implements ErrorProviderInterface {
  private config: NewRelicBrowserErrorProviderConfig;
  private appIdToEntityGuid: Map<number, string> | null = null;
  private appIdToEntityGuidPromise: Promise<Map<number, string>> | null = null;

  public constructor(config: NewRelicBrowserErrorProviderConfig) {
    this.config = config;
  }

  /**
   * Gets the mapping of appId to entityGuid with instance-level caching
   * @param hoursBack Number of hours to look back for data
   * @returns A map of appId to entityGuid
   */
  private async getAppIdToEntityGuidMap(hoursBack = 25): Promise<Map<number, string>> {
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

  // as of the time that this was added, it wasn't possible to get 
  // the entityGuid from the JavaScriptError table as part of an aggregate query
  // so we have to do a separate query to map appId to entityGuid
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

        // Build the map from appId -> entityGuid
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

  public async getErrors(hoursBack = 24, limit = 1000): Promise<Error[]> {
    // Ensure we have the appId to entityGuid mapping before proceeding
    await this.getAppIdToEntityGuidMap(hoursBack+1);

    const fields = ['count(*)', 'max(appId)'];
    if (this.config.userIdField) {
      fields.push(`uniqueCount(${this.config.userIdField})`);
    }

    const nrql = `
      SELECT ${fields.join(', ')}
      FROM JavaScriptError
      WHERE \`appName\` = '${this.config.appName}'
      FACET \`errorMessage\`
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
          newRelicError.results.forEach((row) => {
            // convert each row into a property to produce a cleaner object that is easier to use
            for (const prop in row) {
              newRelicError[prop] = row[prop];
            }

            // determine other standard error properties from the native error
            newRelicError.type = ErrorType.BROWSER;
            newRelicError.count = (newRelicError.uniqueCount > 0 ? newRelicError.uniqueCount : newRelicError.count);
            newRelicError.countType = newRelicError.uniqueCount > 0 ? ErrorCountType.USERS : ErrorCountType.TRX;
            newRelicError.countPeriodHours = hoursBack;
          });

          // we need to map the appId to the entityGuid to produce a debug Url
          const entityGuid = this.appIdToEntityGuid?.get(newRelicError.max);

          // TODO: possibly fix this, but NewRelic does not have any documented way to produce a link which
          // points at an error directly anymore...
          newRelicError.debugUrl = `https://one.newrelic.com/nr1-core/errors-inbox/entity-inbox/${entityGuid}?duration=${hoursBack * 3600000}`;

          errors.push(newRelicError);
        });

        resolve(errors);
      });
    });
  }
}

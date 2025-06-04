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
    resultProperty: 'max',
  },
  entityGuid: {
    name: 'entityGuid',
    nrql: 'uniques(entityGuid)',
    resultProperty: 'members',
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

  public constructor(config: NewRelicErrorProviderConfig) {
    this.config = config;
  }

  private buildDebugUrl(appId: number, errorName: string, entityGuid?: string): string {
    // Browser errors
    const hoursInMs = 24 * 3600000; // Default to 24 hours
    if (this.config.type === NewRelicErrorProviderType.SERVER) {
      const filters = [{
        key: 'error.message',
        value: errorName,
        like: false
      }];
      const encodedFilters = encodeURIComponent(JSON.stringify(filters));
      return `https://rpm.newrelic.com/accounts/${this.config.accountId}/applications/${appId}/filterable_errors#/table?top_facet=transactionUiName&primary_facet=error.class&barchart=barchart&filters=${encodedFilters}&duration=${hoursInMs}`;
    } else {
      return `https://one.newrelic.com/nr1-core/errors-inbox/entity-inbox/${entityGuid}?duration=${hoursInMs}`;
    }
  }

  public async getErrors(hoursBack = 24, limit = 1000): Promise<Error[]> {
    const tableConfig = tableConfiguration[this.config.type];

    // Build the field list based on configuration
    const fields = [
      fieldConfiguration.count,
      fieldConfiguration.appId,
      fieldConfiguration.entityGuid,
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
        } else if (response.statusCode > 500) {
          return resolve([]);
        } else if (response.body.error) {
          return reject(response.body.error);
        } else if (response.statusCode != 200) {
          return reject(response.body);
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
          newRelicError.debugUrl = this.buildDebugUrl(appId, newRelicError.name, newRelicError.entityGuid[0]);

          errors.push(newRelicError);
        });

        resolve(errors);
      });
    });
  }
} 
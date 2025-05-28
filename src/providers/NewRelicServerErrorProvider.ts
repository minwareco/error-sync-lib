import { Error, ErrorCountType, ErrorType } from '../models';
import { ErrorProviderInterface } from '../interfaces';
import newrelicApi from 'newrelic-api-client';

export type NewRelicServerErrorProviderConfig = {
  accountId: string,
  appName: string,
  appConfigId: string,
  includeHosts?: [string],
  excludedeHosts?: [string],
  excludeUserAgents?: [string],
  userIdField?: string
}

const newrelicFunctionToResultMap = {
  'count': 'count',
  'max': 'max',
}

export class NewRelicServerErrorProvider implements ErrorProviderInterface {
  private config: NewRelicServerErrorProviderConfig;
  private newrelicApi: any;

  public constructor(config: NewRelicServerErrorProviderConfig) {
    this.config = config;
  }

  public async getErrors(hoursBack= 24, limit = 1000): Promise<Error[]> {
    // The aliases are required to be used in the results.
    const fields = ['count(*) as count', 'max(appId) as max'];
    if (this.config.userIdField) {
      fields.push(`uniqueCount(${this.config.userIdField}) as uniqueCount`);
    }

    const nrql = `
      SELECT ${fields.join(', ')}
      FROM TransactionError
      WHERE \`appName\` = '${this.config.appName}'
      AND \`request.headers.User-Agent\` NOT LIKE '%Bot%'
      FACET \`error.message\`
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

        const resultIndexToNameMap = body.metadata.contents.contents.reduce((acc, curr, index) => {
          acc[index] = curr.alias;
          return acc;
        }, {} as Record<number, string>);

        const resultIndexToFunctionMap = body.metadata.contents.contents.reduce((acc, curr, index) => {
          acc[index] = newrelicFunctionToResultMap[curr.contents.function];
          return acc;
        }, {} as Record<number, string>)

        body.facets.forEach((newRelicError) => {
          newRelicError.results.forEach((row, index) => {
            // Add the alias names directly to the object. The names on the results are tied to 
            // name of the function used to produce the result but is not always the same so
            // always double check when making changes here.
            newRelicError[resultIndexToNameMap[index]] = row[resultIndexToFunctionMap[index]];

            // determine other standard error properties from the native error
            newRelicError.type = ErrorType.SERVER;
            newRelicError.count = (newRelicError.uniqueCount > 0 ? newRelicError.uniqueCount : newRelicError.count);
            newRelicError.countType = newRelicError.uniqueCount > 0 ? ErrorCountType.USERS : ErrorCountType.TRX;
            newRelicError.countPeriodHours = hoursBack;
          });

          // produce a debug URL that can be used to visualize the error in a browser
          const appId = newRelicError.max;
          const filters = [{
            key: 'error.message',
            value: newRelicError.name,
            like: false
          }];
          const encodedFilters = encodeURIComponent(JSON.stringify(filters));
          newRelicError.debugUrl = `https://rpm.newrelic.com/accounts/${this.config.accountId}/applications/${appId}/filterable_errors#/table?top_facet=transactionUiName&primary_facet=error.class&barchart=barchart&filters=${encodedFilters}`;

          errors.push(newRelicError);
        });

        resolve(errors);
      });
    });
  }
}

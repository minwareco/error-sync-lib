import { Error, ErrorCountType, ErrorType } from '../models';
import { ErrorProviderInterface } from "../interfaces";

export type NewRelicServerErrorProviderConfig = {
  appName: string,
  includeHosts?: [string],
  excludedeHosts?: [string],
  excludeUserAgents?: [string],
  userIdField?: string
}

export class NewRelicServerErrorProvider implements ErrorProviderInterface {
  private config: NewRelicServerErrorProviderConfig;
  private newrelicApi: any;

  public constructor(config: NewRelicServerErrorProviderConfig) {
    this.config = config;
    this.newrelicApi = require('newrelic-api-client');
  }

  public async getErrors(hoursBack: number = 24, limit: number = 1000): Promise<Error[]> {
    // TODO: get application ID
    const configId = 'NewRelicApi';
    const nrql = `
      SELECT count(*), uniqueCount(COL_userId), max(appId)
      FROM TransactionError
      WHERE \`request.headers.host\` LIKE '%'
      AND \`request.headers.User-Agent\` NOT LIKE '%Bot%'
      FACET \`error.message\`
      SINCE 1 day ago
      LIMIT 1000
    `;

    return new Promise((resolve, reject) => {
      this.newrelicApi.insights.query(nrql, configId, (error, response, body) => {
        if (error) {
          return reject(error);
        } else if (response.statusCode != 200) {
          return reject(response.body);
        } else if (response.statusCode > 500) {
          return resolve([]);
        } else if (response.body.error) {
          return reject(body.error);
        }

        const errors = [];

        body.facets.forEach((newRelicError) => {
          newRelicError.results.forEach((row) => {
            // convert each row into a property to produce a cleaner object that is easier to use
            for (let prop in row) {
              newRelicError[prop] = row[prop];
            }

            // determine other standard error properties from the native error
            newRelicError.type = ErrorType.SERVER;
            newRelicError.count = (newRelicError.uniqueCount > 0 ? newRelicError.uniqueCount : newRelicError.count);
            newRelicError.countType = newRelicError.uniqueCount > 0 ? ErrorCountType.USERS : ErrorCountType.TRX;
          });

          // produce a debug URL that can be used to visualize the error in a browser
          const appId = newRelicError.max;
          const filters = [{
            key: 'error.message',
            value: newRelicError.name,
            like: false
          }];
          const encodedFilters = encodeURIComponent(JSON.stringify(filters));
          newRelicError.debugUrl = `https://rpm.newrelic.com/accounts/${appId}/applications/${newRelicError.max}/filterable_errors#/table?top_facet=transactionUiName&primary_facet=error.class&barchart=barchart&filters=${encodedFilters}`;

          errors.push(newRelicError);
        });

        resolve(errors);
      });
    });
  }
}

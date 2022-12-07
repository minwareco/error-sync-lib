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
  private newrelicApi: any;

  public constructor(config: NewRelicBrowserErrorProviderConfig) {
    this.config = config;
  }

  public async getErrors(hoursBack = 24, limit = 1000): Promise<Error[]> {
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
      LIMIT 1
    `;

    console.log('NRQL = ' + nrql);

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

          // produce a debug URL that can be used to visualize the error in a browser
          const appId = newRelicError.max;

          // TODO: possibly fix this, but NewRelic does not have any documented way to produce a link which
          //       points at an error directly anymore...
          // const filters = [{
          //   key: 'errorMessage',
          //   value: newRelicError.name,
          //   like: false
          // }];
          // const encodedFilters = encodeURIComponent(JSON.stringify(filters));
          // newRelicError.debugUrl = `https://rpm.newrelic.com/accounts/${this.config.accountId}/browser/${appId}/errors#/table?top_facet=pageUrl&primary_facet=errorClass&barchart=barchart&filters=${encodedFilters}`;
          newRelicError.debugUrl = `https://rpm.newrelic.com/accounts/${this.config.accountId}/browser/${appId}/errors`;

          errors.push(newRelicError);
        });

        resolve(errors);
      });
    });
  }
}

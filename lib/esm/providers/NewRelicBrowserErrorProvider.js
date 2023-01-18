var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { ErrorCountType, ErrorType } from '../models';
import newrelicApi from 'newrelic-api-client';
export class NewRelicBrowserErrorProvider {
    constructor(config) {
        this.config = config;
    }
    getErrors(hoursBack = 24, limit = 1000) {
        return __awaiter(this, void 0, void 0, function* () {
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
                    }
                    else if (response.statusCode != 200) {
                        return reject(response.body);
                    }
                    else if (response.statusCode > 500) {
                        return resolve([]);
                    }
                    else if (response.body.error) {
                        return reject(response.body.error);
                    }
                    const errors = [];
                    body.facets.forEach((newRelicError) => {
                        newRelicError.results.forEach((row) => {
                            for (const prop in row) {
                                newRelicError[prop] = row[prop];
                            }
                            newRelicError.type = ErrorType.BROWSER;
                            newRelicError.count = (newRelicError.uniqueCount > 0 ? newRelicError.uniqueCount : newRelicError.count);
                            newRelicError.countType = newRelicError.uniqueCount > 0 ? ErrorCountType.USERS : ErrorCountType.TRX;
                            newRelicError.countPeriodHours = hoursBack;
                        });
                        const appId = newRelicError.max;
                        newRelicError.debugUrl = `https://rpm.newrelic.com/accounts/${this.config.accountId}/browser/${appId}/errors`;
                        errors.push(newRelicError);
                    });
                    resolve(errors);
                });
            });
        });
    }
}
//# sourceMappingURL=NewRelicBrowserErrorProvider.js.map
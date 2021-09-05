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
export class NewRelicServerErrorProvider {
    constructor(config) {
        this.config = config;
        this.newrelicApi = require('newrelic-api-client');
    }
    getErrors(hoursBack = 24, limit = 1000) {
        return __awaiter(this, void 0, void 0, function* () {
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
                    }
                    else if (response.statusCode != 200) {
                        return reject(response.body);
                    }
                    else if (response.statusCode > 500) {
                        return resolve([]);
                    }
                    else if (response.body.error) {
                        return reject(body.error);
                    }
                    const errors = [];
                    body.facets.forEach((newRelicError) => {
                        newRelicError.results.forEach((row) => {
                            for (let prop in row) {
                                newRelicError[prop] = row[prop];
                            }
                            newRelicError.type = ErrorType.SERVER;
                            newRelicError.count = (newRelicError.uniqueCount > 0 ? newRelicError.uniqueCount : newRelicError.count);
                            newRelicError.countType = newRelicError.uniqueCount > 0 ? ErrorCountType.USERS : ErrorCountType.TRX;
                        });
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
        });
    }
}
//# sourceMappingURL=NewRelicServerErrorProvider.js.map
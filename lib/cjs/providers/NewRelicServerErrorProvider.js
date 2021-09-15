"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewRelicServerErrorProvider = void 0;
const models_1 = require("../models");
const newrelic_api_client_1 = __importDefault(require("newrelic-api-client"));
class NewRelicServerErrorProvider {
    constructor(config) {
        this.config = config;
    }
    getErrors(hoursBack = 24, limit = 1000) {
        return __awaiter(this, void 0, void 0, function* () {
            const nrql = `
      SELECT count(*), uniqueCount(COL_userId), max(appId)
      FROM TransactionError
      WHERE \`request.headers.host\` LIKE '%'
      AND \`request.headers.User-Agent\` NOT LIKE '%Bot%'
      FACET \`error.message\`
      SINCE ${hoursBack} hours ago
      LIMIT ${limit}
    `;
            return new Promise((resolve, reject) => {
                newrelic_api_client_1.default.insights.query(nrql, this.config.appConfigId, (error, response, body) => {
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
                            for (const prop in row) {
                                newRelicError[prop] = row[prop];
                            }
                            newRelicError.type = models_1.ErrorType.SERVER;
                            newRelicError.count = (newRelicError.uniqueCount > 0 ? newRelicError.uniqueCount : newRelicError.count);
                            newRelicError.countType = newRelicError.uniqueCount > 0 ? models_1.ErrorCountType.USERS : models_1.ErrorCountType.TRX;
                            newRelicError.countPeriodHours = hoursBack;
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
exports.NewRelicServerErrorProvider = NewRelicServerErrorProvider;
//# sourceMappingURL=NewRelicServerErrorProvider.js.map
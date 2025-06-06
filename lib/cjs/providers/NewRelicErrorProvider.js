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
exports.NewRelicErrorProvider = exports.NewRelicErrorProviderType = void 0;
const models_1 = require("../models");
const newrelic_api_client_1 = __importDefault(require("newrelic-api-client"));
var NewRelicErrorProviderType;
(function (NewRelicErrorProviderType) {
    NewRelicErrorProviderType["SERVER"] = "server";
    NewRelicErrorProviderType["BROWSER"] = "browser";
})(NewRelicErrorProviderType = exports.NewRelicErrorProviderType || (exports.NewRelicErrorProviderType = {}));
const fieldConfiguration = {
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
};
const tableConfiguration = {
    [NewRelicErrorProviderType.SERVER]: {
        tableName: 'TransactionError',
        facetField: 'error.message',
        errorType: models_1.ErrorType.SERVER,
        includeUserAgentFilter: true,
        includeMixpanelIds: false,
    },
    [NewRelicErrorProviderType.BROWSER]: {
        tableName: 'JavaScriptError',
        facetField: 'errorMessage',
        errorType: models_1.ErrorType.BROWSER,
        includeUserAgentFilter: false,
        includeMixpanelIds: true,
    },
};
class NewRelicErrorProvider {
    constructor(config) {
        this.config = config;
    }
    buildDebugUrl(appId, errorName, entityGuid) {
        const hoursInMs = 24 * 3600000;
        if (this.config.type === NewRelicErrorProviderType.SERVER) {
            const filters = [{
                    key: 'error.message',
                    value: errorName,
                    like: false
                }];
            const encodedFilters = encodeURIComponent(JSON.stringify(filters));
            return `https://rpm.newrelic.com/accounts/${this.config.accountId}/applications/${appId}/filterable_errors#/table?top_facet=transactionUiName&primary_facet=error.class&barchart=barchart&filters=${encodedFilters}&duration=${hoursInMs}`;
        }
        else {
            return `https://one.newrelic.com/nr1-core/errors-inbox/entity-inbox/${entityGuid}?duration=${hoursInMs}`;
        }
    }
    getErrors(hoursBack = 24, limit = 1000) {
        return __awaiter(this, void 0, void 0, function* () {
            const tableConfig = tableConfiguration[this.config.type];
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
                newrelic_api_client_1.default.insights.query(nrql, this.config.appConfigId, (error, response, body) => {
                    if (error) {
                        return reject(error);
                    }
                    else if (response.statusCode > 500) {
                        return resolve([]);
                    }
                    else if (response.body.error) {
                        return reject(response.body.error);
                    }
                    else if (response.statusCode != 200) {
                        return reject(response.body);
                    }
                    const errors = [];
                    body.facets.forEach((newRelicError) => {
                        var _a;
                        newRelicError.results.forEach((row, index) => {
                            const field = fields[index];
                            newRelicError[field.name] = row[field.resultProperty];
                        });
                        newRelicError.type = tableConfig.errorType;
                        newRelicError.count = (newRelicError.uniqueCount > 0 ? newRelicError.uniqueCount : newRelicError.count);
                        newRelicError.countType = newRelicError.uniqueCount > 0 ? models_1.ErrorCountType.USERS : models_1.ErrorCountType.TRX;
                        newRelicError.countPeriodHours = hoursBack;
                        (_a = newRelicError.mixpanelIds) !== null && _a !== void 0 ? _a : (newRelicError.mixpanelIds = []);
                        const appId = newRelicError.appId;
                        newRelicError.debugUrl = this.buildDebugUrl(appId, newRelicError.name, newRelicError.entityGuid[0]);
                        errors.push(newRelicError);
                    });
                    resolve(errors);
                });
            });
        });
    }
}
exports.NewRelicErrorProvider = NewRelicErrorProvider;
//# sourceMappingURL=NewRelicErrorProvider.js.map
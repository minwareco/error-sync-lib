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
        this.appIdToEntityGuid = null;
        this.appIdToEntityGuidPromise = null;
        this.config = config;
    }
    getAppIdToEntityGuidMap(hoursBack = 25) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.appIdToEntityGuid) {
                return this.appIdToEntityGuid;
            }
            if (this.appIdToEntityGuidPromise) {
                return this.appIdToEntityGuidPromise;
            }
            this.appIdToEntityGuidPromise = this.fetchAppIdToEntityGuidMap(hoursBack);
            try {
                const map = yield this.appIdToEntityGuidPromise;
                this.appIdToEntityGuid = map;
                return map;
            }
            catch (error) {
                this.appIdToEntityGuidPromise = null;
                throw error;
            }
        });
    }
    fetchAppIdToEntityGuidMap(hoursBack = 25) {
        return __awaiter(this, void 0, void 0, function* () {
            const nrql = `SELECT uniques(entityGuid, 1000), uniques(appId, 1000) FROM JavaScriptError SINCE ${hoursBack} hours ago UNTIL now`;
            return new Promise((resolve, reject) => {
                newrelicApi.insights.query(nrql, this.config.appConfigId, (error, response, body) => {
                    var _a, _b;
                    if (error) {
                        return reject(error);
                    }
                    else if (response.statusCode !== 200) {
                        return reject(response.body);
                    }
                    else if (response.statusCode > 500) {
                        return resolve(new Map());
                    }
                    else if ((_a = response.body) === null || _a === void 0 ? void 0 : _a.error) {
                        return reject(response.body.error);
                    }
                    const map = new Map();
                    if (Array.isArray(body.results) && body.results.length > 0) {
                        const events = ((_b = body.results[0]) === null || _b === void 0 ? void 0 : _b.events) || [];
                        events.forEach(event => {
                            if (event.entityGuid && event.appId) {
                                map.set(event.appId, event.entityGuid);
                            }
                        });
                    }
                    resolve(map);
                });
            });
        });
    }
    getErrors(hoursBack = 24, limit = 1000) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.getAppIdToEntityGuidMap(hoursBack + 1);
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
                        var _a;
                        newRelicError.results.forEach((row) => {
                            for (const prop in row) {
                                newRelicError[prop] = row[prop];
                            }
                            newRelicError.type = ErrorType.BROWSER;
                            newRelicError.count = (newRelicError.uniqueCount > 0 ? newRelicError.uniqueCount : newRelicError.count);
                            newRelicError.countType = newRelicError.uniqueCount > 0 ? ErrorCountType.USERS : ErrorCountType.TRX;
                            newRelicError.countPeriodHours = hoursBack;
                        });
                        const appId = newRelicError['max(appId)'];
                        const entityGuid = (_a = this.appIdToEntityGuid) === null || _a === void 0 ? void 0 : _a.get(appId);
                        newRelicError.debugUrl = `https://one.newrelic.com/nr1-core/errors-inbox/entity-inbox/${entityGuid}?duration=${hoursBack * 3600000}`;
                        errors.push(newRelicError);
                    });
                    resolve(errors);
                });
            });
        });
    }
}
//# sourceMappingURL=NewRelicBrowserErrorProvider.js.map
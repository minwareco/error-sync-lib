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
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3CacheProvider = void 0;
const models_1 = require("../models");
const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });
class S3CacheProvider {
    constructor() {
        this.caches = {};
    }
    getObject(id, cacheName) {
        return __awaiter(this, void 0, void 0, function* () {
            const cache = yield this.getCache(cacheName);
            return cache[id];
        });
    }
    setObject(id, value, cacheName, saveCache = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const cache = yield this.getCache(cacheName);
            cache[id] = value;
            if (saveCache) {
                return yield this.setCache(cacheName, cache);
            }
        });
    }
    saveAllCaches() {
        return __awaiter(this, void 0, void 0, function* () {
            for (const cacheName in this.caches) {
                yield this.setCache(models_1.CacheName[cacheName], this.caches[cacheName]);
            }
        });
    }
    getCache(name) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.caches.hasOwnProperty(name)) {
                const s3 = new AWS.S3();
                const params = {
                    Bucket: 'prod-errorsync-redpointops',
                    Key: `cache/${name}.json`,
                };
                this.caches[name] = yield new Promise((resolve, reject) => {
                    s3.getObject(params, (err, data) => {
                        if (err) {
                            return err.statusCode === 404 ? resolve({}) : reject(err);
                        }
                        return resolve(JSON.parse(data.Body.toString('utf-8')));
                    });
                });
            }
            return this.caches[name];
        });
    }
    setCache(name, data) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Saving', data);
            const s3 = new AWS.S3();
            const params = {
                Bucket: 'prod-errorsync-redpointops',
                Key: `cache/${name}.json`,
                Body: JSON.stringify(data),
                ContentType: 'application/json; charset=utf-8',
            };
            return new Promise((resolve, reject) => {
                s3.putObject(params, (err) => err ? reject(err) : resolve());
            });
        });
    }
}
exports.S3CacheProvider = S3CacheProvider;
//# sourceMappingURL=S3CacheProvider.js.map
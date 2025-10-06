"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3CacheProvider = void 0;
const models_1 = require("../models");
const aws_sdk_1 = __importDefault(require("aws-sdk"));
class S3CacheProvider {
    constructor(config) {
        this.caches = {};
        this.config = config;
        if (this.config.region) {
            aws_sdk_1.default.config.update({ region: this.config.region });
        }
    }
    async getObject(id, cacheName) {
        const cache = await this.getCache(cacheName);
        return cache[id];
    }
    async setObject(id, value, cacheName, saveCache = false) {
        const cache = await this.getCache(cacheName);
        cache[id] = value;
        if (saveCache) {
            return await this.setCache(cacheName, cache);
        }
    }
    async saveAllCaches() {
        for (const cacheName in this.caches) {
            await this.setCache(cacheName, this.caches[cacheName]);
        }
    }
    async clearAllCaches() {
        console.log('clearAllCaches()');
        for (const cacheName of Object.values(models_1.CacheName)) {
            await this.setCache(cacheName, {});
        }
    }
    async getCache(name) {
        if (!this.caches[name]) {
            const s3 = new aws_sdk_1.default.S3();
            const params = {
                Bucket: this.config.bucket,
                Key: `${this.config.keyPrefix}${name}.json`,
            };
            this.caches[name] = await new Promise((resolve, reject) => {
                s3.getObject(params, (err, data) => {
                    if (err) {
                        return err.statusCode === 404 ? resolve({}) : reject(err);
                    }
                    return resolve(JSON.parse(data.Body.toString('utf-8')));
                });
            });
        }
        return this.caches[name];
    }
    async setCache(name, data) {
        const s3 = new aws_sdk_1.default.S3();
        const params = {
            Bucket: this.config.bucket,
            Key: `${this.config.keyPrefix}${name}.json`,
            Body: JSON.stringify(data),
            ContentType: 'application/json; charset=utf-8',
        };
        await new Promise((resolve, reject) => {
            s3.putObject(params, (err) => err ? reject(err) : resolve());
        });
        this.caches[name] = data;
    }
}
exports.S3CacheProvider = S3CacheProvider;
//# sourceMappingURL=S3CacheProvider.js.map
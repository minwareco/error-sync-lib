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
                yield this.setCache(cacheName, this.caches[cacheName]);
            }
        });
    }
    clearAllCaches() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('clearAllCaches()');
            for (const cacheName of Object.values(models_1.CacheName)) {
                yield this.setCache(cacheName, {});
            }
        });
    }
    getCache(name) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.caches[name]) {
                const s3 = new aws_sdk_1.default.S3();
                const params = {
                    Bucket: this.config.bucket,
                    Key: `${this.config.keyPrefix}${name}.json`,
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
            const s3 = new aws_sdk_1.default.S3();
            const params = {
                Bucket: this.config.bucket,
                Key: `${this.config.keyPrefix}${name}.json`,
                Body: JSON.stringify(data),
                ContentType: 'application/json; charset=utf-8',
            };
            yield new Promise((resolve, reject) => {
                s3.putObject(params, (err) => err ? reject(err) : resolve());
            });
            this.caches[name] = data;
        });
    }
}
exports.S3CacheProvider = S3CacheProvider;
//# sourceMappingURL=S3CacheProvider.js.map
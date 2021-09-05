import { CacheName } from '../models';
import { CacheProviderInterface } from '../interfaces';
const AWS = require('aws-sdk');

AWS.config.update({region: 'us-east-1'});

export class S3CacheProvider implements CacheProviderInterface {
  private caches: object = {};

  public async getObject<T>(id: string, cacheName: CacheName): Promise<T> {
    const cache = await this.getCache(cacheName);
    return cache[id];
  }

  public async setObject<T>(id: string, value: T, cacheName: CacheName, saveCache = false): Promise<void> {
    const cache = await this.getCache(cacheName);
    cache[id] = value;

    if (saveCache) {
      return await this.setCache(cacheName, cache);
    }
  }

  public async saveAllCaches(): Promise<void> {
    for (const cacheName in this.caches) {
      await this.setCache(CacheName[cacheName], this.caches[cacheName]);
    }
  }

  private async getCache(name: CacheName): Promise<object> {
    if (!this.caches.hasOwnProperty(name)) {
      const s3 = new AWS.S3();
      const params = {
        Bucket: 'prod-errorsync-redpointops',
        Key: `cache/${name}.json`,
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

  private async setCache(name: CacheName, data: object): Promise<void> {
    console.log('Saving', data);
    const s3 = new AWS.S3();
    const params = {
      Bucket: 'prod-errorsync-redpointops',
      Key: `cache/${name}.json`,
      Body: JSON.stringify(data),
      ContentType: 'application/json; charset=utf-8',
    };

    return new Promise<void>((resolve, reject) => {
      s3.putObject(params, (err) => err ? reject(err) : resolve());
    });
  }
}

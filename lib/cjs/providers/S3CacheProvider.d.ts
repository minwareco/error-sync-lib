import { CacheName } from '../models';
import { CacheProviderInterface } from '../interfaces';
export declare type S3CacheProviderConfig = {
    region?: string;
    bucket: string;
    keyPrefix: string;
};
export declare class S3CacheProvider implements CacheProviderInterface {
    private config;
    private caches;
    constructor(config: S3CacheProviderConfig);
    getObject<T>(id: string, cacheName: CacheName): Promise<T>;
    setObject<T>(id: string, value: T, cacheName: CacheName, saveCache?: boolean): Promise<void>;
    saveAllCaches(): Promise<void>;
    private getCache;
    private setCache;
}

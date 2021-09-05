import { CacheName } from '../models';
import { CacheProviderInterface } from '../interfaces';
export declare class S3CacheProvider implements CacheProviderInterface {
    private caches;
    getObject<T>(id: string, cacheName: CacheName): Promise<T>;
    setObject<T>(id: string, value: T, cacheName: CacheName, saveCache?: boolean): Promise<void>;
    saveAllCaches(): Promise<void>;
    private getCache;
    private setCache;
}

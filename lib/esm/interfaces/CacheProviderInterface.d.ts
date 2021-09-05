import { CacheName } from '../models';
export interface CacheProviderInterface {
    getObject<T>(id: string, cacheName: CacheName): Promise<T>;
    setObject<T>(id: string, value: T, cacheName: CacheName, saveCache: boolean): Promise<void>;
    saveAllCaches(): Promise<void>;
}

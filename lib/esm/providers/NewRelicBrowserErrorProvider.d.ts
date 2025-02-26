import { Error } from '../models';
import { ErrorProviderInterface } from '../interfaces';
export declare type NewRelicBrowserErrorProviderConfig = {
    accountId: string;
    appName: string;
    appConfigId: string;
    includeHosts?: [string];
    excludedeHosts?: [string];
    excludeUserAgents?: [string];
    userIdField?: string;
};
export declare class NewRelicBrowserErrorProvider implements ErrorProviderInterface {
    private config;
    private appIdToEntityGuid;
    private appIdToEntityGuidPromise;
    constructor(config: NewRelicBrowserErrorProviderConfig);
    private getAppIdToEntityGuidMap;
    private fetchAppIdToEntityGuidMap;
    getErrors(hoursBack?: number, limit?: number): Promise<Error[]>;
}

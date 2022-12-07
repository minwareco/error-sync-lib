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
    private newrelicApi;
    constructor(config: NewRelicBrowserErrorProviderConfig);
    getErrors(hoursBack?: number, limit?: number): Promise<Error[]>;
}

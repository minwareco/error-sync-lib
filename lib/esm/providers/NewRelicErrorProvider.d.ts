import { Error } from '../models';
import { ErrorProviderInterface } from '../interfaces';
export declare enum NewRelicErrorProviderType {
    SERVER = "server",
    BROWSER = "browser"
}
export type NewRelicErrorProviderConfig = {
    accountId: string;
    appName: string;
    appConfigId: string;
    type: NewRelicErrorProviderType;
    includeHosts?: [string];
    excludeHosts?: [string];
    excludeUserAgents?: [string];
    userIdField?: string;
};
export declare class NewRelicErrorProvider implements ErrorProviderInterface {
    private config;
    constructor(config: NewRelicErrorProviderConfig);
    private buildDebugUrl;
    getErrors(hoursBack?: number, limit?: number): Promise<Error[]>;
}

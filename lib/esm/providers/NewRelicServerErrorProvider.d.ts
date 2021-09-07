import { Error } from '../models';
import { ErrorProviderInterface } from "../interfaces";
export declare type NewRelicServerErrorProviderConfig = {
    appName: string;
    appConfigId: string;
    includeHosts?: [string];
    excludedeHosts?: [string];
    excludeUserAgents?: [string];
    userIdField?: string;
};
export declare class NewRelicServerErrorProvider implements ErrorProviderInterface {
    private config;
    private newrelicApi;
    constructor(config: NewRelicServerErrorProviderConfig);
    getErrors(hoursBack?: number, limit?: number): Promise<Error[]>;
}

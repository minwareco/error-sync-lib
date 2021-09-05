import { ErrorGroup } from './models';
import { AlertProviderInterface, CacheProviderInterface, ErrorProviderInterface, TicketProviderInterface } from './interfaces';
export declare type SynchronizerError = {
    message: string;
    errorGroup?: ErrorGroup;
};
export declare type SynchronizerResult = {
    completedErrorGroups: ErrorGroup[];
    errors: SynchronizerError[];
    exitCode: number;
};
export declare type SynchronizerConfig = {
    serverErrorProvider?: ErrorProviderInterface;
    clientErrorProvider?: ErrorProviderInterface;
    ticketProvider: TicketProviderInterface;
    alertProvider: AlertProviderInterface;
    cacheProvider: CacheProviderInterface;
};
export declare class Synchronizer {
    private config;
    constructor(config: SynchronizerConfig);
    run(): Promise<SynchronizerResult>;
    private syncErrorGroup;
    private createErrorGroup;
    private addToErrorGroups;
    private doesTicketNeedReopening;
    private doesTicketNeedUpdate;
    private doesAlertNeedUpdate;
    private determineErrorPriority;
}

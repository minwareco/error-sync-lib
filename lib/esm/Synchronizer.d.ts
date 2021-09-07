import { ErrorGroup } from './models';
import { AlertProviderInterface, CacheProviderInterface, ErrorProviderInterface, PrioritizationProviderInterface, TicketProviderInterface } from './interfaces';
export declare type SynchronizerError = {
    message: string;
    errorGroup?: ErrorGroup;
};
export declare type SynchronizerResult = {
    completedErrorGroups: ErrorGroup[];
    errors: SynchronizerError[];
    exitCode: number;
};
export declare type SynchronizerErrorProviderConfig = {
    name: string;
    provider: ErrorProviderInterface;
    prioritizationProvider?: PrioritizationProviderInterface;
    lookbackHours?: number;
    maxErrors?: number;
};
export declare type SynchronizerConfig = {
    errors: SynchronizerErrorProviderConfig[];
    ticketProvider: TicketProviderInterface;
    alertProvider: AlertProviderInterface;
    cacheProvider: CacheProviderInterface;
};
export declare class Synchronizer {
    private config;
    constructor(config: SynchronizerConfig);
    run(): Promise<SynchronizerResult>;
    private runForErrorProvider;
    private syncErrorGroup;
    private createErrorGroup;
    private addToErrorGroups;
    private doesTicketNeedReopening;
    private doesTicketNeedUpdate;
    private doesAlertNeedUpdate;
}

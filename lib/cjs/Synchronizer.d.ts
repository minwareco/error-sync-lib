import { ErrorGroup } from './models';
import { AlertProviderInterface, CacheProviderInterface, ErrorProviderInterface, PrioritizationProviderInterface, TicketProviderInterface } from './interfaces';
export type SynchronizerError = {
    message: string;
    errorGroup?: ErrorGroup;
};
export type SynchronizerResult = {
    completedErrorGroups: ErrorGroup[];
    errors: SynchronizerError[];
    exitCode: number;
};
export type SynchronizerErrorProviderConfig = {
    name: string;
    provider: ErrorProviderInterface;
    prioritizationProvider?: PrioritizationProviderInterface;
    lookbackHours?: number;
    maxErrors?: number;
};
export type SynchronizerConfig = {
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

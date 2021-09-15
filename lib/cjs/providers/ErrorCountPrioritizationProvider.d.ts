import { ErrorGroup, ErrorPriority } from '../models';
import { ErrorPrioritizationResult, PrioritizationProviderInterface } from '../interfaces';
export declare type ErrorCountPrioritizationProviderThreshold = {
    threshold: number;
    priority: ErrorPriority;
    label: string;
};
export declare type ErrorCountPrioritizationProviderConfig = {
    thresholds: ErrorCountPrioritizationProviderThreshold[];
};
export declare const DefaultErrorCountPrioritizationProviderConfig: {
    thresholds: {
        threshold: number;
        priority: ErrorPriority;
        label: string;
    }[];
};
export declare class ErrorCountPrioritizationProvider implements PrioritizationProviderInterface {
    private config;
    constructor(config?: ErrorCountPrioritizationProviderConfig);
    determinePriority(errorGroup: ErrorGroup): Promise<ErrorPrioritizationResult>;
}

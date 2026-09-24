import { type ErrorGroup, ErrorPriority } from '../models';
import { type ErrorPrioritizationResult, type PrioritizationProviderInterface } from '../interfaces';
export type ErrorCountPrioritizationProviderThreshold = {
    threshold: number;
    priority: ErrorPriority;
    label: string;
};
export type ErrorCountPrioritizationProviderConfig = {
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

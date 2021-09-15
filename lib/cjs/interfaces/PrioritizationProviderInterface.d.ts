import { ErrorGroup, ErrorPriority } from '../models';
export declare type ErrorPrioritizationResult = {
    priority: ErrorPriority;
    priorityReason: string;
};
export interface PrioritizationProviderInterface {
    determinePriority(errorGroup: ErrorGroup): Promise<ErrorPrioritizationResult>;
}

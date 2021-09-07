import { ErrorGroup, ErrorPriority } from '../models';

export interface PrioritizationProviderInterface {
  determinePriority(errorGroup: ErrorGroup): Promise<ErrorPriority>;
}

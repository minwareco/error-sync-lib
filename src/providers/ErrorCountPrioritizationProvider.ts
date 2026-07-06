import { ErrorGroup, ErrorPriority } from '../models';
import { ErrorPrioritizationResult, PrioritizationProviderInterface } from '../interfaces';
import { getReadableErrorCountPeriod } from "../util/ErrorUtil";

export type ErrorCountPrioritizationProviderThreshold = {
  threshold: number,
  priority: ErrorPriority,
  label: string,
};

export type ErrorCountPrioritizationProviderConfig = {
  thresholds: ErrorCountPrioritizationProviderThreshold[],
};

export const DefaultErrorCountPrioritizationProviderConfig = {
  thresholds: [{
    // affecting zero users
    threshold: 1,
    priority: ErrorPriority.P5,
    label: '0',
  }, {
    // affecting [1, 10) users
    threshold: 10,
    priority: ErrorPriority.P4,
    label: '>= 1 and < 10',
  }, {
    // affecting [10, 30) users
    threshold: 30,
    priority: ErrorPriority.P3,
    label: '>= 10 and < 30',
  }, {
    // affecting [30, 90) users
    threshold: 90,
    priority: ErrorPriority.P2,
    label: '>= 30 and < 90',
  }, {
    // affecting [90, infinity) users
    threshold: Number.MAX_SAFE_INTEGER,
    priority: ErrorPriority.P1,
    label: '>= 90',
  }],
};

export class ErrorCountPrioritizationProvider implements PrioritizationProviderInterface {
  private config: ErrorCountPrioritizationProviderConfig;

  public constructor(config?: ErrorCountPrioritizationProviderConfig) {
    this.config = config ?? DefaultErrorCountPrioritizationProviderConfig;
  }

  public async determinePriority(errorGroup: ErrorGroup): Promise<ErrorPrioritizationResult> {
    for (const threshold of this.config.thresholds) {
      if (errorGroup.count < threshold.threshold) {
        const countPeriod = getReadableErrorCountPeriod(errorGroup.countPeriodHours);
        return {
          priority: threshold.priority,
          priorityReason: `Affecting ${threshold.label} ${errorGroup.countType} per ${countPeriod}`,
        };
      }
    }
  }
}

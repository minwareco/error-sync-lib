import { ErrorPriority } from '../models';
import { getReadableErrorCountPeriod } from "../util/ErrorUtil";
export const DefaultErrorCountPrioritizationProviderConfig = {
    thresholds: [{
            threshold: 1,
            priority: ErrorPriority.P5,
            label: '0',
        }, {
            threshold: 10,
            priority: ErrorPriority.P4,
            label: '>= 1 and < 10',
        }, {
            threshold: 30,
            priority: ErrorPriority.P3,
            label: '>= 10 and < 30',
        }, {
            threshold: 90,
            priority: ErrorPriority.P2,
            label: '>= 30 and < 90',
        }, {
            threshold: Number.MAX_SAFE_INTEGER,
            priority: ErrorPriority.P1,
            label: '>= 90',
        }],
};
export class ErrorCountPrioritizationProvider {
    constructor(config) {
        this.config = config !== null && config !== void 0 ? config : DefaultErrorCountPrioritizationProviderConfig;
    }
    async determinePriority(errorGroup) {
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
//# sourceMappingURL=ErrorCountPrioritizationProvider.js.map
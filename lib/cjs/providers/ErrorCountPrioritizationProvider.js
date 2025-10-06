"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCountPrioritizationProvider = exports.DefaultErrorCountPrioritizationProviderConfig = void 0;
const models_1 = require("../models");
const ErrorUtil_1 = require("../util/ErrorUtil");
exports.DefaultErrorCountPrioritizationProviderConfig = {
    thresholds: [{
            threshold: 1,
            priority: models_1.ErrorPriority.P5,
            label: '0',
        }, {
            threshold: 10,
            priority: models_1.ErrorPriority.P4,
            label: '>= 1 and < 10',
        }, {
            threshold: 30,
            priority: models_1.ErrorPriority.P3,
            label: '>= 10 and < 30',
        }, {
            threshold: 90,
            priority: models_1.ErrorPriority.P2,
            label: '>= 30 and < 90',
        }, {
            threshold: Number.MAX_SAFE_INTEGER,
            priority: models_1.ErrorPriority.P1,
            label: '>= 90',
        }],
};
class ErrorCountPrioritizationProvider {
    constructor(config) {
        this.config = config !== null && config !== void 0 ? config : exports.DefaultErrorCountPrioritizationProviderConfig;
    }
    async determinePriority(errorGroup) {
        for (const threshold of this.config.thresholds) {
            if (errorGroup.count < threshold.threshold) {
                const countPeriod = (0, ErrorUtil_1.getReadableErrorCountPeriod)(errorGroup.countPeriodHours);
                return {
                    priority: threshold.priority,
                    priorityReason: `Affecting ${threshold.label} ${errorGroup.countType} per ${countPeriod}`,
                };
            }
        }
    }
}
exports.ErrorCountPrioritizationProvider = ErrorCountPrioritizationProvider;
//# sourceMappingURL=ErrorCountPrioritizationProvider.js.map
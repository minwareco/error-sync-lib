var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { ErrorPriority } from '../models';
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
    determinePriority(errorGroup) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const threshold of this.config.thresholds) {
                if (errorGroup.count < threshold.threshold) {
                    return threshold.priority;
                }
            }
        });
    }
}
//# sourceMappingURL=ErrorCountPrioritizationProvider.js.map
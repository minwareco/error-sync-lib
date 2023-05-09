"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReadableErrorCountPeriod = exports.getReadableErrorFrequency = void 0;
const getReadableErrorFrequency = (error) => {
    const countPeriod = (0, exports.getReadableErrorCountPeriod)(error.countPeriodHours);
    return `${error.count} ${error.countType} ${countPeriod}`;
};
exports.getReadableErrorFrequency = getReadableErrorFrequency;
const getReadableErrorCountPeriod = (countPeriodHours) => {
    if (countPeriodHours === 1) {
        return '1 hour';
    }
    else if (countPeriodHours < 24) {
        return `${countPeriodHours} hours`;
    }
    const days = Math.floor(countPeriodHours / 24);
    const hours = countPeriodHours % 24;
    if (hours === 0) {
        return (days > 1 ? `${days} days` : 'day');
    }
    else {
        return `${days}d ${hours}h`;
    }
};
exports.getReadableErrorCountPeriod = getReadableErrorCountPeriod;
//# sourceMappingURL=ErrorUtil.js.map
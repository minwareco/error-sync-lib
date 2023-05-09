export const getReadableErrorFrequency = (error) => {
    const countPeriod = getReadableErrorCountPeriod(error.countPeriodHours);
    return `${error.count} ${error.countType} ${countPeriod}`;
};
export const getReadableErrorCountPeriod = (countPeriodHours) => {
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
//# sourceMappingURL=ErrorUtil.js.map
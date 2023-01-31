import { ErrorGroup } from "../models";

export const getReadableErrorFrequency = (error: ErrorGroup) => {
  const countPeriod = getReadableErrorCountPeriod(error.countPeriodHours);
  return `${error.count} ${error.countType} ${countPeriod}`; // e.g. 11 users per day
}


export const getReadableErrorCountPeriod = (countPeriodHours: number) => {
  if (countPeriodHours === 1) {
    return '1 hour';
  } else if (countPeriodHours < 24) {
    return `${countPeriodHours} hours`;
  }

  const days = Math.floor(countPeriodHours / 24);
  const hours = countPeriodHours % 24;

  if (hours === 0) {
    return (days > 1 ? `${days} days` : 'day'); // e.g. day, 2 days
  } else {
    return `${days}d ${hours}h`; // e.g. 1d 12h
  }
}

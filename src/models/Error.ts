import { Alert } from '.';
import { Ticket } from '.';

export enum ErrorPriority {
  P1 = 'P1',
  P2 = 'P2',
  P3 = 'P3',
  P4 = 'P4',
  P5 = 'P5',
}

export enum ErrorCountType {
  USERS = 'users',
  TRX = 'transactions',
}

export enum ErrorType {
  CLIENT = 'client',
  SERVER = 'server',
}

export type Error = {
  name: string,
  type: ErrorType,
  count: number,
  countType: ErrorCountType,
  countPeriodHours: number,
  debugUrl: string,
};

export type ErrorGroup = {
  name: string,
  sourceName: string,
  type: ErrorType,
  priority: string,
  priorityReason: string,
  clientId: string,
  count: number,
  countType: ErrorCountType,
  countPeriodHours: number,
  ticket: Ticket,
  alert: Alert,
  instances: Error[],
};

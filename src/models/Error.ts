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
  USERS = 'Users',
  TRX = 'Transactions',
}

export enum ErrorType {
  CLIENT = 'Client',
  SERVER = 'Server',
}

export type Error = {
  name,
  type,
  count,
  countType,
  debugUrl,
};

export type ErrorGroup = {
  name: string,
  type: ErrorType,
  priority: string,
  clientId: string,
  count: number,
  countType: ErrorCountType,
  ticket: Ticket,
  alert: Alert,
  instances: Error[],
};

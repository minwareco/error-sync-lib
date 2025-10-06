import { Alert } from '.';
import { Ticket } from '.';
export declare enum ErrorPriority {
    P1 = "P1",
    P2 = "P2",
    P3 = "P3",
    P4 = "P4",
    P5 = "P5"
}
export declare enum ErrorCountType {
    USERS = "users",
    TRX = "transactions"
}
export declare enum ErrorType {
    BROWSER = "browser",
    CLIENT = "client",
    SERVER = "server",
    DATA = "data"
}
export type Error = {
    name: string;
    type: ErrorType;
    count: number;
    countType: ErrorCountType;
    mixpanelIds?: string[];
    userEmails?: string[];
    countPeriodHours: number;
    debugUrl?: string;
    debugMessage?: string;
    ticketType?: string;
};
export type ErrorGroup = {
    name: string;
    sourceName: string;
    type: ErrorType;
    priority: string;
    priorityReason: string;
    clientId: string;
    count: number;
    countType: ErrorCountType;
    mixpanelIds: string[];
    countPeriodHours: number;
    ticket: Ticket;
    alert: Alert;
    instances: Error[];
    userEmails: string[];
};

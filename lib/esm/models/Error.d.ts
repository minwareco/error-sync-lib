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
    USERS = "Users",
    TRX = "Transactions"
}
export declare enum ErrorType {
    CLIENT = "Client",
    SERVER = "Server"
}
export declare type Error = {
    name: any;
    type: any;
    count: any;
    countType: any;
    debugUrl: any;
};
export declare type ErrorGroup = {
    name: string;
    sourceName: string;
    type: ErrorType;
    priority: string;
    clientId: string;
    count: number;
    countType: ErrorCountType;
    ticket: Ticket;
    alert: Alert;
    instances: Error[];
};

export declare type AlertContent = {
    clientId: string;
    summary: string;
    priority: string;
    description: string;
    labels: string[];
    ticketUrl: string | undefined;
};
export declare type Alert = AlertContent & {
    id: string;
};

export declare type TicketContent = {
    clientId: string;
    summary: string;
    priority: string;
    description: string;
    labels: string[];
};
export declare type Ticket = TicketContent & {
    id: string;
    url: string;
    isOpen: boolean;
    resolutionDate?: string;
};

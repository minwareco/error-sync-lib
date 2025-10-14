export type TicketContent = {
    clientId: string;
    summary: string;
    priority: string;
    description: string | any;
    labels: string[];
    ticketType: string;
};
export type Ticket = TicketContent & {
    id: string;
    url: string;
    isOpen: boolean;
    resolutionDate?: string;
};

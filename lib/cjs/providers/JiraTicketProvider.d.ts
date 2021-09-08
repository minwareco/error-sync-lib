import { TicketProviderInterface } from '../interfaces';
import { ErrorGroup, Ticket, TicketContent } from '../models';
export declare type JiraBasicAuthConfig = {
    username: string;
    apiKey: string;
};
export declare type JiraOAuthConfig = {
    consumerKey: string;
    consumerSecret: string;
    accessToken: string;
    accessTokenSecret: string;
};
export declare type JiraTicketConfig = {
    projectId: string;
    issueTypeId: string;
    openTransitionId: string;
    componentIds?: string[];
    priorityMap?: Record<string, string>;
};
export declare type JiraTicketProviderConfig = {
    host: string;
    basicAuth?: JiraBasicAuthConfig;
    oauth?: JiraOAuthConfig;
    ticket: JiraTicketConfig;
};
export declare class JiraTicketProvider implements TicketProviderInterface {
    private config;
    private jiraClient;
    constructor(config: JiraTicketProviderConfig);
    findTicket(clientId: string): Promise<Ticket | undefined>;
    createTicket(ticketContent: TicketContent): Promise<Ticket>;
    updateTicket(ticket: Ticket): Promise<Ticket>;
    reopenTicket(ticket: Ticket): Promise<Ticket>;
    generateTicketContent(errorGroup: ErrorGroup): Promise<TicketContent>;
    private makeTicketUrl;
}

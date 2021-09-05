import { ErrorGroup, Ticket, TicketContent } from '../models';

export interface TicketProviderInterface {
  findTicket(clientId: string): Promise<Ticket|undefined>;

  createTicket(ticketContent: TicketContent): Promise<Ticket>;

  updateTicket(ticket: Ticket): Promise<Ticket>;

  reopenTicket(ticket: Ticket): Promise<Ticket>;

  generateTicketContent(errorGroup: ErrorGroup): Promise<TicketContent>;
}


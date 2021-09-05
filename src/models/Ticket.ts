export type TicketContent = {
  clientId: string,
  summary: string,
  priority: string,
  description: string,
  labels: string[],

}

export type Ticket = TicketContent & {
  id: string,
  url: string,
  isOpen: boolean,
  resolutionDate?: string,
}

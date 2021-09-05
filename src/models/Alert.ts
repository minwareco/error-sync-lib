export type AlertContent = {
  clientId: string,
  summary: string,
  priority: string,
  description: string,
  labels: string[],
  ticketUrl: string|undefined,
}

export type Alert = AlertContent & {
  id: string,
}

export const terminalClients = /curl|httpie|mppx|purl|wget/i

export function isTerminalClient(userAgent: string) {
  return terminalClients.test(userAgent)
}

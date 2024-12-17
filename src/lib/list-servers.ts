import { NS, Server } from '@ns'
import { currency_format } from 'lib/format-money';

export function list_servers(ns: NS, servers: Array<Server>): void {
  const longest_hostname_length: number = Math.max(...servers.map(s => s.hostname.length));

  // Display the result
  for (const s of servers) {
    ns.tprintf(
      `%${longest_hostname_length}s [%6d/%6d] [%s%s] {%s} %4d %6.3f\\%6.3f %21s/%21s\n`,
      s.hostname,
      s.ramUsed, s.maxRam,
      s.hasAdminRights ? 'R' : ' ', s.backdoorInstalled ? 'B' : ' ',
      s.numOpenPortsRequired,
      s.requiredHackingSkill,
      s.hackDifficulty,
      s.minDifficulty,
      currency_format(s.moneyAvailable ?? 0),
      currency_format(s.moneyMax ?? 0),
    );
  }
}

export async function main(ns: NS): Promise<void> {
    return;
}

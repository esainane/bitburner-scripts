import { NS, Server } from '@ns'
import { currency_format } from 'lib/format-money';
import { color_pad } from 'lib/colors';

export function list_servers(ns: NS, servers: Array<Server>): void {
  const longest_hostname_length: number = Math.max(...servers.map(s => s.hostname.length));

  // Display the result
  for (const s of servers) {
    ns.tprintf(
      `%${longest_hostname_length}s [%7d/%7d] [%s%s] {%s} %4d %6.3f\\%6.3f %8s/%8s\n`,
      s.hostname,
      s.ramUsed, s.maxRam,
      s.hasAdminRights ? 'R' : ' ', s.backdoorInstalled ? 'B' : ' ',
      s.numOpenPortsRequired,
      s.requiredHackingSkill,
      s.hackDifficulty,
      s.minDifficulty,
      color_pad(currency_format(s.moneyAvailable ?? 0), 8),
      color_pad(currency_format(s.moneyMax ?? 0), 8),
    );
  }
}

export async function main(ns: NS): Promise<void> {
    return;
}

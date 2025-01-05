import { NS, Server } from '@ns'
import { currency_format } from 'lib/format-money';
import { color_pad, colors, format_normalize_state, format_number } from 'lib/colors';

export function list_servers(ns: NS, servers: Array<Server>): void {
  const longest_hostname_length: number = Math.max(...servers.map(s => s.hostname.length));

  // Display the result
  for (const s of servers) {
    ns.tprintf(
      `%${longest_hostname_length}s [%7d/%7d] [%s%s] {%s} %s%4d${colors.reset} %s %7.3f\\%7.3f %8s/%8s %s\n`,
      s.hostname,
      s.ramUsed ?? 1, s.maxRam ?? 1,
      s.hasAdminRights ? 'R' : ' ', s.backdoorInstalled ? 'B' : ' ',
      s.numOpenPortsRequired ?? 0,
      (s.requiredHackingSkill ?? 1) > ns.getPlayer().skills.hacking ? colors.fg_yellow : '', s.requiredHackingSkill ?? 1,
      color_pad(format_normalize_state(ns, s.hostname, { pad: true }), 15, { left: false }),
      s.hackDifficulty ?? 1,
      s.minDifficulty ?? 1,
      color_pad(currency_format(s.moneyAvailable ?? 0), 9),
      color_pad(currency_format(s.moneyMax ?? 0), 9),
      s.serverGrowth ? format_number(s.serverGrowth) : `${colors.fg_black}-${colors.reset}`
    );
  }
}

export async function main(ns: NS): Promise<void> {
    return;
}

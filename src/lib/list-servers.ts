import { NS, Server } from '@ns'
import { format_currency } from 'lib/format-money';
import { color_pad, colors, format_normalize_state, format_number, format_servername, print_table } from 'lib/colors';

export function list_servers(ns: NS, servers: Array<Server>): void {
  const longest_hostname_length: number = Math.max(...servers.map(s => s.hostname.length));

  // Display the result
  print_table(ns, ns => {
    for (const s of servers) {
      ns.tprintf(
        `%s %s [%s/%s] [%s%s] {%s} %s%s${colors.reset} %s %s\\%s %8s/%8s %s\n`,
        s.organizationName,
        format_servername(s.hostname),
        format_number(s.ramUsed ?? 1), format_number(s.maxRam ?? 1),
        s.hasAdminRights ? 'R' : ' ', s.backdoorInstalled ? 'B' : ' ',
        format_number(s.numOpenPortsRequired ?? 0),
        (s.requiredHackingSkill ?? 1) > ns.getPlayer().skills.hacking ? colors.fg_yellow : '',
        format_number(s.requiredHackingSkill ?? 1),
        color_pad(format_normalize_state(ns, s.hostname, { pad: true }), 15, { left: false }),
        format_number(s.hackDifficulty ?? 1, { round: 3 }),
        format_number(s.minDifficulty ?? 1, { round: 3 }),
        color_pad(format_currency(s.moneyAvailable ?? 0), 9),
        color_pad(format_currency(s.moneyMax ?? 0), 9),
        s.serverGrowth ? format_number(s.serverGrowth) : `${colors.fg_black}-${colors.reset}`
      );
    }
  });
}

export async function main(ns: NS): Promise<void> {
    return;
}

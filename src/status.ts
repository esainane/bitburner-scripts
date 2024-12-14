import { NS } from '@ns'

import { find_servers } from 'lib/find-servers'

export async function main(ns: NS): Promise<void> {
  const servers = await find_servers(ns);
  servers.sort((l, r) => {
    if (l.requiredHackingSkill != r.requiredHackingSkill) {
      return (l.requiredHackingSkill ?? 0) - (r.requiredHackingSkill ?? 0);
    }
    return 0;
  })

  const longest_hostname_length: number = Math.max(...servers.map(s => s.hostname.length));

  const currencyFormat = Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format;

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
      currencyFormat(s.moneyAvailable ?? 0),
      currencyFormat(s.moneyMax ?? 0),
    );
  }
}

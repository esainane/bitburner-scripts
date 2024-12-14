import { NS } from '@ns'

export async function main(ns: NS): Promise<void> {
  // Traverse the network
  const seen: Set<string> = new Set();
  const home: Server = ns.getServer('home')
  const to_visit: Array<Server> = [home];
  while (to_visit.length > 0) {
    const s: Server = to_visit.pop()!;
    if (seen.has(s.hostname)) {
      continue;
    }
    seen.add(s.hostname);
    for (const adj_name of ns.scan(s.hostname)) {
      if (seen.has(adj_name)) {
        continue;
      }
      to_visit.push(ns.getServer(adj_name));
    }
  }

  // Sort the result

  const servers: Array<Server> = [...seen.values()].map(ns.getServer);
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

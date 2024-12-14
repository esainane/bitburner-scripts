/** @param {NS} ns */
interface ServerData {
  name: String;
  backdoored: boolean;
  hack_difficulty: number;
}
export async function main(ns: NS) {
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
    for (let adj_name of ns.scan(s.hostname)) {
      if (seen.has(adj_name)) {
        continue;
      }
      to_visit.push(ns.getServer(adj_name));
    }
  }

  // Sort the result

  interface PortCracker {
    prog_name: string;
    func: (host: string) => void;
    is_open: (s: Server) => boolean;
  };

  const portsOpenable: Array<PortCracker> = [
    { prog_name: "BruteSSH.exe", func: ns.brutessh, is_open: (s: Server) => s.sshPortOpen },
    { prog_name: "FTPCrack.exe", func: ns.ftpcrack, is_open: (s: Server) => s.ftpPortOpen },
    { prog_name: "RelaySMTP.exe", func: ns.relaysmtp, is_open: (s: Server) => s.smtpPortOpen },
    { prog_name: "HTTPWorm.exe", func: ns.httpworm, is_open: (s: Server) => s.httpPortOpen },
    { prog_name: "SQLInject.exe", func: ns.sqlinject, is_open: (s: Server) => s.sqlPortOpen },
  ].filter(p => ns.fileExists(p.prog_name, 'home'));

  ns.tprint(`${portsOpenable.length} ports openable`);

  const servers: Array<Server> = [...seen.values()].map(ns.getServer);
  for (let s of servers) {
    if (s.hasAdminRights && s.backdoorInstalled) {
      continue;
    }
    if (!s.hasAdminRights) {
      if ((s.numOpenPortsRequired ?? 0) > portsOpenable.length) {
        continue;
      }
      for (let port of portsOpenable) {
        if (port.is_open(s)) {
          continue;
        }
        port.func(s.hostname);
      }
      ns.nuke(s.hostname);
    }
    if (!s.backdoorInstalled && s.hasAdminRights) {
      // await ns.singularity.installBackdoor();
    }
  }
  servers.sort((l, r) => {
    if (l.requiredHackingSkill != r.requiredHackingSkill) {
      return (l.requiredHackingSkill ?? 0) - (r.requiredHackingSkill ?? 0);
    }
    return 0;
  })

  const longest_hostname_length: number = Math.max(...servers.map(s => s.hostname.length));

  const currencyFormat = Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format;

  // Display the result
  for (let s of servers) {
    ns.tprintf(
      `%${longest_hostname_length}s [%s%s] {%s} %4d %6.3f\\%6.3f %21s/%21s\n`,
      s.hostname,
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
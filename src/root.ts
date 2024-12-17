import { NS, Server } from '@ns'
import { find_servers } from 'lib/find-servers';
import { list_servers } from 'lib/list-servers';

export async function main(ns: NS): Promise<void> {
  interface PortCracker {
    prog_name: string;
    func: (host: string) => void;
    is_open: (s: Server) => boolean;
  }

  const portsOpenable: Array<PortCracker> = [
    { prog_name: "BruteSSH.exe", func: ns.brutessh, is_open: (s: Server) => s.sshPortOpen },
    { prog_name: "FTPCrack.exe", func: ns.ftpcrack, is_open: (s: Server) => s.ftpPortOpen },
    { prog_name: "RelaySMTP.exe", func: ns.relaysmtp, is_open: (s: Server) => s.smtpPortOpen },
    { prog_name: "HTTPWorm.exe", func: ns.httpworm, is_open: (s: Server) => s.httpPortOpen },
    { prog_name: "SQLInject.exe", func: ns.sqlinject, is_open: (s: Server) => s.sqlPortOpen },
  ].filter(p => ns.fileExists(p.prog_name, 'home'));

  ns.tprint(`${portsOpenable.length} ports openable`);

  const servers: Array<Server> = find_servers(ns).map(ns.getServer);

  for (const s of servers) {
    if (s.hasAdminRights && s.backdoorInstalled) {
      continue;
    }
    if (!s.hasAdminRights) {
      if ((s.numOpenPortsRequired ?? 0) > portsOpenable.length) {
        continue;
      }
      for (const port of portsOpenable) {
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
  });


  list_servers(ns, servers);
}

import { NS, Server } from '@ns'
import { find_servers } from 'lib/find-servers';
import { list_servers } from 'lib/list-servers';
import { colors, format_number, format_servername } from 'lib/colors';
import { shortest_route_to } from '/path';
import { singularity_async } from '/lib/singu';

export async function main(ns: NS): Promise<void> {
  ns.ramOverride(7.45);
  ns.disableLog('ALL');
  ns.enableLog('nuke');
  ns.enableLog('brutessh');
  ns.enableLog('ftpcrack');
  ns.enableLog('relaysmtp');
  ns.enableLog('httpworm');
  ns.enableLog('sqlinject');

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

  ns.tprint(`INFO ${portsOpenable.length} ports openable`);

  let here = 'home';

  const servers: Array<Server> = find_servers(ns).map(ns.getServer);

  const sing = singularity_async(ns);

  let unrootable = 0;
  const modified: Array<string> = [];
  for (const s of servers) {
    if (s.hasAdminRights && s.backdoorInstalled) {
      continue;
    }
    if (!s.hasAdminRights) {
      if ((s.numOpenPortsRequired ?? 0) > portsOpenable.length) {
        ++unrootable;
        continue;
      }
      for (const port of portsOpenable) {
        if (port.is_open(s)) {
          continue;
        }
        port.func(s.hostname);
      }
      ns.nuke(s.hostname);
      modified.push(s.hostname);
    }
    if (!s.backdoorInstalled && s.hasAdminRights && !s.purchasedByPlayer && (s.requiredHackingSkill ?? 0) <= ns.getPlayer().skills.hacking && s.hostname !== 'home') {
      const route = shortest_route_to(ns, s.hostname, here);
      if (!route) {
        ns.tprint(`WARNING Can't find route to ${format_servername(s.hostname)}, ignoring!`);
        continue;
      }
      for (const step of route) {
        await sing.connect(step);
        here = step;
      }
      await sing.installBackdoor();
    }
  }

  if (here !== 'home') {
    const route = shortest_route_to(ns, 'home', here);
    if (!route) {
      ns.tprint(`WARNING Can't find route back to ${format_servername('home')}, ignoring!`);
    } else {
      for (const step of route) {
        await sing.connect(step);
        here = step;
      }
    }
  }


  if (!modified.length) {
    ns.tprint("INFO No servers could be modified", unrootable ? ` (${format_number(unrootable)} remain unrootable)` : '');
    return;
  }

  const sorter = (l: Server, r: Server) => {
    if (l.requiredHackingSkill != r.requiredHackingSkill) {
      return (l.requiredHackingSkill ?? 0) - (r.requiredHackingSkill ?? 0);
    }
    return 0;
  }

  list_servers(ns, modified.map(ns.getServer).sort(sorter));

  ns.tprint(`INFO ${format_number(modified.length)} servers were ${colors.combine(colors.bright, colors.fg_yellow)}newly rooted${colors.reset}!`);
}

import { NS } from '@ns'
async function find_servers(ns: NS) {
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

  const servers: Array<Server> = [...seen.values()].map(ns.getServer);
  return servers;
}

function killall(ns: NS, servers: Array<Server>, script: string) {
  for (const s of servers) {
    ns.scriptKill(script, s.hostname);
  }
}

export async function main(ns: NS): Promise<void> {
  const servers = await find_servers(ns);
  if (ns.args.length > 0) {
    killall(ns, servers, String(ns.args[0]));
  } else {
    killall(ns, servers, 'grow1.ts');
    killall(ns, servers, 'weak1.ts');
    killall(ns, servers, 'hack1.ts');
    killall(ns, servers, 'go.ts');
  }
}

export async function main(ns: NS): Promise<void> {
  // Copy script to all available servers
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

  // Filter the result
  const servers: Array<Server> = [...seen.values()].map(ns.getServer).filter(s => s.hasAdminRights);

  // Copy script to all
  const script = String(ns.args[0]);
  for (const target of servers) {
    ns.scp(script, target.hostname);
  }

  if (ns.args[1] == '--run') {
    for (const target of servers) {
      ns.exec(script, target.hostname, 1, ...ns.args.slice(2));
    }
  } else if (ns.args[1] == '--run-threads') {
    const scriptRam = ns.getScriptRam(script);
    for (const target of servers) {
      const threads = Math.floor((target.maxRam - target.ramUsed) / scriptRam);
      if (threads < 1) {
        continue;
      }
      ns.exec(script, target.hostname, threads, ...ns.args.slice(2));
    }
  }
}
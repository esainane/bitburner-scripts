
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
    for (let adj_name of ns.scan(s.hostname)) {
      if (seen.has(adj_name)) {
        continue;
      }
      to_visit.push(ns.getServer(adj_name));
    }
  }

  // Work out which servers we can use to run scripts on
  const servers: Array<Server> = [...seen.values()].map(ns.getServer);
  return servers;
}


export async function main(ns: NS) {
  const servers = (await find_servers(ns)).filter((d: Server) => !d.purchasedByPlayer && d.hostname !== 'home' && d.hostname !== 'darkweb');
  
  const ignore_files = new Set<string>(ns.ls('home'));
  const all_files = new Map<string, string[]>([]);
  for (let s of servers) {
    const files: Array<string> = ns.ls(s.hostname);
    for (let f of files) {
      if (all_files.has(f)) {
        all_files.get(f)!.push(s.hostname);
      } else {
        all_files.set(f, [s.hostname]);
      }
    }
  }

  for (let [f, servers] of [...all_files.entries()].filter(([d, v]) => !d.endsWith('.lit') && !ignore_files.has(d))) {
    ns.tprint(f, ' @ ', servers);
  }
}

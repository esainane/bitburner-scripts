import { NS } from '@ns'
import { find_servers } from 'lib/find-servers';

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

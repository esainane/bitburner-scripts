import { NS } from '@ns';

const port_statefile = 'data/port.txt';

export function mkfifo(ns: NS): number {
  const last_id = parseInt(ns.read(port_statefile) || '0');
  const new_id = last_id + 1;
  ns.clearPort(new_id);
  ns.write('data/port.txt', String(new_id), 'w');
  return new_id;
}

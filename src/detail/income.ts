import { NS } from '@ns'
import { colors, format_servername, print_table } from '/lib/colors';
import { currency_format } from '/lib/format-money';

export async function main(ns: NS): Promise<void> {
  const { sinceStart: since_last_bitnode, sinceInstall: since_last_aug } = ns.getMoneySources();
  const sources_since_last_bitnode = Object.entries(since_last_bitnode).filter(([k, v]) => v > 0).sort(([k1, v1], [k2, v2]) => v1 - v2);
  const sources_since_last_aug = Object.entries(since_last_aug).filter(([k, v]) => v > 0).sort(([k1, v1], [k2, v2]) => v1 - v2);
  ns.tprint("Since last BitNode:");
  print_table(ns, (ns: NS) => {
    for (const [k, v] of sources_since_last_bitnode) {
      ns.tprintf("%s: %s",
        k === "total" ? `${colors.fg_cyan}total${colors.reset}` : format_servername(k),
        currency_format(v)
      );
    }
  });
  ns.tprint("Since last augmentation:");
  print_table(ns, (ns: NS) => {
    for (const [k, v] of sources_since_last_aug) {
      ns.tprintf("%s: %s",
        k === "total" ? `${colors.fg_cyan}total${colors.reset}` : format_servername(k),
        currency_format(v)
      );
    }
  });
}

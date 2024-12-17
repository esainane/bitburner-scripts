import { NS } from '@ns'
import { Colors, colors, nop_colors } from './colors'
import { assert_all_passed, assert_eq } from '/lib/assert';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const usd_currency_format = (amount: number, colorize=true, simplify=true) => Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const suffixes_plain = make_suffixes(nop_colors);
const suffixes_colored = make_suffixes(colors);

function make_suffixes(colors: Colors): Array<string> {
  return [
    '',
    `${colors.fg_cyan}K`,
    `${colors.reset}${colors.fg_green}M`,
    `${colors.fg_yellow}B`,
    `${colors.fg_magenta}T`,
    `${colors.fg_red}Q`,
    `${colors.combine(colors.bright, colors.fg_blue)}P`,
    `${colors.combine(colors.bright, colors.fg_cyan)}H`,
    `${colors.combine(colors.bright, colors.fg_green)}Hp`,
    `${colors.combine(colors.bright, colors.fg_yellow)}O`,
    `${colors.combine(colors.bright, colors.fg_magenta)}N`,
    `${colors.combine(colors.bright, colors.fg_red)}D`
  ];
}

export function hm_currency_format(amount: number, { colorize=true, simplify=true, ns = undefined}: { colorize?:boolean, simplify?: boolean, ns?: NS} = {}): string {
  const [color, suffixes] = colorize ? [colors, suffixes_colored] : [nop_colors, suffixes_plain];
  let str = "";
  if (amount == 0) {
    return `${color.fg_white}0${color.reset}`;
  }
  if (amount < 0) {
    str = `${color.fg_red}-`;
    amount = -amount;
  }
  let magnitude = Math.log10(amount);
  let i = 0;
  if (simplify) {
    const steps = Math.floor(magnitude / 3);
    i = Math.max(0, steps - 1);
    if (ns) ns.tprint(`magnitude: ${magnitude} steps: ${steps}, i: ${i}, colorize: ${colorize}`);
    amount = Math.floor(amount / (1000 ** i));
    magnitude -= i * 3;
  }
  while (magnitude >= 3) {
    const fragment = Math.floor(amount % 1000);
    if (fragment) {
      const this_str = `${color.fg_white}${fragment}${suffixes[i] ?? `${color.combine(color.bright, color.fg_red)}E${i*3}`}${color.reset}`;
      str = `${this_str}${str}`;
    }
    amount /= 1000;
    magnitude -= 3;
    i++;
  }
  return (amount >= 1 ? `${color.fg_white}${Math.floor(amount)}${suffixes[i]}${str}` : `${str}`) + color.reset;
}

export const currency_format = hm_currency_format;

export async function main(ns: NS): Promise<void> {
  if (ns.args.length > 0) {
    ns.tprint(currency_format(Number(ns.args[0]), {ns}));
    return;
  }

  const opts = {colorize: false};
  // Test
  assert_eq(ns, "0", hm_currency_format(0, opts), );
  assert_eq(ns, "400", hm_currency_format(400, opts));
  assert_eq(ns, "20", hm_currency_format(20, opts));
  assert_eq(ns, "4K", hm_currency_format(4000, opts));
  assert_eq(ns, "4K10", hm_currency_format(4010, opts));
  assert_eq(ns, "4M143K", hm_currency_format(4143010, opts));
  assert_eq(ns, "4M143K10", hm_currency_format(4143010, { simplify: false, ...opts }));

  assert_all_passed(ns);
}

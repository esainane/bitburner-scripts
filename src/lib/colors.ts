import { NS } from '@ns'

export interface Colors {
  reset: string;
  bright: string;
  dim: string;
  italic: string;
  underscore: string;
  //blink: string;
  //reverse: string;
  //hidden: string;

  fg_black: string;
  fg_red: string;
  fg_green: string;
  fg_yellow: string;
  fg_blue: string;
  fg_magenta: string;
  fg_cyan: string;
  fg_white: string;

  bg_black: string;
  bg_red: string;
  bg_green: string;
  bg_yellow: string;
  bg_blue: string;
  bg_magenta: string;
  bg_cyan: string;
  bg_white: string;

  rgb(r: number, g: number, b: number): string;
  combine(...mods: string[]): string;
}

// ANSI color codes
// Dim, blink, reverse, and hidden have no effect in the terminal
export const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1;33m",
  dim: "\x1b[2;33m",
  italic: "\x1b[3m",
  underscore: "\x1b[4m",
  //blink: "\x1b[5m",
  //reverse: "\x1b[7m",
  //hidden: "\x1b[8m",

  fg_black: "\x1b[30m",
  fg_red: "\x1b[31m",
  fg_green: "\x1b[32m",
  fg_yellow: "\x1b[33m",
  fg_blue: "\x1b[34m",
  fg_magenta: "\x1b[35m",
  fg_cyan: "\x1b[36m",
  fg_white: "\x1b[37m",

  bg_black: "\x1b[40m",
  bg_red: "\x1b[41m",
  bg_green: "\x1b[42m",
  bg_yellow: "\x1b[43m",
  bg_blue: "\x1b[44m",
  bg_magenta: "\x1b[45m",
  bg_cyan: "\x1b[46m",
  bg_white: "\x1b[47m",

  rgb(r: number, g: number, b: number, mod = '\x1b[m'): string {
    return `${mod.slice(0, mod.length - 1)}38;2;${r};${g};${b}m`;
  },
  combine(...mods: string[]): string {
    return "\x1b[" + mods.map(d => d.slice(2, d.length - 1)).join(';') + "m";
  }
};

export function strip_color(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[\d+(;\d+)*m/g, '');
}

/**
 * Pad a string while ignoring color codes for the purpose of length calculation
 */
export function color_pad(s: string, length: number, { left = true } = {}): string {
  const real_length = strip_color(s).length;
  if (real_length >= length) return s;
  const pad = ' '.repeat(length - real_length);
  return left ? pad + s : s + pad;
}

export interface ArgOpt {
  left?: boolean;
  min?: number;
}

/**
 * Start a "transaction block" to print a table with column members padded to the longest member's width
 *
 * Only wraps ns.tprintf. Once the transaction block ends, the real ns.tprintf will be called with all arguments
 * padded appropriately, ignoring color codes for width.
 *
 * @param ns NS instance to proxy in the transaction block
 * @param cb Transaction block
 * @param arg_opts Optional argument options to be forwarded to color_pad, also supplies a 'min' field for column width
 */
export function print_table(ns: NS, cb: (ns: NS) => void, arg_opts: ArgOpt[] = []) {
  const widths: number[] = [];
  const calls: [string, string[]][] = [];
  const inner_ns: NS = {...ns,
    tprintf(format: string, ...values) {
      values = values.map(String);
      for (const [i, d] of values.entries()) {
        widths[i] = Math.max(widths[i] ?? arg_opts[i]?.min ?? 0, strip_color(d).length)
      }
      calls.push([format, values]);
    },
  };
  cb(inner_ns);
  for (const [format, values] of calls) {
    ns.tprintf(format, ...values.map((d,i) => color_pad(d, widths[i], arg_opts[i])));
  }
}

// A color mapping which satisfies the interface, but only return no-ops
export const nop_colors = Object.keys(colors).reduce(
  (acc: object, key: string) => Object.assign(acc, { [key]: '' }), {}
) as Colors;
nop_colors.rgb = (r: number, g: number, b: number) => '';
nop_colors.combine = (...mods: string[]): string => '';

export const bright_yellow = colors.combine(colors.bright, colors.fg_yellow);
export function format_servername(servername: string, { is_warning = false } = {}): string {
  return `${is_warning ? bright_yellow : colors.fg_yellow}${servername}${colors.reset}`;
}

export function format_number(n: number, { colorize = true } = {}): string {
  return `${colorize ? colors.fg_white : ''}${n}${colors.reset}`;
}

export function format_data(n: unknown, { colorize = true, abbrev = false } = {}): string {
  if (n?.constructor === BigInt || typeof n === 'bigint') {
    // JSON.stringify will throw an exception if given a bigint
    n = n.toString();
  }
  if (abbrev && Array.isArray(n) && n.length > 10) {
    return `${colorize ? colors.fg_white : ''}[${n.slice(0, 10).map(d => format_data(d, { colorize, abbrev })).join(', ')}${colors.reset} ...(${format_number(n.length -10)} more entries)${colors.fg_white}]${colors.reset}`;
  }
  return `${colorize ? colors.fg_white : ''}${JSON.stringify(n)}${colors.reset}`;
}

export async function main(ns: NS): Promise<void> {
  ns.tprint("Colors:");
  for (const [key, value] of Object.entries(colors)) {
    ns.tprint(" ", key, ": ", value, "Effect ", colors.bright, " Bright", colors.reset);
  }
}
export function format_normalize_state(ns: NS, server: string, { pad = false} = {}): string {
  const max_money = ns.getServerMaxMoney(server);
  const server_fullness_percent = Math.floor(100 * ns.getServerMoneyAvailable(server) / max_money);
  const server_min_security = ns.getServerMinSecurityLevel(server);
  const server_security_excess = Math.ceil(10 * (ns.getServerSecurityLevel(server) - server_min_security)) / 10;
  const fullness_state = max_money > 0 ? `${format_number(server_fullness_percent)}${colors.fg_cyan}%${colors.reset}` : `${colors.fg_black}-${colors.reset}`;
  const sec_state = pad
    ? `${color_pad(String(server_min_security), 2)}${server_security_excess
      ? `${colors.fg_red}+${format_number(server_security_excess)}`
      : ''}`
    : `${server_min_security}${server_security_excess
      ? `${colors.fg_red}+${format_number(server_security_excess)}`
      : ''}`;
  return pad
    ? `{${color_pad(fullness_state, 4)} @ ${color_pad(sec_state, 7, {left: false})}}`
    : `{${fullness_state} @ ${sec_state}}`;
}

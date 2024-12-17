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


export async function main(ns: NS): Promise<void> {
  ns.tprint("Colors:");
  for (const [key, value] of Object.entries(colors)) {
    ns.tprint(" ", key, ": ", value, "Effect ", colors.bright, " Bright", colors.reset);
  }
}

import { NS } from '@ns'
import { colors, nop_colors } from './colors'
import { ms_per_sec, ms_per_min, ms_per_hour, ms_per_day } from '/lib/consts';

export function format_duration(time: number | Date, { relative = true, colorize = true, abs_threshold = 30000 } = {}): string {
  const color = colorize ? colors : nop_colors;
  const now = Date.now();
  const [datetime, epochtime] = (typeof(time) === "number"
    ? (relative
      ? [new Date(time + now), time + now]
      : [new Date(time), time])
    : (relative
      ? [new Date(time.getTime() + now), time.getTime() + now]
      : [time, time.getTime()]));
  const delta = epochtime - now;
  let ret = "";
  let remaining = delta;
  if (remaining < 0) {
    ret += `${color.fg_red}-${color.reset}`;
    remaining = -remaining;
  }
  if (remaining >= ms_per_day) {
    const d = Math.floor(remaining / ms_per_day);
    ret += `${color.fg_white}${d}${color.fg_red}d${color.reset}`;
    remaining -= d * ms_per_day;
  }
  if (remaining >= ms_per_hour) {
    const h = Math.floor(remaining / ms_per_hour);
    ret += `${color.fg_white}${h}${color.fg_magenta}h${color.reset}`;
    remaining -= h * ms_per_hour;
  }
  if (remaining >= ms_per_min) {
    const m = Math.floor(remaining / ms_per_min);
    ret += `${color.fg_white}${m}${color.fg_yellow}m${color.reset}`;
    remaining -= m * ms_per_min;
  }
  if (remaining >= ms_per_sec) {
    const s = Math.floor(remaining / ms_per_sec);
    ret += `${color.fg_white}${s}${color.fg_cyan}s${color.reset}`;
    remaining -= s * ms_per_sec;
  }
  if (delta >= 5000) {
    if (remaining >= 100) {
      // 5s or more, round to deciseconds
      ret += `${color.fg_white}${Math.ceil(remaining / 100)}${color.reset}`;
    }
   } else {
    if (remaining > 0) {
      // Otherwise, list full ms
      ret += `${color.fg_white}${Math.ceil(remaining)}${color.reset}ms`;
    }
  }
  // Add absolute ISO 8601 if more than 30 seconds in the future
  if (abs_threshold >= 0 && delta > abs_threshold) {
    try {
      const iso_str = datetime.toISOString();
      ret += ` (${iso_str.slice(0, 10)} ${iso_str.slice(11, 19)})`;
    } catch (e) {
      // But don't explode if given absurd values
      ret += "???";
    }
  }
  return ret;
}

export async function main(ns: NS): Promise<void> {
  if (ns.args.length > 0) {
    ns.tprint(format_duration(Number(ns.args[0])));
    return;
  }
}

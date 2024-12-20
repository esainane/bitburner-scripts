
/**
 * range([start], end, [step]): Iterates over [start,end) in steps of step.
 */
export function* range(start_or_end: number, end?: number, step = 1) {
  if (end === undefined) {
    end = start_or_end;
    start_or_end = 0;
  }
  if (step > 0) {
    for (let i = start_or_end; i < end; i += step) {
      yield i;
    }
  } else {
    for (let i = start_or_end; i > end; i += step) {
      yield i;
    }
  }
}

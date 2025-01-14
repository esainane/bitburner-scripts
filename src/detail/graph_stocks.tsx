import { NS, ReactNode } from "@ns";
import { ring_buffer_size, SymbolHistory, SymbolTimeSeries, with_history } from "/archive-stock";
import { React } from "/lib/react";
import { ms_per_min } from "/lib/consts";

const { useState, useEffect } = React;

class Scale {
  private domainMin: number;
  private domainMax: number;
  private rangeMin: number;
  private rangeMax: number;

  constructor() {
    this.domainMin = 0;
    this.domainMax = 1;
    this.rangeMin = 0;
    this.rangeMax = 1;
  }

  domain([min, max]: [number, number]): this {
    this.domainMin = min;
    this.domainMax = max;
    return this;
  }

  range([min, max]: [number, number]): this {
    this.rangeMin = min;
    this.rangeMax = max;
    return this;
  }

  call(value: number): number {
    return ((value - this.domainMin) / (this.domainMax - this.domainMin)) * (this.rangeMax - this.rangeMin) + this.rangeMin;
  }
}

function HistoryGraph({ ns, register_on_killed }: { ns: NS, register_on_killed: (on_kill: () => void) => (() => void) }): React.JSX.Element {
  const [unmount, setUnmount] = useState(false);
  // Listen for the script being killed, and unmount the component when it happens
  useEffect(() => {
    const deregister = register_on_killed(() =>
      setUnmount(true)
    );
    // But if we get unmounted, deregister
    return deregister;
  }, [register_on_killed]);

  return unmount ? (<></>) : (
    <HistoryGraphInner ns={ns} />
  );
}

function HistoryGraphInner({ ns }: { ns: NS }): React.JSX.Element {
  const [history, setHistory] = useState<SymbolHistory>({ index: 0, data: new Map<string, SymbolTimeSeries>() });

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      for await (const history of with_history(ns)) {
        if (!mounted) return;
        setHistory(history);
      }
    };
    // Note: No await here, we let this run in the background
    // Bitburner does not seem to care about handle.nextWrite() or handle.peek() being called in the background.
    // It also doesn't seem to care about them being called when the script has been killed.
    // So we must clean up after ourselves properly to avoid a resource leak.
    poll();
    return () => {
      mounted = false;
    };
  }, [ns]);

  const width = 800;
  const labelWidth = 50;
  const height = 1000;

  const rowYScale = new Scale().domain([0, history.data.size]).range([0, height]);
  const xScale = new Scale().domain([0, ring_buffer_size - 1]).range([labelWidth, width]);

  return (
    <svg width={width} height={height}>
      {Array.from(history.data.keys()).map((symbol, idx) => {
        const series = history.data.get(symbol);
        if (!series) return null;

        // Note: Higher values mean lower on the screen
        const yUpper = rowYScale.call(idx);
        const yLower = rowYScale.call(idx + 0.9);

        const yScale = new Scale().domain([Math.min(...series.ask, ...series.bid), Math.max(...series.ask, ...series.bid)]).range([yLower, yUpper]);

        return (
          <g key={symbol}>
            <text style={{stroke: "white"}} transform={`translate(0, ${yLower})`}>{symbol}</text>
            <path style={{stroke: "white", fill: "none"}} d={`M${series.ask.map((price, i) => `${xScale.call(i)},${yScale.call(price)}`).join('L')}`} />
            <path style={{stroke: "white", fill: "none"}} d={`M${series.bid.map((price, i) => `${xScale.call(i)},${yScale.call(price)}`).join('L')}`} />
          </g>
        );
      })}
      <path style={{stroke: "blue", fill: "none"}} d={
        // Draw a vertical line at the current time
        `M${xScale.call(history.index)},0L${xScale.call(history.index)},${height}`
      } />
    </svg>
  );
}

export async function main(ns: NS): Promise<void> {
  const on_killed: (() => void)[] = [];
  ns.atExit(() => {
    for (const callback of on_killed) {
      callback();
    }
  });
  ns.disableLog('asleep');
  const elt: ReactNode = <HistoryGraph ns={ns} register_on_killed={d => {
    on_killed.push(d);
    return () => {
      const idx = on_killed.findIndex(d);
      if (idx !== -1) {
        on_killed.splice(idx, 1);
      }
    }
  }}/>;
  ns.printRaw(elt);
  // We need to keep the script alive to keep the ns reference valid
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Make sure this isn't too blocky.
    // A script should die when it is killed.
    // Much like in linux, a process can't be fully killed while waiting for the "kernel" to do I/O.
    // Unlike linux, such a "zombie" process isn't already dead; it will consume resources until a reload.
    await ns.asleep(ms_per_min);
  }
}

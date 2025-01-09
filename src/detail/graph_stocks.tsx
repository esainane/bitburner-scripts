import { NS, ReactNode } from "@ns";
import { ring_buffer_size, SymbolHistory, SymbolTimeSeries, with_history } from "/archive-stock";
import { React } from "/lib/react";
import { ms_per_day } from "/lib/consts";

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

function HistoryGraph({ ns }: { ns: NS }): React.JSX.Element {
  const [history, setHistory] = useState<SymbolHistory>({ index: 0, data: new Map<string, SymbolTimeSeries>() });

  useEffect(() => {
    const poll = async () => {
      for await (const history of with_history(ns)) {
        setHistory(history);
      }
    };
    poll();
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
  const elt: ReactNode = <HistoryGraph ns={ns} />;
  ns.printRaw(elt);
  // We need to keep the script alive to keep the ns reference valid
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await ns.asleep(100 * ms_per_day);
  }
}

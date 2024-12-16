import { NS } from "@ns";

import { React, ReactDOM } from "lib/react";

const { useState, useEffect } = React;

const HelloWorld = () => {
  const [text, setText] = useState('Hello, world!');
  useEffect(() => {
    setTimeout(() => setText('Goodbye, world!'), 6000);
  }, []);
  return <h1>{text}</h1>;
}

export async function main(ns: NS): Promise<void> {
  ns.print('React version: ', React.version);
  ns.print('React DOM version: ', ReactDOM.version);
  ns.printRaw(<HelloWorld />);
}

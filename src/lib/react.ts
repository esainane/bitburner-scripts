import type { NS } from '@ns';
import ReactNamespace from 'react/index';
import ReactDomNamespace from 'react-dom';

const eWindow = eval('window');
const eDocument = eval('document');

const React = eWindow.React as typeof ReactNamespace;
const ReactDOM = eWindow.ReactDOM as typeof ReactDomNamespace;

export default React;
export {
  React,
  ReactDOM
}

export async function main(ns: NS): Promise<void> {
  ns.tprint('React version: ', React.version);
  ns.tprint('React DOM version: ', ReactDOM.version);
}

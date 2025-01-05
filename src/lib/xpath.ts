import type { NS } from '@ns';

const eWindow = eval('window');
const eDocument: Document = eval('document');

export function sanitize_for_xpath(value: string): string {
  if (!value.includes("'")) {
    // No single quotes, return as is
    return value;
  }
  // Split the value by single quotes and use concat()
  const parts = value.split("'").map(part => `'${part}'`);
  return `concat('${parts.join(`', "'", "')}`)}`;
}

export function* xpath_all(query: string, context: Node = eDocument): Iterable<Node> {
  const result = eDocument.evaluate(query, context, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
  if (result.resultType !== XPathResult.ORDERED_NODE_ITERATOR_TYPE) {
    throw new Error('Expected ORDERED_NODE_ITERATOR_TYPE');
  }
  do {
    const val = result.iterateNext();
    if (val === null) {
      break;
    }
    yield val;
  } while (true);
}

export function xpath(query: string, context: Node = eDocument): Node | undefined {
  for (const node of xpath_all(query, context)) {
    return node;
  }
  return undefined;
}

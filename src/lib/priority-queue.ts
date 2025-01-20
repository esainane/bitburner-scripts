import { NS } from '@ns'
import { assert_all_passed, assert_eq } from './assert';

export class PriorityQueue<T> {
  private heap: T[] = [];
  private comparator: (a: T, b: T) => number;

  /**
   * Create a new priority queue
   *
   * The queue is a min-heap: A lower value has a higher priority.
   *
   * @param comparator A function that compares two elements of the queue.
   *                   If the result is negative, `a` comes before `b`.
   *                   If the result is positive, `b` comes before `a`.
   *                   If the result is zero, the order is not changed.
   */
  constructor(comparator: (a: T, b: T) => number) {
    this.comparator = comparator;
  }

  heapify(...item: T[]): void {
    this.heap = item;
    for (let i = this.size() - 1; i >= 0; i--) {
      this.siftDown();
    }
  }

  /**
   * Add a new item into the queue
   * @param item The item to push into the queue
   */
  push(item: T): void {
    this.heap.push(item);
    this.siftUp();
  }

  /**
   * Remove and return the item with the highest priority
   *
   * @returns The item with the highest priority, or undefined if the queue is empty
   */
  pop(): T | undefined {
    if (this.size() === 0) return undefined;
    const item = this.heap[0];
    const last = this.heap.pop();
    if (this.size() > 0 && last !== undefined) {
      this.heap[0] = last;
      this.siftDown();
    }
    return item;
  }

  /**
   * Return the item with the highest priority without removing it
   *
   * @returns The item with the highest priority, or undefined if the queue is empty
   */
  peek(): T | undefined {
    return this.heap[0];
  }

  size(): number {
    return this.heap.length;
  }

  public clear(): void {
    this.heap = [];
  }

  private parent = (i: number): number => ((i+1) >>> 1) - 1;
  private leftChild = (i: number): number => (i << 1) + 1;
  private rightChild = (i: number): number => (i + 1) << 1;

  private siftUp(): void {
    let index = this.size() - 1;
    const item = this.heap[index];
    while (index > 0) {
      const parentIndex = this.parent(index);
      const parent = this.heap[parentIndex];
      if (this.comparator(item, parent) >= 0) break;
      this.heap[index] = parent;
      index = parentIndex;
    }
    this.heap[index] = item;
  }

  private siftDown(): void {
    let index = 0;
    const length = this.size();
    const item = this.heap[index];
    // increasing: index
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const leftChildIndex = this.leftChild(index);
      const rightChildIndex = this.rightChild(index);
      let swapIndex = -1;

      if (leftChildIndex < length) {
        const leftChild = this.heap[leftChildIndex];
        if (this.comparator(leftChild, item) < 0) {
          swapIndex = leftChildIndex;
        }
      }

      if (rightChildIndex < length) {
        const rightChild = this.heap[rightChildIndex];
        if (this.comparator(rightChild, swapIndex === -1 ? item : this.heap[swapIndex]) < 0) {
          swapIndex = rightChildIndex;
        }
      }

      if (swapIndex === -1) break;
      this.heap[index] = this.heap[swapIndex];
      index = swapIndex;
    }
    this.heap[index] = item;
  }
}

export async function main(ns: NS): Promise<void> {
  ns.tprint('Testing priority queue implementation');

  const pq = new PriorityQueue<number>((a, b) => a - b);

  pq.push(5);
  pq.push(3);
  pq.push(8);
  pq.push(1);

  assert_eq(ns, 1, pq.pop(), 'Test 1');
  assert_eq(ns, 3, pq.pop(), 'Test 2');
  assert_eq(ns, 5, pq.pop(), 'Test 3');
  assert_eq(ns, 8, pq.pop(), 'Test 4');
  assert_eq(ns, undefined, pq.pop(), 'Test 5');

  const pq2 = new PriorityQueue<{ value: number, priority: number }>((a, b) => a.priority - b.priority);

  pq2.push({ value: 5, priority: 2 });
  pq2.push({ value: 3, priority: 1 });
  pq2.push({ value: 8, priority: 3 });
  pq2.push({ value: 1, priority: 0 });

  assert_eq(ns, 1, pq2.pop()?.value, 'Test 6');
  assert_eq(ns, 3, pq2.pop()?.value, 'Test 7');
  assert_eq(ns, 5, pq2.pop()?.value, 'Test 8');
  assert_eq(ns, 8, pq2.pop()?.value, 'Test 9');
  assert_eq(ns, undefined, pq2.pop()?.value, 'Test 10');

  assert_all_passed(ns);
}

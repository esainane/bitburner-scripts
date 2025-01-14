import { NS } from '@ns'
import { decode_data, encode_data } from '/lib/serialize';
import { mkfifo } from '/lib/mkfifo';

export enum PubSubTag {
  StockHistory = 'stock',
  AutoHackPlanner = 'autohack_planner',
}

/**
 * Publish-subscribe interface.
 *
 * Makes a given value available, one-to-many.
 *
 * @param tag Unique tag to use for the pub-sub channel. Add new channels to the enum above this comment.
 * @returns An object with two methods:
 * - `with_subscription`: An async generator that yields the latest value published to the channel.
 * - `publisher`: An object with two methods:
 */

export function pubsub<T>(tag: PubSubTag) {
  const data_sock = `data/pubsub/${tag}_sock.txt`;
  const data_filename = `data/pubsub/${tag}_state.json`;
  return {
    with_subscription: async function*(ns: NS): AsyncGenerator<T> {
      while (!ns.fileExists(data_sock)) {
        await ns.asleep(1000);
      }
      const sock_id = parseInt(ns.read(data_sock));
      const handle = ns.getPortHandle(sock_id);

      if (handle.empty()) {
        await handle.nextWrite();
      }
      while (true) {
        yield handle.peek() as T;
        await handle.nextWrite();
      }
    },
    publisher: function(ns: NS, default_value: () => T): {
      atexit: () => void,
      get_value: () => T,
      publish: (data: T) => Promise<void>
    } {
      // Load existing data, if any, or use the default
      let latest: T;
      if (ns.fileExists(data_filename)) {
        latest = decode_data(ns.read(data_filename));
      } else {
        latest = default_value();
      }
      // Reuse an existing socket, if any, or create a new one
      let sock_id: number;
      if (ns.fileExists(data_sock)) {
        sock_id = parseInt(ns.read(data_sock));
      } else {
        sock_id = mkfifo(ns);
        ns.write(data_sock, String(sock_id), 'w');
      }
      const handle = ns.getPortHandle(sock_id);
      // Return the callbacks
      return {
        /// Make sure history gets saved at exit
        atexit: () => {
          ns.write(data_filename, encode_data(latest), 'w');
        },
        get_value: () => latest,
        /// Notify all listeners of new data
        publish: async (data: T) => {
          handle.clear();
          handle.write(data);
        }
      };
    }
  };
}

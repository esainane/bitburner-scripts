

# Setup

```bash
npm install
npx bitburner-filesync
```

`npm watch:remote` will also work. The full `npm watch` or `npm watch:all` commands are for when syncing on the transpiled (rather than native) versions of files is desired.

~~`Enable Server` and `Enable Autostart` in Bitburner under the `API Server` menu.~~
~~Add `--remote-debugging-port=9222` to Bitburner's launch options.~~
Do not use the bitburner vscode extension anymore. It does not handle `.ts` files, has been turned into a read-only archive, and has many issues.


In bitburner, `Options` -> `Remote API` -> `Port` -> `12525` to have bitburner connect to the `bitburner-filesync` port.

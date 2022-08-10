# async-cleanup: Asynchronous process cleanup for Node.js and Typescript

[![npm](https://img.shields.io/npm/v/async-cleanup)](https://www.npmjs.com/package/async-cleanup)
[![CircleCI](https://img.shields.io/circleci/build/github/trevorr/async-cleanup)](https://circleci.com/gh/trevorr/async-cleanup)

A common need for Node.js applications is to execute some sort of cleanup code before the process exits, regardless of what caused it to exit.
Furthermore, cleanup code often involves asynchronous operations such as file or network I/O.
For example, imagine having a lock file that prevents multiple instances of an application from running concurrently.
Whether the application completes successfully, crashes from an unhandled exception, or is interrupted with Ctrl-C, the lock file must be deleted before exit.
This library makes writing asynchronous cleanup code as easy as calling a single function.
It has no runtime dependencies, compiles to ES6 for wide compatibility, and has a package size of 5.1 kB.

## Installation

```sh
npm install async-cleanup
```

## Usage

Typical usage might look something like [this](examples/readme.ts):

```ts
import { addCleanupListener, exitAfterCleanup } from "async-cleanup";
import { unlink, writeFile } from "fs/promises";

void (async function () {
  const path = ".lockfile";
  try {
    await writeFile(path, String(process.pid), { flag: "wx" });
  } catch (err) {
    if ((err as { code?: string }).code === "EEXIST") {
      console.log(`${path} already exists`);
    } else {
      console.log(`Error writing ${path}`, err);
    }
    // Can't use process.exit with async cleanup
    await exitAfterCleanup(1);
  }
  console.log(`Created ${path}`);

  addCleanupListener(async () => {
    await unlink(path);
    console.log(`Deleted ${path}`);
  });

  // Do stuff...

  console.log("Stuff done");
})();
```

The output of the program above might look like this (depending on how concurrently it is run):

```
$ concurrently 'ts-node examples/readme.ts' 'ts-node examples/readme.ts' 'ts-node examples/readme.ts'

[1] .lockfile already exists
[0] .lockfile already exists
[2] Created .lockfile
[2] Stuff done
[2] Exiting with code 0 due to empty event loop
[2] Deleted .lockfile
[1] ts-node examples/readme.ts exited with code 1
[2] ts-node examples/readme.ts exited with code 0
[0] ts-node examples/readme.ts exited with code 1
```

## API Reference

```ts
/**
 * A possibly asynchronous function invoked with the process is about to exit.
 */
type CleanupListener = () => void | Promise<void>;

/**
 * Registers a new cleanup listener.
 * Adding the same listener more than once has no effect.
 */
function addCleanupListener(listener: CleanupListener): void;

/**
 * Removes an existing cleanup listener, and returns whether the listener was registered.
 */
function removeCleanupListener(listener: CleanupListener): boolean;

/**
 * Executes all cleanup listeners and then exits the process.
 * Call this instead of `process.exit` to ensure all listeners are fully executed.
 */
function exitAfterCleanup(code?: number): Promise<never>;

/**
 * Executes all cleanup listeners and then kills the process with the given signal.
 */
function killAfterCleanup(signal: ExitSignal): Promise<void>;

/**
 * Signals that can terminate the process.
 */
type ExitSignal =
  | "SIGBREAK"
  | "SIGHUP"
  | "SIGINT"
  | "SIGTERM"
  | "SIGUSR2"
  | "SIGKILL"
  | "SIGQUIT"
  | "SIGSTOP";
```

## License

`async-cleanup` is available under the [ISC license](LICENSE).

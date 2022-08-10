import {
  addCleanupListener,
  exitAfterCleanup,
  removeCleanupListener,
} from "./index";

beforeEach(() => {
  jest.restoreAllMocks();
});

interface EventHandler {
  event: string | symbol;
  listener: (...args: unknown[]) => void;
}

function mockProcessOn(): {
  handlers: EventHandler[];
  processOn: jest.SpyInstance<
    NodeJS.Process,
    [event: EventHandler["event"], listener: EventHandler["listener"]]
  >;
} {
  const handlers: EventHandler[] = [];
  const processOn = jest
    .spyOn(process, "on")
    .mockImplementation((event: string | symbol, listener: () => void) => {
      handlers.push({ event, listener });
      return process;
    });
  return { handlers, processOn };
}

function mockProcessExit(): {
  exitPromise: Promise<void>;
  processExit: jest.SpyInstance<never, [code?: number]>;
} {
  let resolveExit: (value?: void) => void;
  const exitPromise = new Promise<void>((resolve) => (resolveExit = resolve));
  const processExit = jest
    .spyOn(process, "exit")
    .mockImplementation((() => resolveExit()) as () => never);
  return { exitPromise, processExit };
}

function mockProcessKill(): {
  killPromise: Promise<void>;
  processKill: jest.SpyInstance<true, [pid: number, signal?: string | number]>;
} {
  let resolveKill: (value?: void) => void;
  const killPromise = new Promise<void>((resolve) => (resolveKill = resolve));
  const processKill = jest
    .spyOn(process, "kill")
    .mockImplementation((() => resolveKill()) as () => never);
  return { killPromise, processKill };
}

test("hooks beforeExit without exit code", async () => {
  const { handlers } = mockProcessOn();
  const { exitPromise, processExit } = mockProcessExit();
  const consoleLog = jest.spyOn(console, "log").mockImplementation();
  const listener = jest.fn();
  addCleanupListener(listener);

  const beforeExit = handlers.find((h) => h.event === "beforeExit");
  expect(beforeExit).not.toBeUndefined();
  beforeExit?.listener();
  expect(listener.mock.calls).toHaveLength(1);

  await exitPromise;
  expect(processExit).toHaveBeenCalledWith(0);
  expect(consoleLog).toHaveBeenCalled();
  expect(consoleLog.mock.calls[0][0]).toBe(
    "Exiting with code undefined due to empty event loop"
  );
});

test("hooks beforeExit with exit code", async () => {
  const { handlers } = mockProcessOn();
  const { exitPromise, processExit } = mockProcessExit();
  const consoleLog = jest.spyOn(console, "log").mockImplementation();
  const listener = jest.fn();
  addCleanupListener(listener);

  const exitCode = 42;
  const beforeExit = handlers.find((h) => h.event === "beforeExit");
  expect(beforeExit).not.toBeUndefined();
  beforeExit?.listener(exitCode);
  expect(listener.mock.calls).toHaveLength(1);

  await exitPromise;
  expect(processExit).toHaveBeenCalledWith(exitCode);
  expect(consoleLog).toHaveBeenCalled();
  expect(consoleLog.mock.calls[0][0]).toBe(
    "Exiting with code 42 due to empty event loop"
  );
});

test("hooks uncaughtException", async () => {
  const { handlers } = mockProcessOn();
  const { exitPromise, processExit } = mockProcessExit();
  const consoleError = jest.spyOn(console, "error").mockImplementation();
  const listener = jest.fn();
  addCleanupListener(listener);

  const error = new Error("Test error");
  const uncaughtException = handlers.find(
    (h) => h.event === "uncaughtException"
  );
  expect(uncaughtException).not.toBeUndefined();
  uncaughtException?.listener(error);
  expect(listener.mock.calls).toHaveLength(1);

  await exitPromise;
  expect(processExit).toHaveBeenCalledWith(1);
  expect(consoleError).toHaveBeenCalled();
  expect(consoleError.mock.calls[0][0]).toBe(
    "Exiting with code 1 due to uncaught exception"
  );
});

test("hooks SIGINT", async () => {
  const { handlers } = mockProcessOn();
  const { killPromise, processKill } = mockProcessKill();
  const consoleLog = jest.spyOn(console, "log").mockImplementation();
  const listener = jest.fn();
  addCleanupListener(listener);

  const sigint = handlers.find((h) => h.event === "SIGINT");
  expect(sigint).not.toBeUndefined();
  sigint?.listener("SIGINT");
  expect(listener.mock.calls).toHaveLength(1);

  await killPromise;
  expect(processKill).toHaveBeenCalledWith(process.pid, "SIGINT");
  expect(consoleLog).toHaveBeenCalled();
  expect(consoleLog.mock.calls[0][0]).toBe("Exiting due to signal SIGINT");
});

test("removeCleanupListener", async () => {
  const { processExit } = mockProcessExit();
  const listener = jest.fn();
  addCleanupListener(listener);
  expect(removeCleanupListener(listener)).toBe(true);
  expect(removeCleanupListener(listener)).toBe(false);
  await exitAfterCleanup(0);
  expect(processExit).toHaveBeenCalledWith(0);
});

test("async listener", async () => {
  const { handlers } = mockProcessOn();
  const { exitPromise, processExit } = mockProcessExit();
  const consoleLog = jest.spyOn(console, "log").mockImplementation();
  let resolveListener: (value?: void) => void;
  const listenerPromise = new Promise<void>(
    (resolve) => (resolveListener = resolve)
  );
  const listener = jest.fn(() => listenerPromise);
  addCleanupListener(listener);

  const exitCode = 0;
  const beforeExit = handlers.find((h) => h.event === "beforeExit");
  expect(beforeExit).not.toBeUndefined();
  beforeExit?.listener(exitCode);
  expect(listener.mock.calls).toHaveLength(1);
  expect(processExit).not.toHaveBeenCalled();

  setImmediate(() => {
    resolveListener();
  });

  await exitPromise;
  expect(processExit).toHaveBeenCalledWith(exitCode);
  expect(consoleLog).toHaveBeenCalled();
  expect(consoleLog.mock.calls[0][0]).toBe(
    "Exiting with code 0 due to empty event loop"
  );
});

test("multiple listeners", async () => {
  const { handlers } = mockProcessOn();
  const { exitPromise, processExit } = mockProcessExit();
  const consoleLog = jest.spyOn(console, "log").mockImplementation();
  const listener1 = jest.fn();
  addCleanupListener(listener1);
  const listener2 = jest.fn();
  addCleanupListener(listener2);

  const exitCode = 0;
  const beforeExit = handlers.find((h) => h.event === "beforeExit");
  expect(beforeExit).not.toBeUndefined();
  beforeExit?.listener(exitCode);
  expect(listener1.mock.calls).toHaveLength(1);
  expect(listener2.mock.calls).toHaveLength(1);

  await exitPromise;
  expect(processExit).toHaveBeenCalledWith(exitCode);
  expect(consoleLog).toHaveBeenCalled();
  expect(consoleLog.mock.calls[0][0]).toBe(
    "Exiting with code 0 due to empty event loop"
  );
});

test("uncaught exception in listener", async () => {
  const { handlers } = mockProcessOn();
  const { exitPromise, processExit } = mockProcessExit();
  const consoleLog = jest.spyOn(console, "log").mockImplementation();
  const consoleError = jest.spyOn(console, "error").mockImplementation();
  const listener1 = jest.fn(() => {
    throw new Error("Test error");
  });
  addCleanupListener(listener1);
  const listener2 = jest.fn();
  addCleanupListener(listener2);

  const exitCode = 0;
  const beforeExit = handlers.find((h) => h.event === "beforeExit");
  expect(beforeExit).not.toBeUndefined();
  beforeExit?.listener(exitCode);
  expect(listener1.mock.calls).toHaveLength(1);
  expect(listener2.mock.calls).toHaveLength(1);

  await exitPromise;
  expect(processExit).toHaveBeenCalledWith(exitCode);
  expect(consoleLog).toHaveBeenCalled();
  expect(consoleLog.mock.calls[0][0]).toBe(
    "Exiting with code 0 due to empty event loop"
  );
  expect(consoleError).toHaveBeenCalled();
  expect(consoleError.mock.calls[0][0]).toBe(
    "Uncaught exception during cleanup"
  );
});

test("unhandled rejection in listener", async () => {
  const { handlers } = mockProcessOn();
  const { exitPromise, processExit } = mockProcessExit();
  const consoleLog = jest.spyOn(console, "log").mockImplementation();
  const consoleError = jest.spyOn(console, "error").mockImplementation();
  const listener1 = jest.fn(() => {
    return Promise.reject(new Error("Test error"));
  });
  addCleanupListener(listener1);
  const listener2 = jest.fn();
  addCleanupListener(listener2);

  const exitCode = 0;
  const beforeExit = handlers.find((h) => h.event === "beforeExit");
  expect(beforeExit).not.toBeUndefined();
  beforeExit?.listener(exitCode);
  expect(listener1.mock.calls).toHaveLength(1);
  expect(listener2.mock.calls).toHaveLength(1);

  await exitPromise;
  expect(processExit).toHaveBeenCalledWith(exitCode);
  expect(consoleLog).toHaveBeenCalled();
  expect(consoleLog.mock.calls[0][0]).toBe(
    "Exiting with code 0 due to empty event loop"
  );
  expect(consoleError).toHaveBeenCalled();
  expect(consoleError.mock.calls[0][0]).toBe(
    "Unhandled rejection during cleanup"
  );
});

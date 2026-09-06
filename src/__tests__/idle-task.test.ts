import { scheduleIdleTask } from "../utils/idle-task";

const originalRequest = Object.getOwnPropertyDescriptor(globalThis, "requestIdleCallback");
const originalCancel = Object.getOwnPropertyDescriptor(globalThis, "cancelIdleCallback");

afterEach(() => {
  for (const [name, descriptor] of [
    ["requestIdleCallback", originalRequest], ["cancelIdleCallback", originalCancel],
  ] as const) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
  jest.useRealTimers();
});

function mockIdleCallbacks() {
  let queued: (() => void) | undefined;
  const request = jest.fn((callback: () => void) => { queued = callback; return 0; });
  const cancel = jest.fn();
  Object.defineProperty(globalThis, "requestIdleCallback", { value: request, configurable: true });
  Object.defineProperty(globalThis, "cancelIdleCallback", { value: cancel, configurable: true });
  return { request, cancel, flush: () => queued?.() };
}

test("defers work to idle time with a deadline so updates cannot starve", () => {
  const idle = mockIdleCallbacks();
  const task = jest.fn();
  const cancel = scheduleIdleTask(task);
  expect(task).not.toHaveBeenCalled();
  expect(idle.request).toHaveBeenCalledWith(expect.any(Function), { timeout: 1000 });
  idle.flush();
  idle.flush();
  expect(task).toHaveBeenCalledTimes(1);
  cancel();
  expect(idle.cancel).not.toHaveBeenCalled();
});

test("cancels even handle zero and ignores a callback already queued for dispatch", () => {
  const idle = mockIdleCallbacks();
  const task = jest.fn();
  const cancel = scheduleIdleTask(task);
  cancel();
  cancel();
  idle.flush();
  expect(idle.cancel).toHaveBeenCalledTimes(1);
  expect(idle.cancel).toHaveBeenCalledWith(0);
  expect(task).not.toHaveBeenCalled();
});

test("falls back to cancellable timers when idle callbacks are unavailable", () => {
  Object.defineProperty(globalThis, "requestIdleCallback", { value: undefined, configurable: true });
  Object.defineProperty(globalThis, "cancelIdleCallback", { value: undefined, configurable: true });
  jest.useFakeTimers();
  const stale = jest.fn();
  const current = jest.fn();
  const cancel = scheduleIdleTask(stale);
  scheduleIdleTask(current);
  cancel();
  expect(current).not.toHaveBeenCalled();
  jest.runAllTimers();
  expect(stale).not.toHaveBeenCalled();
  expect(current).toHaveBeenCalledTimes(1);
});

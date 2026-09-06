// React Native supports idle callbacks; some web browsers still need a timer.
export function scheduleIdleTask(task: () => void): () => void {
  let pending = true;
  const run = () => {
    if (!pending) return;
    pending = false;
    task();
  };

  let cancel: () => void;
  if (typeof requestIdleCallback === "function" && typeof cancelIdleCallback === "function") {
    const id = requestIdleCallback(run, { timeout: 1000 });
    cancel = () => cancelIdleCallback(id);
  } else {
    const id = setTimeout(run, 0);
    cancel = () => clearTimeout(id);
  }

  return () => {
    if (!pending) return;
    pending = false;
    cancel();
  };
}

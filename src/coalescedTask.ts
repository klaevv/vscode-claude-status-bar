export function coalescedTask(task: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | undefined;
  let rerun = false;

  return async () => {
    if (running) {
      rerun = true;
      return running;
    }
    running = (async () => {
      do {
        rerun = false;
        await task();
      } while (rerun);
    })();
    try {
      await running;
    } finally {
      running = undefined;
    }
  };
}

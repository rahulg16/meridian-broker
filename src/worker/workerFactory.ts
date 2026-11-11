/**
 * Spawns the Web Worker mock generator.
 *
 * Uses Vite's worker syntax (`new Worker(new URL(...))`) to bundle the
 * worker script. In production with a real feed, this would be replaced by
 * a WebSocket client that implements the same MarketDataProvider interface.
 *
 * Returns a controller with:
 * - postMessage: send commands to the worker
 * - terminate: clean up on logout/tab close
 */
export function createWorker(onMessage: (data: unknown) => void) {
  const worker = new Worker(
    new URL('./marketGenerator.ts', import.meta.url),
    { type: 'module' }
  );

  worker.onmessage = (event) => {
    onMessage(event.data);
  };

  return {
    postMessage: (msg: unknown) => {
      worker.postMessage(msg);
    },
    terminate: () => {
      worker.terminate();
    },
  };
}

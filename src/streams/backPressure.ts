/**
 * Back-pressure policy for the stream ingestor.
 *
 * When the main thread can't keep up with the Web Worker's production rate,
 * we either drop oldest ticks or throttle the worker rate.
 */

export type BackPressurePolicy = 'dropOldest' | 'throttle';

export interface BackPressureConfig {
  policy: BackPressurePolicy;
  maxBufferSize: number; // Max ticks in ring buffer before applying pressure
  onThrottle?: (hz: number) => void;
}

export class BackPressureController {
  private policy: BackPressurePolicy;
  private maxBufferSize: number;
  private onThrottle?: (hz: number) => void;
  private currentHz: number;

  constructor(config: BackPressureConfig) {
    this.policy = config.policy;
    this.maxBufferSize = config.maxBufferSize;
    this.onThrottle = config.onThrottle;
    this.currentHz = 60;
  }

  /**
   * Called when a batch is about to be pushed. Returns whether to proceed
   * or adjust the worker rate.
   */
  check(bufferCount: number): { proceed: boolean; newHz?: number } {
    if (bufferCount < this.maxBufferSize) {
      return { proceed: true };
    }

    if (this.policy === 'throttle') {
      // Slow down the worker by 25%
      this.currentHz = Math.max(10, Math.floor(this.currentHz * 0.75));
      this.onThrottle?.(this.currentHz);
      return { proceed: false, newHz: this.currentHz };
    }

    // dropOldest: proceed but let the ring buffer overwrite old ticks
    return { proceed: true };
  }

  reset(): void {
    this.currentHz = 60;
  }
}

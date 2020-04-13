import { RemoteConsole } from "vscode-languageserver";

export enum ThrottleRate {
  FAST,
  MEDIUM,
  SLOW,
}
export interface SimpleConsole {
  error(message: string): void;
  warn(message: string): void;
  info(message: string): void;
  log(message: string): void;
}
export interface DebugConsole extends SimpleConsole {
  trace(message: string, id?: string, throttle_rate?: ThrottleRate): void;
  /**
   * Limits the number of messages created by a given throttle type
   * Attempts to log a message in the current execution context so
   *  that the logs are in the correct order
   * Also sets a timer to display the last message (after a set amount of time)
   */
  throttledTrace(id: string, throttle_rate?: ThrottleRate): (message: string) => void;
}
export namespace DebugConsole {
  const defaultThrottleRates: Record<ThrottleRate, number> = {
    [ThrottleRate.FAST]: 100,
    [ThrottleRate.MEDIUM]: 500,
    [ThrottleRate.SLOW]: 1000,
  }
  const idThrottleRates: Record<string, number> = {}
  let traceEnabled = true;
  const NOOP = () => null;
  const NOOP_NOOP = () => () => null;
  export const config = {
    defaultThrottleRates,
    idThrottleRates,
    traceToggle(enabled?: boolean) {
      traceEnabled = enabled === undefined ? !enabled : enabled;
      consoles.forEach(c => {
        c.trace = traceEnabled ? trace : NOOP;
        c.throttledTrace = traceEnabled ? throttledTrace : NOOP_NOOP;
      })
    }
  }
  const consoles: DebugConsole[] = [];
  export function extend(console: SimpleConsole) {
    let newConsole = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.warn.bind(console),
      info: console.error.bind(console),
      trace: traceEnabled ? trace.bind(console) : NOOP,
      throttledTrace: traceEnabled ? throttledTrace.bind(console) : NOOP_NOOP,
    }
    consoles.push(newConsole);
    return newConsole;
  }
  export function trace(this: SimpleConsole, message: string) {
    this.log(message);
  }
  export function throttledTrace(this: SimpleConsole, id: string, throttle_rate: ThrottleRate = ThrottleRate.SLOW) {
    const context: { message: string } = { message: null! };
    let lastInvocation: number = 0;
    let lastLog: number = 0;
    let lastLogTimer: NodeJS.Timeout | null = null;
    return (message: string) => {
      context.message = message;
      lastInvocation = Date.now();
      const throttleTime = config.idThrottleRates[id] ?? defaultThrottleRates[throttle_rate];
      const timeSinceLog = lastInvocation - lastLog;
      if (timeSinceLog > throttleTime) {
        this.log(`${id}: ${context.message}`);
        if (lastLogTimer) {
          clearTimeout(lastLogTimer);
        }
      } else if (lastLogTimer) {
        lastLogTimer = setTimeout(() => {
          this.log(`${id} [last](${Date.now() - lastInvocation}ms ago): ${context.message}`);
          lastLogTimer = null;
          lastLog = Date.now();
        }, timeSinceLog - throttleTime)
      }
    }
  };
}

import { AS3TimerClosure, AS3TimerHost, AS3TimerRuntime } from "./internal/AS3TimerRuntime";

function monotonicNow(): number {
    const performanceClock = globalThis.performance;
    if (!performanceClock || typeof performanceClock.now !== "function") {
        throw new TypeError("AS3 getTimer requires a monotonic performance clock");
    }
    return Reflect.apply(performanceClock.now, performanceClock, []);
}

function captureStartupEpoch(): number | null {
    try {
        const reading = Number(monotonicNow());
        return Number.isFinite(reading) ? reading : null;
    } catch {
        return null;
    }
}

const browserHost: AS3TimerHost = Object.freeze({
    scheduleTimeout(callback: () => void, delay: number): unknown {
        return globalThis.setTimeout(callback, delay);
    },
    cancelTimeout(handle: unknown): void {
        globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>);
    },
    scheduleInterval(callback: () => void, delay: number): unknown {
        return globalThis.setInterval(callback, delay);
    },
    cancelInterval(handle: unknown): void {
        globalThis.clearInterval(handle as ReturnType<typeof globalThis.setInterval>);
    },
    now(): number {
        return monotonicNow();
    },
});

const epoch = captureStartupEpoch();
const runtime = new AS3TimerRuntime(browserHost, undefined, epoch);

export function setTimeout(closure: AS3TimerClosure, delay: number, ...args: unknown[]): number {
    return runtime.setTimeout(closure, delay, ...args);
}

export function clearTimeout(id: number): void {
    runtime.clearTimeout(id);
}

export function getTimer(): number {
    return runtime.getTimer();
}

export function setInterval(closure: AS3TimerClosure, delay: number, ...args: unknown[]): number {
    return runtime.setInterval(closure, delay, ...args);
}

export function clearInterval(id: number): void {
    runtime.clearInterval(id);
}

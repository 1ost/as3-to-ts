import { AS3TimerClosure, AS3TimerHost, AS3TimerRuntime } from "./internal/AS3TimerRuntime";

const browserHost: AS3TimerHost = Object.freeze({
    schedule(callback: () => void, delay: number): unknown {
        return globalThis.setTimeout(callback, delay);
    },
    cancel(handle: unknown): void {
        globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>);
    },
});

const runtime = new AS3TimerRuntime(browserHost);

export function setTimeout(closure: AS3TimerClosure, delay: number, ...args: unknown[]): number {
    return runtime.setTimeout(closure, delay, ...args);
}

export function clearTimeout(id: number): void {
    runtime.clearTimeout(id);
}

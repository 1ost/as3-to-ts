export type AS3TimerClosure = Function;

export interface AS3TimerHost {
    scheduleTimeout(callback: () => void, delay: number): unknown;
    cancelTimeout(handle: unknown): void;
    scheduleInterval(callback: () => void, delay: number): unknown;
    cancelInterval(handle: unknown): void;
    now?(): number;
}

interface TimerEntry {
    kind: "timeout" | "interval";
    hostHandle: unknown;
    closure: AS3TimerClosure;
    args: unknown[];
}

const UINT_MAX = 0xffffffff;
const MAX_HOST_DELAY = 0x7fffffff;

function normalizeDelay(value: number): number {
    const numeric = Number(value);
    if (Number.isNaN(numeric) || numeric <= 0) return 0;
    if (numeric === Infinity) return MAX_HOST_DELAY;
    return Math.min(numeric, MAX_HOST_DELAY);
}

export class AS3TimerRuntime {
    private readonly entries = new Map<number, TimerEntry>();
    private readonly epoch: number | null;
    private lastNow: number | null;
    private nextId = 1;

    public constructor(private readonly host: AS3TimerHost, private readonly maximumId: number = UINT_MAX,
        epoch: number | null = null) {
        if (!host || typeof host.scheduleTimeout !== "function" || typeof host.cancelTimeout !== "function"
            || typeof host.scheduleInterval !== "function" || typeof host.cancelInterval !== "function"
            || !Number.isSafeInteger(maximumId) || maximumId < 1 || maximumId > UINT_MAX) {
            throw new TypeError("AS3 timer runtime requires a host and a bounded uint id range");
        }
        if (epoch !== null && !Number.isFinite(epoch)) {
            throw new TypeError("AS3 timer runtime epoch must be a finite monotonic reading");
        }
        this.epoch = epoch;
        this.lastNow = epoch;
    }

    public setTimeout(closure: AS3TimerClosure, delay: number, ...args: unknown[]): number {
        return this.schedule("timeout", closure, delay, args);
    }

    public clearTimeout(id: number): void {
        this.clear(id);
    }

    public getTimer(): number {
        if (this.epoch === null || this.lastNow === null || typeof this.host.now !== "function") {
            throw new TypeError("AS3 getTimer requires a captured epoch and monotonic clock");
        }
        const current = Number(this.host.now());
        if (!Number.isFinite(current) || current < this.lastNow) {
            throw new RangeError("AS3 getTimer requires a finite nondecreasing monotonic clock");
        }
        this.lastNow = current;
        return Math.trunc(current - this.epoch) | 0;
    }

    public setInterval(closure: AS3TimerClosure, delay: number, ...args: unknown[]): number {
        return this.schedule("interval", closure, delay, args);
    }

    public clearInterval(id: number): void {
        this.clear(id);
    }

    private schedule(kind: "timeout" | "interval", closure: AS3TimerClosure, delay: number,
        args: unknown[]): number {
        if (typeof closure !== "function") throw new TypeError(`${kind} closure must be a Function`);
        const id = this.allocateId();
        const entry: TimerEntry = { kind, hostHandle: null, closure, args: args.slice() };
        this.entries.set(id, entry);
        try {
            const callback = () => {
                const current = this.entries.get(id);
                if (current !== entry) return;
                if (current.kind === "timeout") this.entries.delete(id);
                Reflect.apply(current.closure, undefined, current.args);
            };
            entry.hostHandle = kind === "timeout"
                ? this.host.scheduleTimeout(callback, normalizeDelay(delay))
                : this.host.scheduleInterval(callback, normalizeDelay(delay));
        } catch (error) {
            this.entries.delete(id);
            throw error;
        }
        return id;
    }

    private clear(id: number): void {
        const normalized = Number(id) >>> 0;
        const entry = this.entries.get(normalized);
        if (!entry) return;
        this.entries.delete(normalized);
        if (entry.kind === "timeout") this.host.cancelTimeout(entry.hostHandle);
        else this.host.cancelInterval(entry.hostHandle);
    }

    private allocateId(): number {
        if (this.entries.size >= this.maximumId) throw new RangeError("AS3 timer id space is exhausted");
        for (let attempts = 0; attempts <= this.entries.size; attempts++) {
            const candidate = this.nextId;
            this.nextId = candidate >= this.maximumId ? 1 : candidate + 1;
            if (!this.entries.has(candidate)) return candidate;
        }
        throw new RangeError("AS3 timer id allocation collision bound was exceeded");
    }
}

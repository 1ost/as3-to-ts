export type AS3TimerClosure = Function;

export interface AS3TimerHost {
    schedule(callback: () => void, delay: number): unknown;
    cancel(handle: unknown): void;
}

interface TimerEntry {
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
    private nextId = 1;

    public constructor(private readonly host: AS3TimerHost, private readonly maximumId: number = UINT_MAX) {
        if (!host || typeof host.schedule !== "function" || typeof host.cancel !== "function"
            || !Number.isSafeInteger(maximumId) || maximumId < 1 || maximumId > UINT_MAX) {
            throw new TypeError("AS3 timer runtime requires a host and a bounded uint id range");
        }
    }

    public setTimeout(closure: AS3TimerClosure, delay: number, ...args: unknown[]): number {
        if (typeof closure !== "function") throw new TypeError("setTimeout closure must be a Function");
        const id = this.allocateId();
        const entry: TimerEntry = { hostHandle: null, closure, args: args.slice() };
        this.entries.set(id, entry);
        try {
            entry.hostHandle = this.host.schedule(() => {
                const current = this.entries.get(id);
                if (current !== entry) return;
                this.entries.delete(id);
                Reflect.apply(current.closure, undefined, current.args);
            }, normalizeDelay(delay));
        } catch (error) {
            this.entries.delete(id);
            throw error;
        }
        return id;
    }

    public clearTimeout(id: number): void {
        const normalized = Number(id) >>> 0;
        const entry = this.entries.get(normalized);
        if (!entry) return;
        this.entries.delete(normalized);
        this.host.cancel(entry.hostHandle);
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

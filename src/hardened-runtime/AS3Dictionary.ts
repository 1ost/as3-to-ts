function isWeakKey(value: unknown): value is object {
    return value !== null && (typeof value === "object" || typeof value === "function");
}

export class AS3Dictionary {
    public readonly weakKeys: boolean;
    private readonly strongValues: Map<unknown, unknown>;
    private readonly weakValues: WeakMap<object, unknown>;
    private readonly weakReferences: WeakMap<object, WeakRef<object>>;
    private readonly liveWeakReferences: Set<WeakRef<object>>;
    private readonly finalizer: FinalizationRegistry<WeakRef<object>>;

    public constructor(weakKeys: boolean = false) {
        if (typeof weakKeys !== "boolean") throw new TypeError("Dictionary weakKeys must be Boolean");
        this.weakKeys = weakKeys;
        this.strongValues = new Map();
        this.weakValues = new WeakMap();
        this.weakReferences = new WeakMap();
        this.liveWeakReferences = new Set();
        this.finalizer = new FinalizationRegistry(reference => this.liveWeakReferences.delete(reference));
    }

    public get(key: unknown): unknown {
        return this.weakKeys && isWeakKey(key) ? this.weakValues.get(key) : this.strongValues.get(key);
    }

    public set(key: unknown, value: unknown): unknown {
        if (this.weakKeys && isWeakKey(key)) {
            let reference = this.weakReferences.get(key);
            if (!reference) {
                reference = new WeakRef(key);
                this.weakReferences.set(key, reference);
                this.liveWeakReferences.add(reference);
                this.finalizer.register(key, reference, reference);
            }
            this.weakValues.set(key, value);
        } else {
            this.strongValues.set(key, value);
        }
        return value;
    }

    public has(key: unknown): boolean {
        return this.weakKeys && isWeakKey(key) ? this.weakValues.has(key) : this.strongValues.has(key);
    }

    public delete(key: unknown): boolean {
        if (this.weakKeys && isWeakKey(key)) {
            const reference = this.weakReferences.get(key);
            if (!reference || !this.weakValues.delete(key)) return false;
            this.weakReferences.delete(key);
            this.liveWeakReferences.delete(reference);
            this.finalizer.unregister(reference);
            return true;
        }
        return this.strongValues.delete(key);
    }

    public *keys(): IterableIterator<unknown> {
        yield* this.strongValues.keys();
        if (!this.weakKeys) return;
        for (const reference of Array.from(this.liveWeakReferences)) {
            const key = reference.deref();
            if (key === undefined) {
                this.liveWeakReferences.delete(reference);
            } else if (this.weakValues.has(key)) {
                yield key;
            }
        }
    }

    public *values(): IterableIterator<unknown> {
        for (const key of this.keys()) yield this.get(key);
    }
}

import { AS3TypeToken, as3PredicateType } from "./AS3Type";

export interface AS3VectorElementPolicy<T> {
    readonly name: string;
    defaultValue(): T;
    coerce(value: unknown): T;
}

type MutableVector<T> = AS3Vector<T> & { [index: number]: T };

const MAX_VECTOR_LENGTH = 0x00ffffff;
const ARRAY_INDEX = /^(?:0|[1-9][0-9]*)$/;
const REFERENCE_POLICIES = new WeakMap<Function, AS3VectorElementPolicy<object | null>>();
const NESTED_POLICIES = new WeakMap<object, AS3VectorElementPolicy<AS3Vector<unknown> | null>>();
const VECTOR_TYPES = new WeakMap<object, AS3TypeToken<AS3Vector<unknown>>>();

function range(message: string): never {
    throw new RangeError(message);
}

function lengthValue(value: unknown): number {
    const number = Number(value) >>> 0;
    if (number > MAX_VECTOR_LENGTH) {
        range(`AS3 Vector length must be an integer from 0 through ${MAX_VECTOR_LENGTH}`);
    }
    return number;
}

function arrayIndex(property: PropertyKey): number | null {
    if (typeof property !== "string" || !ARRAY_INDEX.test(property)) return null;
    const value = Number(property);
    return Number.isSafeInteger(value) && value <= 0xffffffff - 1 ? value : null;
}

function scalarPolicy<T>(name: string, fallback: T, coerce: (value: unknown) => T): AS3VectorElementPolicy<T> {
    return Object.freeze({ name, defaultValue: () => fallback, coerce });
}

export const AS3VectorPolicies = Object.freeze({
    int: scalarPolicy<number>("int", 0, value => Number(value) >> 0),
    uint: scalarPolicy<number>("uint", 0, value => Number(value) >>> 0),
    number: scalarPolicy<number>("Number", 0, value => Number(value)),
    boolean: scalarPolicy<boolean>("Boolean", false, value => Boolean(value)),
    string: scalarPolicy<string | null>("String", null, value => value === null || value === undefined ? null : String(value)),
    object: scalarPolicy<unknown>("Object", null, value => value),
});

export function as3VectorReference<T extends object>(name: string,
    constructor: abstract new (...args: never[]) => T): AS3VectorElementPolicy<T | null> {
    if (typeof name !== "string" || name.length === 0 || typeof constructor !== "function") {
        throw new TypeError("AS3 Vector reference policy requires a name and constructor");
    }
    const cached = REFERENCE_POLICIES.get(constructor);
    if (cached) {
        if (cached.name !== name) throw new TypeError("AS3 Vector reference constructor has a different identity");
        return cached as AS3VectorElementPolicy<T | null>;
    }
    const created = Object.freeze({
        name,
        defaultValue: () => null,
        coerce(value: unknown): T | null {
            if (value === null || value === undefined) return null;
            if (!(value instanceof constructor)) {
                throw new TypeError(`AS3 Vector.<${name}> rejected an incompatible value`);
            }
            return value;
        },
    });
    REFERENCE_POLICIES.set(constructor, created as AS3VectorElementPolicy<object | null>);
    return created;
}

export function as3VectorType<T>(policy: AS3VectorElementPolicy<T>): AS3TypeToken<AS3Vector<T>> {
    const cached = VECTOR_TYPES.get(policy as object);
    if (cached) return cached as AS3TypeToken<AS3Vector<T>>;
    const created = as3PredicateType<AS3Vector<T>>(`Vector.<${policy.name}>`,
        (value): value is AS3Vector<T> => value instanceof AS3Vector && value.elementPolicy === policy);
    VECTOR_TYPES.set(policy as object, created as AS3TypeToken<AS3Vector<unknown>>);
    return created;
}

export function as3VectorNested<T>(elementPolicy: AS3VectorElementPolicy<T>):
    AS3VectorElementPolicy<AS3Vector<T> | null> {
    const cached = NESTED_POLICIES.get(elementPolicy as object);
    if (cached) return cached as AS3VectorElementPolicy<AS3Vector<T> | null>;
    const created = Object.freeze({
        name: `Vector.<${elementPolicy.name}>`,
        defaultValue: () => null,
        coerce(value: unknown): AS3Vector<T> | null {
            if (value === null || value === undefined) return null;
            if (!(value instanceof AS3Vector) || value.elementPolicy !== elementPolicy) {
                throw new TypeError(`AS3 Vector.<Vector.<${elementPolicy.name}>> rejected an incompatible value`);
            }
            return value as AS3Vector<T>;
        },
    });
    NESTED_POLICIES.set(elementPolicy as object, created as AS3VectorElementPolicy<AS3Vector<unknown> | null>);
    return created;
}

export class AS3Vector<T> implements Iterable<T> {
    [index: number]: T;
    private readonly _policy: AS3VectorElementPolicy<T>;
    private readonly _values: T[];
    private _fixed: boolean;
    private readonly _closures = new Map<PropertyKey, Function>();

    public constructor(policy: AS3VectorElementPolicy<T>, length: number = 0, fixed: boolean = false) {
        if (!policy || typeof policy.defaultValue !== "function" || typeof policy.coerce !== "function") {
            throw new TypeError("AS3 Vector requires an element policy");
        }
        const count = lengthValue(length);
        this._policy = policy;
        this._values = Array.from({ length: count }, () => policy.defaultValue());
        this._fixed = Boolean(fixed);
        const proxy = new Proxy(this, {
            get: (target, property, receiver) => {
                const index = arrayIndex(property);
                if (index !== null) return target._get(index);
                const value = Reflect.get(target, property, receiver);
                if (typeof value !== "function" || property === "constructor") return value;
                let closure = target._closures.get(property);
                if (!closure) {
                    const bound = value.bind(receiver) as Function;
                    target._closures.set(property, bound);
                    closure = bound;
                }
                return closure!;
            },
            set: (target, property, value, receiver) => {
                const index = arrayIndex(property);
                if (index !== null) {
                    target._set(index, value);
                    return true;
                }
                return Reflect.set(target, property, value, receiver);
            },
            has: (target, property) => {
                const index = arrayIndex(property);
                return index === null ? Reflect.has(target, property) : index < target._values.length;
            },
        });
        return proxy as MutableVector<T>;
    }

    public static from<T>(policy: AS3VectorElementPolicy<T>, source: Iterable<unknown> | ArrayLike<unknown>,
        fixed: boolean = false): AS3Vector<T> {
        if (source === null || source === undefined || (typeof (source as Iterable<unknown>)[Symbol.iterator] !== "function"
            && (!Number.isInteger(Number((source as ArrayLike<unknown>).length))))) {
            throw new TypeError("AS3 Vector conversion requires an iterable or array-like value");
        }
        const arrayLike = source as ArrayLike<unknown>;
        const raw = typeof (source as Iterable<unknown>)[Symbol.iterator] === "function"
            ? Array.from(source as Iterable<unknown>)
            : Array.from({ length: lengthValue(arrayLike.length) }, (_, index) => arrayLike[index]);
        const values = raw.map(value => policy.coerce(value));
        const vector = new AS3Vector<T>(policy);
        vector._values.push(...values);
        vector._fixed = Boolean(fixed);
        return vector;
    }

    public get length(): number { return this._values.length; }
    public set length(value: number) {
        const count = lengthValue(value);
        this._assertResize(count);
        if (count < this._values.length) this._values.length = count;
        while (this._values.length < count) this._values.push(this._policy.defaultValue());
    }

    public get fixed(): boolean { return this._fixed; }
    public set fixed(value: boolean) { this._fixed = Boolean(value); }
    public get elementPolicy(): AS3VectorElementPolicy<T> { return this._policy; }

    public push(...items: unknown[]): number {
        const values = items.map(value => this._policy.coerce(value));
        this._assertResize(this.length + values.length);
        return this._values.push(...values);
    }

    public pop(): T {
        this._assertResize(Math.max(0, this.length - 1));
        return this._values.length === 0 ? this._policy.defaultValue() : this._values.pop()!;
    }

    public shift(): T {
        this._assertResize(Math.max(0, this.length - 1));
        return this._values.length === 0 ? this._policy.defaultValue() : this._values.shift()!;
    }

    public unshift(...items: unknown[]): number {
        const values = items.map(value => this._policy.coerce(value));
        this._assertResize(this.length + values.length);
        return this._values.unshift(...values);
    }

    public splice(start: number, deleteCount: number = this.length, ...items: unknown[]): AS3Vector<T> {
        const values = items.map(value => this._policy.coerce(value));
        const actualStart = this._relativeIndex(start);
        const actualDelete = Math.min(Number(deleteCount) >>> 0, this.length - actualStart);
        this._assertResize(this.length - actualDelete + values.length);
        const removed = this._values.splice(actualStart, actualDelete, ...values);
        return AS3Vector.from(this._policy, removed);
    }

    public slice(start: number = 0, end: number = this.length): AS3Vector<T> {
        return AS3Vector.from(this._policy, this._values.slice(this._relativeIndex(start), this._relativeIndex(end)));
    }

    public concat(...values: Array<AS3Vector<T> | ReadonlyArray<T>>): AS3Vector<T> {
        const result = AS3Vector.from(this._policy, this._values);
        for (const value of values) result.push(...Array.from(value));
        return result;
    }

    public indexOf(searchElement: T, fromIndex: number = 0): number {
        return this._values.indexOf(this._policy.coerce(searchElement), Number(fromIndex) >> 0);
    }

    public lastIndexOf(searchElement: T, fromIndex: number = this.length - 1): number {
        return this._values.lastIndexOf(this._policy.coerce(searchElement), Number(fromIndex) >> 0);
    }

    public join(separator: string = ","): string { return this._values.join(separator); }
    public reverse(): AS3Vector<T> { this._values.reverse(); return this; }

    public sort(compareFunction?: (left: T, right: T) => number): AS3Vector<T> {
        if (compareFunction !== undefined && typeof compareFunction !== "function") {
            throw new TypeError("AS3 Vector.sort currently requires a comparator function when an argument is supplied");
        }
        this._values.sort(compareFunction);
        return this;
    }

    public forEach(callback: (value: T, index: number, vector: AS3Vector<T>) => void, thisObject?: unknown): void {
        this._values.forEach((value, index) => callback.call(thisObject, value, index, this));
    }

    public map(callback: (value: T, index: number, vector: AS3Vector<T>) => T, thisObject?: unknown): AS3Vector<T> {
        return AS3Vector.from(this._policy,
            this._values.map((value, index) => callback.call(thisObject, value, index, this)));
    }

    public filter(callback: (value: T, index: number, vector: AS3Vector<T>) => boolean,
        thisObject?: unknown): AS3Vector<T> {
        return AS3Vector.from(this._policy,
            this._values.filter((value, index) => callback.call(thisObject, value, index, this)));
    }

    public every(callback: (value: T, index: number, vector: AS3Vector<T>) => boolean,
        thisObject?: unknown): boolean {
        return this._values.every((value, index) => callback.call(thisObject, value, index, this));
    }

    public some(callback: (value: T, index: number, vector: AS3Vector<T>) => boolean,
        thisObject?: unknown): boolean {
        return this._values.some((value, index) => callback.call(thisObject, value, index, this));
    }

    public toString(): string { return this._values.toString(); }
    public toJSON(): T[] { return this._values.slice(); }
    public [Symbol.iterator](): Iterator<T> { return this._values[Symbol.iterator](); }

    private _get(index: number): T {
        if (index >= this.length) range(`AS3 Vector index ${index} is outside length ${this.length}`);
        return this._values[index]!;
    }

    private _set(index: number, value: unknown): void {
        if (index >= this.length) range(`AS3 Vector index ${index} is outside length ${this.length}`);
        this._values[index] = this._policy.coerce(value);
    }

    private _assertResize(nextLength: number): void {
        lengthValue(nextLength);
        if (this._fixed && nextLength !== this.length) range("AS3 fixed Vector length cannot change");
    }

    private _relativeIndex(value: number): number {
        const integer = Number(value) >> 0;
        return integer < 0 ? Math.max(this.length + integer, 0) : Math.min(integer, this.length);
    }
}

import {
    AS3Types,
    AS3TypeToken,
    as3Is,
    as3ReferenceType,
} from "./AS3Type";
import { isReferenceSubtype, registerVectorType } from "./internal/AS3TypeRegistry";
import { as3BindMethod, isAS3MethodClosure } from "./AS3MethodClosure";

export interface AS3VectorElementPolicy<T> {
    readonly name: string;
    defaultValue(): T;
    coerce(value: unknown): T;
}

type MutableVector<T> = AS3Vector<T> & { [index: number]: T };

const MAX_VECTOR_LENGTH = 0x00ffffff;
const ARRAY_INDEX = /^(?:0|[1-9][0-9]*)$/;
const REFERENCE_TOKEN_POLICIES = new WeakMap<object, AS3VectorElementPolicy<object | null>>();
const REFERENCE_POLICY_TOKENS = new WeakMap<object, AS3TypeToken<object>>();
const NESTED_POLICIES = new WeakMap<object, AS3VectorElementPolicy<AS3Vector<unknown> | null>>();
const POLICIES = new WeakSet<object>();
const VECTOR_TYPES = new WeakMap<object, AS3TypeToken<AS3Vector<unknown>>>();
const RESERVED_STATE_PROPERTIES = new Set<PropertyKey>(["_policy", "_values", "_fixed", "_closures"]);

interface VectorState<T> {
    readonly policy: AS3VectorElementPolicy<T>;
    readonly values: T[];
    fixed: boolean;
    readonly closures: Map<PropertyKey, Function>;
}

const VECTOR_STATES = new WeakMap<object, VectorState<unknown>>();

function stateOf<T>(value: AS3Vector<T>): VectorState<T> {
    const state = VECTOR_STATES.get(value as object);
    if (!state) throw new TypeError("invalid AS3 Vector receiver");
    return state as VectorState<T>;
}

function registerPolicy<T>(policy: AS3VectorElementPolicy<T>): void {
    const predicate = (value: unknown): boolean =>
        (typeof value === "object" || typeof value === "function") && value !== null
        && VECTOR_STATES.get(value as object)?.policy === policy;
    VECTOR_TYPES.set(policy as object,
        registerVectorType<AS3Vector<unknown>>(`Vector.<${policy.name}>`, policy as object, predicate));
}

function range(message: string): never {
    throw new RangeError(message);
}

function conversionFailure(message: string): never {
    const error = new TypeError(message);
    Object.defineProperty(error, "errorID", {value:1034});
    throw error;
}

function requirePolicy<T>(policy: AS3VectorElementPolicy<T>): void {
    if (typeof policy !== "object" || policy === null || !POLICIES.has(policy as object)) {
        throw new TypeError("AS3 Vector requires an authenticated element policy");
    }
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
    return Number.isSafeInteger(value) && value <= 0xffffffff ? value : null;
}

function scalarPolicy<T>(name: string, fallback: T, coerce: (value: unknown) => T): AS3VectorElementPolicy<T> {
    const policy = Object.freeze({ name, defaultValue: () => fallback, coerce });
    POLICIES.add(policy);
    registerPolicy(policy);
    return policy;
}

function referenceScalar<T>(name: string, accept: (value: unknown) => value is T): AS3VectorElementPolicy<T | null> {
    return scalarPolicy<T | null>(name, null, value => {
        if (value === null || value === undefined) return null;
        if (!accept(value)) conversionFailure(`AS3 Vector.<${name}> rejected an incompatible value`);
        return value;
    });
}

export const AS3VectorPolicies = Object.freeze({
    int: scalarPolicy<number>("int", 0, value => Number(value) >> 0),
    uint: scalarPolicy<number>("uint", 0, value => Number(value) >>> 0),
    number: scalarPolicy<number>("Number", Number.NaN, value => Number(value)),
    boolean: scalarPolicy<boolean>("Boolean", false, value => Boolean(value)),
    string: scalarPolicy<string | null>("String", null, value => value === null || value === undefined ? null : String(value)),
    object: scalarPolicy<unknown>("Object", null, value => value === null || value === undefined ? null : value),
    array: referenceScalar<unknown[]>("Array", Array.isArray),
    class: referenceScalar<Function | AS3TypeToken<unknown>>("Class", (value): value is Function | AS3TypeToken<unknown> =>
        as3Is(value, AS3Types.Class)),
    function: referenceScalar<Function>("Function", (value): value is Function =>
        as3Is(value, AS3Types.Function)),
});

export function as3VectorReference<T extends object>(name: string,
    runtimeValue: (abstract new (...args: never[]) => T) | AS3TypeToken<T>): AS3VectorElementPolicy<T | null> {
    const referenceType = as3ReferenceType(name, runtimeValue);
    const cached = REFERENCE_TOKEN_POLICIES.get(referenceType as object);
    if (cached) {
        return cached as AS3VectorElementPolicy<T | null>;
    }
    const created = Object.freeze({
        name: referenceType.name,
        defaultValue: () => null,
        coerce(value: unknown): T | null {
            if (value === null || value === undefined) return null;
            if (!as3Is(value, referenceType)) {
                conversionFailure(`AS3 Vector.<${referenceType.name}> rejected an incompatible value`);
            }
            return value;
        },
    });
    POLICIES.add(created);
    registerPolicy(created);
    REFERENCE_TOKEN_POLICIES.set(referenceType as object, created as AS3VectorElementPolicy<object | null>);
    REFERENCE_POLICY_TOKENS.set(created, referenceType as AS3TypeToken<object>);
    return created;
}

export function as3VectorType<T>(policy: AS3VectorElementPolicy<T>): AS3TypeToken<AS3Vector<T>> {
    requirePolicy(policy);
    return VECTOR_TYPES.get(policy as object)! as AS3TypeToken<AS3Vector<T>>;
}

export function as3VectorNested<T>(elementPolicy: AS3VectorElementPolicy<T>):
    AS3VectorElementPolicy<AS3Vector<T> | null> {
    requirePolicy(elementPolicy);
    const cached = NESTED_POLICIES.get(elementPolicy as object);
    if (cached) return cached as AS3VectorElementPolicy<AS3Vector<T> | null>;
    const created = Object.freeze({
        name: `Vector.<${elementPolicy.name}>`,
        defaultValue: () => null,
        coerce(value: unknown): AS3Vector<T> | null {
            if (value === null || value === undefined) return null;
            if ((typeof value !== "object" && typeof value !== "function")
                || VECTOR_STATES.get(value as object)?.policy !== elementPolicy) {
                throw new TypeError(`AS3 Vector.<Vector.<${elementPolicy.name}>> rejected an incompatible value`);
            }
            return value as AS3Vector<T>;
        },
    });
    POLICIES.add(created);
    registerPolicy(created);
    NESTED_POLICIES.set(elementPolicy as object, created as AS3VectorElementPolicy<AS3Vector<unknown> | null>);
    return created;
}

export class AS3Vector<T> implements Iterable<T> {
    [index: number]: T;

    public constructor(policy: AS3VectorElementPolicy<T>, length: number = 0, fixed: boolean = false) {
        if (new.target !== AS3Vector) {
            throw new TypeError("AS3 Vector is final and cannot be subclassed");
        }
        requirePolicy(policy);
        const count = lengthValue(length);
        const state: VectorState<T> = {
            policy,
            values: Array.from({ length: count }, () => policy.defaultValue()),
            fixed: Boolean(fixed),
            closures: new Map<PropertyKey, Function>(),
        };
        VECTOR_STATES.set(this, state as VectorState<unknown>);
        let proxy: MutableVector<T>;
        proxy = new Proxy(this, {
            get: (target, property, receiver) => {
                if (receiver !== proxy) throw new TypeError("AS3 Vector method/property receiver is not this vector");
                if (RESERVED_STATE_PROPERTIES.has(property)) return undefined;
                const index = arrayIndex(property);
                if (index !== null) return target._get(index);
                const value = Reflect.get(target, property, proxy);
                if (typeof value !== "function" || property === "constructor") return value;
                let closure = state.closures.get(property);
                if (!closure) {
                    const bound = as3BindMethod(proxy, value as (...args: unknown[]) => unknown) as Function;
                    state.closures.set(property, bound);
                    closure = bound;
                }
                return closure!;
            },
            set: (target, property, value, receiver) => {
                if (receiver !== proxy) throw new TypeError("AS3 Vector assignment receiver is not this vector");
                if (RESERVED_STATE_PROPERTIES.has(property)) throw new TypeError("AS3 Vector internal state is not writable");
                const index = arrayIndex(property);
                if (index !== null) {
                    target._set(index, value);
                    return true;
                }
                return Reflect.set(target, property, value, proxy);
            },
            has: (target, property) => {
                const index = arrayIndex(property);
                return index === null ? Reflect.has(target, property) : index < state.values.length;
            },
            defineProperty: (_target, property) => {
                if (RESERVED_STATE_PROPERTIES.has(property) || arrayIndex(property) !== null) {
                    throw new TypeError("AS3 Vector indexed and internal properties cannot be defined directly");
                }
                return false;
            },
            deleteProperty: (_target, property) => {
                if (RESERVED_STATE_PROPERTIES.has(property) || arrayIndex(property) !== null) {
                    throw new TypeError("AS3 Vector indexed and internal properties cannot be deleted");
                }
                return false;
            },
            setPrototypeOf: () => {
                throw new TypeError("AS3 Vector prototype is sealed");
            },
        });
        VECTOR_STATES.set(proxy, state as VectorState<unknown>);
        return proxy;
    }

    public static from<T>(policy: AS3VectorElementPolicy<T>, source: readonly unknown[] | AS3Vector<unknown>,
        fixed: boolean = false): AS3Vector<T> {
        requirePolicy(policy);
        const sourceState = (typeof source === "object" || typeof source === "function") && source !== null
            ? VECTOR_STATES.get(source as object) : undefined;
        if (!Array.isArray(source) && !sourceState) {
            conversionFailure("AS3 Vector conversion requires an Array or authenticated AS3 Vector");
        }
        const arraySource = Array.isArray(source) ? source : null;
        const count = arraySource === null ? sourceState!.values.length : lengthValue(arraySource.length);
        const values: T[] = [];
        for (let index = 0; index < count; index += 1) {
            values.push(policy.coerce(arraySource === null ? sourceState!.values[index] : arraySource[index]));
        }
        const vector = new AS3Vector<T>(policy);
        const state = stateOf(vector);
        for (const value of values) state.values.push(value);
        state.fixed = Boolean(fixed);
        return vector;
    }

    public get length(): number { return stateOf(this).values.length; }
    public set length(value: number) {
        const state = stateOf(this);
        const count = lengthValue(value);
        this._assertResize(count);
        if (count < state.values.length) state.values.length = count;
        while (state.values.length < count) state.values.push(state.policy.defaultValue());
    }

    public get fixed(): boolean { return stateOf(this).fixed; }
    public set fixed(value: boolean) { stateOf(this).fixed = Boolean(value); }
    public get elementPolicy(): AS3VectorElementPolicy<T> { return stateOf(this).policy; }

    public push(...items: unknown[]): number {
        const state = stateOf(this);
        this._assertResize(this.length + items.length);
        const values = items.map(value => state.policy.coerce(value));
        return state.values.push(...values);
    }

    public pop(): T {
        const state = stateOf(this);
        this._assertResize(Math.max(0, this.length - 1));
        return state.values.length === 0 ? state.policy.defaultValue() : state.values.pop()!;
    }

    public shift(): T {
        const state = stateOf(this);
        this._assertResize(Math.max(0, this.length - 1));
        return state.values.length === 0 ? state.policy.defaultValue() : state.values.shift()!;
    }

    public unshift(...items: unknown[]): number {
        const state = stateOf(this);
        this._assertResize(this.length + items.length);
        const values = items.map(value => state.policy.coerce(value));
        return state.values.unshift(...values);
    }

    public splice(start: number, deleteCount: number = this.length, ...items: unknown[]): AS3Vector<T> {
        const state = stateOf(this);
        const actualStart = this._relativeIndex(start);
        const actualDelete = Math.min(Number(deleteCount) >>> 0, this.length - actualStart);
        this._assertResize(this.length - actualDelete + items.length);
        const values = items.map(value => state.policy.coerce(value));
        const removed = state.values.splice(actualStart, actualDelete, ...values);
        return AS3Vector.from(state.policy, removed);
    }

    public slice(start: number = 0, end: number = this.length): AS3Vector<T> {
        const state = stateOf(this);
        return AS3Vector.from(state.policy, state.values.slice(this._relativeIndex(start), this._relativeIndex(end)));
    }

    public concat(...values: AS3Vector<unknown>[]): AS3Vector<T> {
        const state = stateOf(this);
        const result = AS3Vector.from(state.policy, state.values);
        for (const value of values) {
            const other = (typeof value === "object" || typeof value === "function") && value !== null
                ? VECTOR_STATES.get(value as object) : undefined;
            const sourceToken = other && REFERENCE_POLICY_TOKENS.get(other.policy as object);
            const targetToken = REFERENCE_POLICY_TOKENS.get(state.policy as object);
            if (!other || (other.policy !== state.policy
                && state.policy !== AS3VectorPolicies.object
                && (!sourceToken || !targetToken || !isReferenceSubtype(sourceToken, targetToken)))) {
                throw new TypeError("AS3 Vector.concat requires the same element type or an authenticated reference subtype");
            }
            const resultState = stateOf(result);
            result._assertResize(result.length + other.values.length);
            for (const item of other.values) resultState.values.push(state.policy.coerce(item));
        }
        return result;
    }

    public indexOf(searchElement: T, fromIndex: number = 0): number {
        const state = stateOf(this);
        return state.values.indexOf(state.policy.coerce(searchElement), Number(fromIndex) >> 0);
    }

    public lastIndexOf(searchElement: T, fromIndex: number = this.length - 1): number {
        const state = stateOf(this);
        return state.values.lastIndexOf(state.policy.coerce(searchElement), Number(fromIndex) >> 0);
    }

    public join(separator: string = ","): string {
        return stateOf(this).values.map(value => value === null ? "null" : value === undefined ? "undefined" : value).join(separator);
    }
    public reverse(): AS3Vector<T> { stateOf(this).values.reverse(); return this; }

    public sort(sortBehavior?: unknown): AS3Vector<T> {
        const values = stateOf(this).values;
        if (sortBehavior === 16) {
            const ordered = values.map((value, index) => ({ value, index }));
            ordered.sort((left, right) => {
                const leftNumber = Number(left.value);
                const rightNumber = Number(right.value);
                const leftNaN = Number.isNaN(leftNumber);
                const rightNaN = Number.isNaN(rightNumber);
                if (leftNaN || rightNaN) {
                    return leftNaN === rightNaN ? left.index - right.index : leftNaN ? 1 : -1;
                }
                const difference = leftNumber - rightNumber;
                return difference === 0 ? left.index - right.index : difference;
            });
            values.splice(0, values.length, ...ordered.map(item => item.value));
            return this;
        }
        if (sortBehavior !== undefined && typeof sortBehavior !== "function") {
            throw new TypeError("AS3 Vector.sort requires a comparison function or exact Array.NUMERIC flag");
        }
        values.sort(sortBehavior as ((left: T, right: T) => number) | undefined);
        return this;
    }

    public forEach(callback: unknown, thisObject?: unknown): void {
        const callable = this._callback(callback, "forEach", thisObject);
        stateOf(this).values.forEach((value, index) => callable.call(thisObject, value, index, this));
    }

    public map(callback: unknown, thisObject?: unknown): AS3Vector<T> {
        const callable = this._callback(callback, "map", thisObject);
        const state = stateOf(this);
        return AS3Vector.from(state.policy,
            state.values.map((value, index) => callable.call(thisObject, value, index, this)));
    }

    public filter(callback: unknown, thisObject?: unknown): AS3Vector<T> {
        const callable = this._callback(callback, "filter", thisObject);
        const state = stateOf(this);
        return AS3Vector.from(state.policy,
            state.values.filter((value, index) => callable.call(thisObject, value, index, this)));
    }

    public every(callback: unknown, thisObject?: unknown): boolean {
        const callable = this._callback(callback, "every", thisObject);
        return stateOf(this).values.every((value, index) => callable.call(thisObject, value, index, this));
    }

    public some(callback: unknown, thisObject?: unknown): boolean {
        const callable = this._callback(callback, "some", thisObject);
        return stateOf(this).values.some((value, index) => callable.call(thisObject, value, index, this));
    }

    public toString(): string { return stateOf(this).values.toString(); }
    public toJSON(): T[] { return stateOf(this).values.slice(); }
    public [Symbol.iterator](): Iterator<T> { return stateOf(this).values[Symbol.iterator](); }

    private _get(index: number): T {
        if (index >= this.length) range(`AS3 Vector index ${index} is outside length ${this.length}`);
        return stateOf(this).values[index]!;
    }

    private _callback(value: unknown, name: string, thisObject: unknown): Function {
        if (typeof value !== "function") throw new TypeError(`AS3 Vector.${name} requires a callback function`);
        if (isAS3MethodClosure(value) && thisObject !== null && thisObject !== undefined) {
            throw new TypeError(`AS3 Vector.${name} method closure requires a null thisObject`);
        }
        return value;
    }

    private _set(index: number, value: unknown): void {
        const state = stateOf(this);
        const currentLength = state.values.length;
        if (index > currentLength) range(`AS3 Vector index ${index} is outside length ${currentLength}`);
        if (index === currentLength) {
            this._assertResize(currentLength + 1);
            state.values.push(state.policy.coerce(value));
            return;
        }
        state.values[index] = state.policy.coerce(value);
    }

    private _assertResize(nextLength: number): void {
        lengthValue(nextLength);
        if (stateOf(this).fixed && nextLength !== this.length) {
            const error = new RangeError("AS3 fixed Vector length cannot change");
            Object.defineProperty(error, "errorID", {value:1126});
            throw error;
        }
    }

    private _relativeIndex(value: number): number {
        const integer = Number(value) >> 0;
        return integer < 0 ? Math.max(this.length + integer, 0) : Math.min(integer, this.length);
    }
}

Object.freeze(AS3Vector.prototype);
Object.freeze(AS3Vector);

/** Allocation identity for dynamic enumeration across authenticated Vector policies. */
export function isAS3Vector(value:unknown):value is AS3Vector<unknown> {
    return (typeof value === "object" || typeof value === "function") && value !== null && VECTOR_STATES.has(value);
}

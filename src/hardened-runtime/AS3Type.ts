export interface AS3TypeToken<T> {
    readonly name: string;
}

interface InternalToken<T> extends AS3TypeToken<T> {
    readonly test: (value: unknown) => value is T;
}

type RuntimeConstructor<T extends object = object> = abstract new (...args: any[]) => T;

const TOKENS = new WeakSet<object>();
const CLASS_TOKENS = new WeakMap<Function, AS3TypeToken<object>>();
const INTERFACE_IMPLEMENTATIONS = new WeakMap<Function, Set<object>>();

function token<T>(name: string, test: (value: unknown) => value is T): AS3TypeToken<T> {
    if (typeof name !== "string" || name.length === 0 || /[\u0000-\u001f\u007f]/.test(name)
        || typeof test !== "function") {
        throw new TypeError("AS3 runtime type requires a stable name and predicate");
    }
    const value = Object.freeze({ name, test });
    TOKENS.add(value);
    return value;
}

function internal<T>(value: AS3TypeToken<T>): InternalToken<T> {
    if (typeof value !== "object" || value === null || !TOKENS.has(value as object)) {
        throw new TypeError("AS3 runtime type token is not an authenticated token");
    }
    return value as InternalToken<T>;
}

function prototypeContains(value: unknown, constructor: Function): boolean {
    if ((typeof value !== "object" && typeof value !== "function") || value === null) return false;
    const expected = constructor.prototype;
    if ((typeof expected !== "object" && typeof expected !== "function") || expected === null) return false;
    let current = Object.getPrototypeOf(value);
    const seen = new Set<object>();
    while (current !== null) {
        if (current === expected) return true;
        if (seen.has(current)) throw new TypeError("cyclic runtime prototype chain");
        seen.add(current);
        current = Object.getPrototypeOf(current);
    }
    return false;
}

export const AS3Types = Object.freeze({
    int: token<number>("int", (value): value is number => typeof value === "number"
        && Number.isFinite(value) && Number.isInteger(value) && value >= -0x80000000 && value <= 0x7fffffff),
    uint: token<number>("uint", (value): value is number => typeof value === "number"
        && Number.isFinite(value) && Number.isInteger(value) && value >= 0 && value <= 0xffffffff),
    Number: token<number>("Number", (value): value is number => typeof value === "number"),
    Boolean: token<boolean>("Boolean", (value): value is boolean => typeof value === "boolean"),
    String: token<string>("String", (value): value is string => typeof value === "string"),
    Array: token<unknown[]>("Array", Array.isArray),
    Function: token<Function>("Function", (value): value is Function => typeof value === "function"),
    Class: token<Function>("Class", (value): value is Function => typeof value === "function"),
    Object: token<unknown>("Object", (value): value is unknown => value !== null && value !== undefined),
});

export function as3PredicateType<T>(name: string, predicate: (value: unknown) => value is T): AS3TypeToken<T> {
    return token(name, predicate);
}

export function as3ClassType<T extends object>(name: string, constructor: RuntimeConstructor<T>): AS3TypeToken<T> {
    if (typeof constructor !== "function") throw new TypeError("AS3 class type requires a constructor");
    const cached = CLASS_TOKENS.get(constructor);
    if (cached) {
        if (cached.name !== name) throw new TypeError("AS3 class constructor was registered with a different identity");
        return cached as AS3TypeToken<T>;
    }
    const created = token<T>(name, (value): value is T => prototypeContains(value, constructor));
    CLASS_TOKENS.set(constructor, created as AS3TypeToken<object>);
    return created;
}

export function as3InterfaceType<T extends object>(name: string): AS3TypeToken<T> {
    let created: AS3TypeToken<T>;
    created = token<T>(name, (value): value is T => {
        if ((typeof value !== "object" && typeof value !== "function") || value === null) return false;
        let current = Object.getPrototypeOf(value);
        const seen = new Set<object>();
        while (current !== null) {
            if (seen.has(current)) throw new TypeError("cyclic runtime prototype chain");
            seen.add(current);
            const descriptor = Object.getOwnPropertyDescriptor(current, "constructor");
            const constructor = descriptor && typeof descriptor.value === "function" ? descriptor.value : null;
            if (constructor && INTERFACE_IMPLEMENTATIONS.get(constructor)?.has(created as object)) return true;
            current = Object.getPrototypeOf(current);
        }
        return false;
    });
    return created;
}

export function as3RegisterInterfaces(constructor: RuntimeConstructor,
    interfaces: readonly AS3TypeToken<object>[]): void {
    if (typeof constructor !== "function" || !Array.isArray(interfaces)) {
        throw new TypeError("AS3 interface registration requires a constructor and token list");
    }
    const admitted = interfaces.map(item => internal(item) as object);
    let registered = INTERFACE_IMPLEMENTATIONS.get(constructor);
    if (!registered) {
        registered = new Set<object>();
        INTERFACE_IMPLEMENTATIONS.set(constructor, registered);
    }
    admitted.forEach(item => registered!.add(item));
}

export function as3Is<T>(value: unknown, type: AS3TypeToken<T>): value is T {
    return value !== null && value !== undefined && internal(type).test(value);
}

export function as3As<T>(value: unknown, type: AS3TypeToken<T>): T | null {
    if (value === null || value === undefined) return null;
    return internal(type).test(value) ? value : null;
}

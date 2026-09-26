import { copyFunctionLength } from "./internal/AS3FunctionLength";
import { preSuperMethodClosureOwner, resolvePreSuperMethodClosureReceiver } from "./internal/AS3TypeRegistry";

const METHOD_CLOSURES = new WeakMap<object, WeakMap<Function, Function>>();
const METHOD_CLOSURE_BRANDS = new WeakSet<Function>();
const DEFERRED_PRE_SUPER_CLOSURES = new WeakSet<Function>();

export function isAS3MethodClosure(value: unknown): value is Function {
    return typeof value === "function" && METHOD_CLOSURE_BRANDS.has(value);
}

/**
 * Flash method values are stable receiver-bound closures.  The cache is keyed
 * by the original virtual method value, and records closure -> closure as well,
 * so a derived constructor cannot rebind the closure captured by its base.
 */
export function as3BindMethod<TArguments extends unknown[], TResult>(receiver: object,
    method: (...args: TArguments) => TResult): (...args: TArguments) => TResult {
    if ((typeof receiver !== "object" && typeof receiver !== "function") || receiver === null
        || typeof method !== "function") {
        throw new TypeError("AS3 method closure binding requires a receiver and callable method");
    }
    const owner = preSuperMethodClosureOwner(receiver);
    let closures = METHOD_CLOSURES.get(owner);
    if (!closures) {
        closures = new WeakMap<Function, Function>();
        METHOD_CLOSURES.set(owner, closures);
    }
    const cached = closures.get(method);
    if (cached) return cached as (...args: TArguments) => TResult;
    const closure = ((...args: TArguments): TResult => {
        const target = resolvePreSuperMethodClosureReceiver(owner);
        if (DEFERRED_PRE_SUPER_CLOSURES.has(closure) && target === owner)
            throw new TypeError("Deferred pre-super listener invoked before base construction");
        return Reflect.apply(method,target,args);
    });
    copyFunctionLength(method,closure);
    METHOD_CLOSURE_BRANDS.add(closure);
    closures.set(method, closure);
    closures.set(closure, closure);
    return closure;
}

/** A registered listener may retain identity early, but cannot run before super. */
export function as3BindDeferredPreSuperMethod<TArguments extends unknown[], TResult>(receiver: object,
    method: (...args: TArguments) => TResult): (...args: TArguments) => TResult {
    const closure = as3BindMethod(receiver,method);
    DEFERRED_PRE_SUPER_CLOSURES.add(closure);
    return closure;
}

/** Static reads evaluate their authenticated class receiver once before caching the bound method. */
export function as3BindStaticMethod(receiver:Function, name:string):Function {
    if (typeof receiver !== "function") throw new TypeError("Static method closure requires its class receiver");
    return as3BindMethod(receiver, Reflect.get(receiver,name));
}

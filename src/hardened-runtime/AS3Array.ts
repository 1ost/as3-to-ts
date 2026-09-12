/*
 * Native Array index and bounded mutation boundaries.
 * This intentionally does not emulate dynamic Object or display-list properties.
 */

export const AS3_ARRAY_MAX_INDEX = 0xfffffffe;

export function as3ArrayIndex(value: number): number {
    if (!Number.isInteger(value) || value < 0 || value > AS3_ARRAY_MAX_INDEX) {
        throw new RangeError("AS3 Array index must be an integer from 0 through 4294967294");
    }
    return value;
}


export class AS3ArrayOperationUnavailable extends Error {
    constructor(message:string) { super(message); this.name = "AS3ArrayOperationUnavailable"; }
}

/** Native push/pop/shift/unshift retain values, identities and uint lengths. */
export function as3ArrayCall(value:unknown, method:"push" | "unshift", args:unknown[]):number;
export function as3ArrayCall(value:unknown, method:"pop" | "shift", args:unknown[]):unknown;
export function as3ArrayCall(value:unknown, method:string, args:unknown[]):unknown {
    if (value === null) {
        const error = new TypeError("Error #1009: Cannot access a property or method of a null object reference.");
        Object.defineProperty(error,"errorID",{value:1009}); throw error;
    }
    if (!Array.isArray(value) || !["push","pop","shift","unshift"].includes(method)
        || (["pop","shift"].includes(method) && args.length !== 0))
        throw new AS3ArrayOperationUnavailable("Array mutation requires a supported Array receiver, method and arity");
    const nativeMethod = Array.prototype[method as "push" | "pop" | "shift" | "unshift"];
    if (Reflect.get(value,method) !== nativeMethod)
        throw new AS3ArrayOperationUnavailable("Overridden Array mutation methods require native dispatch evidence");
    if ((method === "push" || method === "unshift") && value.length + args.length > 0xffffffff)
        throw new AS3ArrayOperationUnavailable("Array length overflow requires retained native behavior");
    return Reflect.apply(nativeMethod,value,args);
}

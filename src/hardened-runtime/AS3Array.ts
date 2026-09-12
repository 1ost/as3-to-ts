import { as3FunctionArgument } from "./AS3Function";

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
export function as3ArrayCall(value:unknown, method:"concat", args:unknown[]):unknown[];
export function as3ArrayCall(value:unknown, method:string, args:unknown[]):unknown {
    if (value === null) {
        const error = new TypeError("Error #1009: Cannot access a property or method of a null object reference.");
        Object.defineProperty(error,"errorID",{value:1009}); throw error;
    }
    if (!Array.isArray(value) || !["push","pop","shift","unshift","concat"].includes(method)
        || (["pop","shift"].includes(method) && args.length !== 0))
        throw new AS3ArrayOperationUnavailable("Array mutation requires a supported Array receiver, method and arity");
    const nativeMethod = Array.prototype[method as "push" | "pop" | "shift" | "unshift" | "concat"];
    if (Reflect.get(value,method) !== nativeMethod)
        throw new AS3ArrayOperationUnavailable("Overridden Array mutation methods require native dispatch evidence");
    if (method === "concat") return concatArrays(value,args);
    if ((method === "push" || method === "unshift") && value.length + args.length > 0xffffffff)
        throw new AS3ArrayOperationUnavailable("Array length overflow requires retained native behavior");
    return Reflect.apply(nativeMethod,value,args);
}

/** Flash spreads Arrays one level, preserves holes and never consults JS species. */
function concatArrays(value:unknown[], args:unknown[]):unknown[] {
    const indexName = (name:string):boolean => String(Number(name)) === name
        && Number.isInteger(Number(name)) && Number(name) >= 0 && Number(name) <= AS3_ARRAY_MAX_INDEX;
    if (Object.getOwnPropertyNames(Array.prototype).some(indexName))
        throw new AS3ArrayOperationUnavailable("Inherited Array indices require native concat evidence");
    const result:unknown[] = [];
    let length = 0;
    for (const item of [value,...args]) {
        if (!Array.isArray(item)) {
            if (length === 0xffffffff)
                throw new AS3ArrayOperationUnavailable("Array concat length overflow requires native evidence");
            result[length++] = item;
            continue;
        }
        if (Object.getPrototypeOf(item) !== Array.prototype || Object.getOwnPropertySymbols(item).length)
            throw new AS3ArrayOperationUnavailable("Array concat requires ordinary native Arrays");
        const nextLength = length + item.length;
        if (nextLength > 0xffffffff)
            throw new AS3ArrayOperationUnavailable("Array concat length overflow requires native evidence");
        for (const name of Object.getOwnPropertyNames(item)) {
            if (!indexName(name) || Number(name) >= item.length) continue;
            const descriptor = Object.getOwnPropertyDescriptor(item,name)!;
            if (!("value" in descriptor) || !descriptor.enumerable)
                throw new AS3ArrayOperationUnavailable("Array concat accessor/hidden slots require native evidence");
            result[length + Number(name)] = descriptor.value;
        }
        length = nextLength;
    }
    result.length = length;
    return result;
}


/** Native dense Array for-each retains the receiver and observes live length/index values. */
export function* as3ArrayValues(value:unknown, bindingType:string):Generator<any,void,unknown> {
    if (value === null || value === undefined) return;
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || Object.keys(Array.prototype).length !== 0)
        throw new AS3ArrayOperationUnavailable("Array enumeration requires an ordinary native Array");
    const validate = ():void => {
        const keys=Reflect.ownKeys(value);
        if (keys.length !== value.length + 1 || keys.some(key => typeof key !== "string"
            || key !== "length" && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)))
            throw new AS3ArrayOperationUnavailable("Sparse or named Array enumeration requires retained native evidence");
    };
    validate();
    for (let index=0;;index++) {
        if (index >= value.length) { validate(); return; }
        const descriptor=Object.getOwnPropertyDescriptor(value,String(index));
        if (!descriptor || !descriptor.enumerable || !("value" in descriptor))
            throw new AS3ArrayOperationUnavailable("Array enumeration of hidden or accessor slots requires native evidence");
        yield as3FunctionArgument(descriptor.value,bindingType);
    }
}

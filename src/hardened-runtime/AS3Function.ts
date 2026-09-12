import { as3Boolean, as3Int, as3Number, as3Object, as3String, as3TraceValue, as3Uint } from "./AS3Coerce";

export class AS3FunctionOperationUnavailable extends Error {
    constructor(message:string) { super(message); this.name="AS3FunctionOperationUnavailable"; }
}

/** Package functions retain native arity checks even when invoked through Function.apply. */
export function as3CheckFunctionArity(qname:string, actual:number, minimum:number, maximum:number | null):void {
    if (actual >= minimum && (maximum === null || actual <= maximum)) return;
    const dot=qname.lastIndexOf(".");
    const label=dot < 0 ? qname : qname.slice(0,dot)+"::"+qname.slice(dot+1);
    const error=new Error(`Error #1063: Argument count mismatch on global/${label}(). Expected ${minimum}, got ${actual}.`);
    error.name="ArgumentError"; Object.defineProperty(error,"errorID",{value:1063}); throw error;
}

/** Typed function slots normalize values at the invocation boundary, including dynamic callers. */
export function as3FunctionArgument(value:unknown, type:string):any {
    switch(type) {
        case "*": return value;
        case "Object": return as3Object(value);
        case "String": return value === null || value === undefined ? null : as3String(value);
        case "Number": return as3Number(value);
        case "int": return as3Int(value);
        case "uint": return as3Uint(value);
        case "Boolean": return as3Boolean(value);
        case "Array": if (value == null || Array.isArray(value)) return value == null ? null : value; break;
        case "Function": if (value == null || typeof value === "function") return value == null ? null : value; break;
    }
    throw new AS3FunctionOperationUnavailable(`Native function parameter conversion to ${type} requires further evidence`);
}

export function as3FunctionApply(target:unknown, receiver:unknown, argumentsArray:unknown):unknown {
    if (target === null || target === undefined) {
        const id=target === null ? 1009 : 1010;
        const error=new TypeError(`Error #${id}: ${id === 1009 ? "Cannot access a property or method of a null object reference." : "A term is undefined and has no properties."}`);
        Object.defineProperty(error,"errorID",{value:id}); throw error;
    }
    if (typeof target !== "function" || Reflect.get(target,"apply") !== Function.prototype.apply
        || argumentsArray != null && !Array.isArray(argumentsArray))
        throw new AS3FunctionOperationUnavailable("Function.apply needs a callable and a native Array or null argument list");
    return Reflect.apply(target,receiver,argumentsArray == null ? [] : argumentsArray);
}

const TRACE_FUNCTIONS=new WeakMap<Function,Function>();
/** A global trace value has stable identity and converts through the native trace bridge. */
export function as3TraceFunction(target:(...args:unknown[])=>void):Function {
    let value=TRACE_FUNCTIONS.get(target);
    if (!value) { value=function(...args:unknown[]):void { target(...args.map(as3TraceValue)); }; TRACE_FUNCTIONS.set(target,value); }
    return value;
}

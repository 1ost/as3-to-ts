import { defineFunctionLength } from "./internal/AS3FunctionLength";
export { defineFunctionLength as as3DefineFunctionLength, as3DefineMethodLength, as3FunctionLength } from "./internal/AS3FunctionLength";
import { as3ArraySlot } from "./AS3Array";
import { as3Boolean, as3Int, as3Number, as3Object, as3String, as3TraceValue, as3Uint } from "./AS3Coerce";

export class AS3FunctionOperationUnavailable extends Error {
    constructor(message:string) { super(message); this.name="AS3FunctionOperationUnavailable"; }
}

const SOURCE_LAMBDAS = new WeakSet<Function>();
/** Preserve identity while marking functions emitted from authenticated AS3 bodies. */
export function as3SourceLambda<T extends Function>(value:T, sourceLength?:number):T {
    if (sourceLength !== undefined) defineFunctionLength(value,sourceLength);
    SOURCE_LAMBDAS.add(value);
    return value;
}
export function isAS3SourceLambda(value:Function):boolean { return SOURCE_LAMBDAS.has(value); }

/** Package functions retain native arity checks even when invoked through Function.apply. */
export function as3CheckFunctionArity(qname:string, actual:number, minimum:number, maximum:number | null):void {
    if (actual >= minimum && (maximum === null || actual <= maximum)) return;
    const dot=qname.lastIndexOf(".");
    const label=dot < 0 ? qname : qname.slice(0,dot)+"::"+qname.slice(dot+1);
    const error=new Error(`Error #1063: Argument count mismatch on global/${label}(). Expected ${minimum}, got ${actual}.`);
    error.name="ArgumentError"; Object.defineProperty(error,"errorID",{value:1063}); throw error;
}

/** Reject missing required instance-method arguments before slot conversion or body effects. */
export function as3CheckMethodMinimumArity(classQName:string, method:string, actual:number, minimum:number):void {
    as3CheckMethodArity(classQName,method,actual,minimum,null);
}

/** Native instance methods enforce both bounds unless their signature has a rest slot. */
export function as3CheckMethodArity(classQName:string, method:string, actual:number, minimum:number, maximum:number|null):void {
    if (actual >= minimum && (maximum === null || actual <= maximum)) return;
    const dot=classQName.lastIndexOf(".");
    const label=dot < 0 ? classQName : classQName.slice(0,dot)+"::"+classQName.slice(dot+1);
    const error=new Error(`Error #1063: Argument count mismatch on ${label}/${method}(). Expected ${minimum}, got ${actual}.`);
    error.name="ArgumentError";Object.defineProperty(error,"errorID",{value:1063});throw error;
}

/** Function slots preserve callable identity; rejected values never invoke conversion hooks. */
export function as3FunctionSlot(value:unknown):Function | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "function") return value;
    if (typeof value === "bigint" || typeof value === "symbol")
        throw new AS3FunctionOperationUnavailable("Host-only value has no native Function slot conversion");
    // Native reference addresses vary between processes, as with Array slot errors.
    const label=typeof value === "string" ? `"${value.replace(/\0/g,"")}"`
        : typeof value === "object" ? "value" : as3String(value);
    const error=new TypeError(`Error #1034: Type Coercion failed: cannot convert ${label} to Function.`);
    Object.defineProperty(error,"errorID",{value:1034});throw error;
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
        case "Array": return as3ArraySlot(value);
        case "Function": return as3FunctionSlot(value);
    }
    throw new AS3FunctionOperationUnavailable(`Native function parameter conversion to ${type} requires further evidence`);
}

/** Unsupported anonymous-function arity diagnostics fail before coercion/body effects. */
export function as3CheckLambdaArity(actual:number,minimum:number,maximum:number | null):void {
    if (actual < minimum || maximum !== null && actual > maximum)
        throw new AS3FunctionOperationUnavailable("Anonymous Function arity requires authenticated native source labels");
}

/** Direct Function invocation differs from reading/calling its call/apply property. */
export function as3FunctionInvoke(target:unknown,args:unknown[]):unknown {
    return invokeDirectFunction(target,null,args);
}

/** callproperty resolves a sealed field after argument evaluation and retains its receiver. */
export function as3FunctionFieldInvoke(receiver:unknown,field:string,args:unknown[]):unknown {
    if (receiver === null || typeof receiver !== "object")
        throw new AS3FunctionOperationUnavailable("Function field invocation requires an original instance");
    const slot=Object.getOwnPropertyDescriptor(receiver,field);
    if (!slot || !("value" in slot))
        throw new AS3FunctionOperationUnavailable("Function field invocation requires an own data slot");
    return invokeDirectFunction(slot.value,receiver,args);
}

function invokeDirectFunction(target:unknown,receiver:unknown,args:unknown[]):unknown {
    if (typeof target !== "function") {
        const error=new TypeError("Error #1006: value is not a function.");
        Object.defineProperty(error,"errorID",{value:1006});throw error;
    }
    return Reflect.apply(target,receiver,args);
}

export function as3FunctionApply(target:unknown, receiver:unknown, argumentsArray:unknown):unknown {
    return invokeFunction(target,receiver,argumentsArray,"apply");
}

/** Function.call retains bound method identity and shares the invocation boundary with apply. */
export function as3FunctionCall(target:unknown, receiver:unknown, args:unknown[]):unknown {
    return invokeFunction(target,receiver,args,"call");
}

function invokeFunction(target:unknown, receiver:unknown, argumentsArray:unknown, method:"call"|"apply"):unknown {
    if (target === null || target === undefined) {
        const id=target === null ? 1009 : 1010;
        const error=new TypeError(`Error #${id}: ${id === 1009 ? "Cannot access a property or method of a null object reference." : "A term is undefined and has no properties."}`);
        Object.defineProperty(error,"errorID",{value:id}); throw error;
    }
    if (typeof target !== "function" || Reflect.get(target,method) !== Function.prototype[method]
        || argumentsArray != null && !Array.isArray(argumentsArray))
        throw new AS3FunctionOperationUnavailable(`Function.${method} needs a callable and a native Array or null argument list`);
    return Reflect.apply(target,receiver,argumentsArray == null ? [] : argumentsArray as unknown[]);
}

const TRACE_FUNCTIONS=new WeakMap<Function,Function>();
/** A global trace value has stable identity and converts through the native trace bridge. */
export function as3TraceFunction(target:(...args:unknown[])=>void):Function {
    let value=TRACE_FUNCTIONS.get(target);
    if (!value) { value=function(...args:unknown[]):void { target(...args.map(as3TraceValue)); }; TRACE_FUNCTIONS.set(target,value); }
    return value;
}

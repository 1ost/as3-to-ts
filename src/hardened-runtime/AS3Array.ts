import { lookupObjectClass } from "./internal/AS3TypeRegistry";
import { as3ArraySortOnNumeric, as3ArraySortNumeric } from "./internal/AS3ArraySort";
import { as3NativeArrayJoin, as3NativeString, as3NativeNumber } from "./AS3ObjectDispatch";
import { as3FunctionArgument, as3FunctionSlot } from "./AS3Function";

import { isAS3MethodClosure } from "./AS3MethodClosure";

/*
 * Native Array index and bounded mutation boundaries.
 * This intentionally does not emulate dynamic Object or display-list properties.
 */

export const AS3_ARRAY_MAX_INDEX = 0xfffffffe;

/** Typed native Array slots are identity checks; conversion hooks never run. */
export function as3ArraySlot(value:unknown):unknown[] | null {
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) {
        if (!authenticatedArray(value))
            throw new AS3ArrayOperationUnavailable("Array slot requires native or authenticated subclass identity");
        return value;
    }
    // Native object addresses differ across processes; do not invent one or
    // invoke user valueOf/toString while reporting a rejected reference slot.
    const label=typeof value === "string" ? `"${value.replace(/\0/g,"")}"`
        : typeof value === "object" || typeof value === "function" ? "value" : as3NativeString(value);
    const error=new TypeError(`Error #1034: Type Coercion failed: cannot convert ${label} to Array.`);
    Object.defineProperty(error,"errorID",{value:1034});throw error;
}

/** Validate the single numeric length before invoking native Array allocation. */
export function as3ArrayConstructorArguments(args:unknown[]):unknown[] {
    const value=args[0];
    if (args.length === 1 && typeof value === "number"
        && (!Number.isInteger(value) || value < 0 || value > 0xffffffff)) {
        const error=new RangeError(`Error #1005: Array index is not a positive integer (${as3NativeString(value)}).`);
        Object.defineProperty(error,"errorID",{value:1005});
        throw error;
    }
    return args;
}

export const AS3ArrayBase = Array;
export const isAS3Array = (value:unknown):value is unknown[] => Array.isArray(value);

function authenticatedArray(value:unknown[]):boolean {
    if (Object.getPrototypeOf(value) === Array.prototype) return true;
    let info:ReturnType<typeof lookupObjectClass>;
    try { info=lookupObjectClass(value); } catch { return false; }
    return !!info && info.qname !== "Array" && info.chain.some(owner=>owner.qname === "Array")
        && Object.getPrototypeOf(value) === info.constructor.prototype;
}


export function as3ArrayIndex(value: number): number {
    if (!Number.isInteger(value) || value < 0 || value > AS3_ARRAY_MAX_INDEX) {
        throw new RangeError("AS3 Array index must be an integer from 0 through 4294967294");
    }
    return value;
}


export class AS3ArrayOperationUnavailable extends Error {
    constructor(message:string) { super(message); this.name = "AS3ArrayOperationUnavailable"; }
}

/** Storage history is observable through native splice hole ownership. */
interface ArrayStorage { start:number; end:number; used:number; capacity:number; sparse:boolean; }
const ARRAY_STORAGE = new WeakMap<unknown[],ArrayStorage | null>();
const indexProperty = (name:string):boolean => /^(0|[1-9][0-9]*)$/.test(name) && Number(name) <= AS3_ARRAY_MAX_INDEX;
const sparseStorage = (length:number,used:number):boolean => length > 0x7fffffff || length > 32 && length > (used+1)*4;
function growStorage(state:ArrayStorage,length:number):void {
    if (length > state.capacity) state.capacity=length+Math.floor(length/4);
}
/** Generated literals are fresh native dense arrays, not host species allocations. */
export function as3ArrayLiteral<T>(value:T[]):T[] {
    ARRAY_STORAGE.set(value,{start:0,end:value.length,used:value.length,capacity:Math.max(4,value.length),sparse:false});
    return value;
}
export function as3NewArray(args:unknown[]):unknown[] {
    as3ArrayConstructorArguments(args);
    const value=Reflect.construct(Array,args) as unknown[];
    if (args.length === 1 && typeof args[0] === "number")
        ARRAY_STORAGE.set(value,{start:0,end:0,used:0,capacity:4,sparse:false});
    else as3ArrayLiteral(value);
    return value;
}
function storage(value:unknown[]):ArrayStorage | null {
    if (ARRAY_STORAGE.has(value)) return ARRAY_STORAGE.get(value)!;
    const names=Object.getOwnPropertyNames(value).filter(indexProperty);
    // Untracked sparse host arrays carry no recoverable native allocation history.
    if (names.length !== value.length) { ARRAY_STORAGE.set(value,null); return null; }
    as3ArrayLiteral(value); return ARRAY_STORAGE.get(value)!;
}
function storageWrite(state:ArrayStorage,index:number,present:boolean):void {
    if (state.sparse) return;
    if (!present) ++state.used;
    if (index >= 0x80000000) {state.sparse=true;return;}
    if (state.end === state.start) {state.start=index;state.end=index+1;growStorage(state,1);return;}
    if (index < state.start) {
        const length=state.end-index;
        if (sparseStorage(length,state.used)) {state.sparse=true;return;}
        growStorage(state,length);
        state.start-=Math.min(state.start,state.capacity-(state.end-state.start));
    } else if (index >= state.end) {
        if (sparseStorage(index+1-state.start,state.used)) {state.sparse=true;return;}
        state.end=index+1;growStorage(state,state.end-state.start);
    }
}
function storageLength(value:unknown[],state:ArrayStorage,oldLength:number,newLength:number):void {
    if (state.sparse) return;
    if (newLength < oldLength) {
        if (newLength <= state.start) {state.start=state.end=state.used=0;return;}
        state.end=Math.min(state.end,newLength);
        state.used=Object.getOwnPropertyNames(value).filter(indexProperty).length;
    } else if (newLength > oldLength && !(state.end === state.start && oldLength === 0)) {
        if (sparseStorage(newLength-state.start,state.used)) {state.sparse=true;return;}
        state.end=newLength;growStorage(state,state.end-state.start);
    }
}
function deleteArrayIndex(value:unknown[],state:ArrayStorage,index:number):void {
    if (Object.prototype.hasOwnProperty.call(value,index) && !state.sparse) {
        --state.used;
        if (state.used === 0) state.start=state.end=0;
        else if (sparseStorage(state.end-state.start,state.used)) state.sparse=true;
    }
    Reflect.deleteProperty(value,String(index));
}
/** Dynamic numeric deletion retains the allocation history used by splice. */
export function as3ArrayDelete(value:unknown,name:string):boolean {
    const array=ordinaryArray(value);
    if (Object.getPrototypeOf(array)!==Array.prototype || !indexProperty(name))
        throw new AS3ArrayOperationUnavailable("Array deletion requires an ordinary numeric index");
    const descriptor=Object.getOwnPropertyDescriptor(array,name);
    if (Object.prototype.hasOwnProperty.call(Array.prototype,name)
        || Object.prototype.hasOwnProperty.call(Object.prototype,name)
        || descriptor && (!("value" in descriptor) || !descriptor.enumerable || !descriptor.configurable))
        throw new AS3ArrayOperationUnavailable("Array deletion requires ordinary configurable indices");
    const state=storage(array);
    if(state) deleteArrayIndex(array,state,Number(name));
    else Reflect.deleteProperty(array,name);
    return true;
}
function spliceArray(value:unknown[],args:unknown[]):unknown[] | null {
    if (Object.getPrototypeOf(value) !== Array.prototype)
        throw new AS3ArrayOperationUnavailable("Array subclass splice requires retained native dispatch evidence");
    if (!args.length) return null;
    if (args.slice(0,2).some(item=>item !== null && (typeof item === "object" || typeof item === "function")))
        throw new AS3ArrayOperationUnavailable("Reentrant Array splice coercion requires native evidence");
    const length=value.length;
    const rawStart=as3NativeNumber(args[0]);
    const integer=Number.isNaN(rawStart) ? 0 : Math.trunc(rawStart);
    const start=integer < 0 ? Math.max(length+integer,0) : Math.min(integer,length);
    const rawCount=args.length < 2 ? length-start : as3NativeNumber(args[1]);
    const count=Math.min(rawCount < 0 ? 0 : rawCount >>> 0,length-start);
    const added=Math.max(0,args.length-2),delta=added-count,newLength=length+delta;
    if (newLength > 0xffffffff)
        throw new AS3ArrayOperationUnavailable("Array splice length overflow requires native evidence");
    const state=storage(value);
    if (!state) throw new AS3ArrayOperationUnavailable("Array splice requires retained native storage history");
    if (!Object.isExtensible(value) || !Object.getOwnPropertyDescriptor(value,"length")?.writable
        || Object.getOwnPropertySymbols(value).length
        || [Array.prototype,Object.prototype].some(proto=>Object.getOwnPropertyNames(proto).some(indexProperty)))
        throw new AS3ArrayOperationUnavailable("Array splice requires ordinary writable storage without inherited indices");
    for (const key of Object.getOwnPropertyNames(value).filter(indexProperty)) {
        const slot=Object.getOwnPropertyDescriptor(value,key)!;
        if (!("value" in slot) || !slot.writable || !slot.enumerable || !slot.configurable)
            throw new AS3ArrayOperationUnavailable("Array splice accessor and fixed slots require native evidence");
    }
    const fast=!state.sparse && start >= state.start && start+count <= state.end;
    const removed:unknown[]=new Array(count);
    if (fast) {
        const priorEnd=state.end;
        for(let i=0;i<count;i++) if(Object.prototype.hasOwnProperty.call(value,start+i)) removed[i]=value[start+i];
        const copy=(from:number,to:number):void=>{
            if(Object.prototype.hasOwnProperty.call(value,from)) value[to]=value[from];
            else Reflect.deleteProperty(value,String(to));
        };
        if(delta < 0) for(let i=start+count;i<priorEnd;i++) copy(i,i+delta);
        else if(delta > 0) for(let i=priorEnd-1;i>=start+count;i--) copy(i,i+delta);
        for(let i=0;i<added;i++) value[start+i]=args[i+2];
        if(delta < 0) for(let i=priorEnd+delta;i<priorEnd;i++) Reflect.deleteProperty(value,String(i));
        value.length=newLength;
        state.end+=delta;
        if(state.end === state.start) state.start=state.end=0;
        state.used=Object.getOwnPropertyNames(value).filter(indexProperty).length;
        growStorage(state,state.end-state.start);
        const removedUsed=Object.getOwnPropertyNames(removed).filter(indexProperty).length;
        ARRAY_STORAGE.set(removed,{start:0,end:count,used:removedUsed,capacity:count>4 ? count+Math.floor(count/4) : 4,sparse:false});
    } else {
        for(let i=0;i<count;i++) removed[i]=value[start+i];
        as3ArrayLiteral(removed);
        if(delta < 0) {
            for(let i=start+count;i<length;i++) as3ArrayWrite(value,i+delta,value[i]);
            for(let i=newLength;i<length;i++) deleteArrayIndex(value,state,i);
        } else for(let i=length-1;i>=start+count;i--) as3ArrayWrite(value,i+delta,value[i]);
        for(let i=0;i<added;i++) as3ArrayWrite(value,start+i,args[i+2]);
        as3ArrayLengthWrite(value,newLength);
    }
    return removed;
}

/** Numeric keys retain Flash's Number-to-name conversion without uint wrapping. */
function numericKey(index:number):string {
    if (typeof index !== "number")
        throw new AS3ArrayOperationUnavailable("Array keys require a proven native numeric value");
    return as3NativeString(index);
}
function ordinaryArray(value:unknown):unknown[] {
    if (value === null || value === undefined) {
        const id=value === null ? 1009 : 1010;
        const error=new TypeError(`Error #${id}: ${id === 1009 ? "Cannot access a property or method of a null object reference." : "A term is undefined and has no properties."}`);
        Object.defineProperty(error,"errorID",{value:id});throw error;
    }
    if (!Array.isArray(value) || !authenticatedArray(value))
        throw new AS3ArrayOperationUnavailable("Array indexing requires an ordinary or authenticated subclass Array");
    return value;
}
/** Holes read as undefined; named numeric properties never change array length. */
export function as3ArrayRead(value:unknown, index:unknown):unknown {
    // Property names use the existing native String conversion, once. Do not
    // collapse "01", negative values, null or named properties through Number.
    const array=ordinaryArray(value);
    if (typeof index === "symbol" || typeof index === "bigint")
        throw new AS3ArrayOperationUnavailable("Host-only values are not ActionScript Array keys");
    const key=as3NativeString(index);
    if (key === "length") return array.length;
    const own=Object.getOwnPropertyDescriptor(array,key);
    if (Object.prototype.hasOwnProperty.call(Array.prototype,key)
        || Object.prototype.hasOwnProperty.call(Object.prototype,key) || own && !("value" in own))
        throw new AS3ArrayOperationUnavailable("Array inherited and accessor indices require native evidence");
    return own?.value;
}

/** Native Array.length retains the assignment input and stores a coerced uint. */
export function as3ArrayLengthWrite<T>(value:unknown,input:T):T {
    const array=ordinaryArray(value);
    const length=as3NativeNumber(input) >>> 0;
    if (!Object.getOwnPropertyDescriptor(array,"length")?.writable)
        throw new AS3ArrayOperationUnavailable("Array length requires ordinary writable storage");
    const oldLength=array.length,state=storage(array);
    if (!Reflect.set(array,"length",length))
        throw new AS3ArrayOperationUnavailable("Array host storage rejected the length write");
    if (state) storageLength(array,state,oldLength,length);
    return input;
}

/** Numeric-index writes preserve sparse length and the uncoerced assigned value. */
export function as3ArrayWrite<T>(value: unknown, index: number, item: T): T {
    const array=ordinaryArray(value), key=numericKey(index);
    const own=Object.getOwnPropertyDescriptor(array,key);
    if (Object.prototype.hasOwnProperty.call(Array.prototype,key)
        || Object.prototype.hasOwnProperty.call(Object.prototype,key)
        || own && (!("value" in own) || !own.writable) || !Object.getOwnPropertyDescriptor(array,"length")?.writable)
        throw new AS3ArrayOperationUnavailable("Array accessor and fixed-slot writes require native evidence");
    const state=indexProperty(key) ? storage(array) : null;
    if (!Reflect.set(array,key,item))
        throw new AS3ArrayOperationUnavailable("Array host storage rejected the numeric write");
    if (state) storageWrite(state,index,!!own);
    return item;
}

/** Numeric typed-Array updates retain the prior value for postfix results. */
export function as3ArrayUpdate(value:unknown,index:number,increment:0 | 1,prefix:boolean):number {
    if (typeof index !== "number" || increment !== 0 && increment !== 1 || typeof prefix !== "boolean")
        throw new AS3ArrayOperationUnavailable("Array updates require an authenticated numeric key and operation");
    const prior=as3NativeNumber(as3ArrayRead(value,index));
    const next=increment ? prior+1 : prior-1;
    as3ArrayWrite(value,index,next);
    return prefix ? next : prior;
}

/** Native push/pop/shift/unshift retain values, identities and uint lengths. */
export function as3ArrayCall(value:unknown, method:"push" | "unshift", args:unknown[]):number;
export function as3ArrayCall(value:unknown, method:"pop" | "shift", args:unknown[]):unknown;
export function as3ArrayCall(value:unknown, method:"concat" | "filter", args:unknown[]):unknown[];
export function as3ArrayCall(value:unknown, method:"join", args:unknown[]):string;
export function as3ArrayCall(value:unknown, method:"indexOf", args:unknown[]):number;
export function as3ArrayCall(value:unknown, method:"sortOn" | "sort", args:unknown[]):unknown[];
export function as3ArrayCall(value:unknown, method:"splice", args:unknown[]):unknown[] | null;
export function as3ArrayCall(value:unknown, method:"hasOwnProperty", args:unknown[]):boolean;
export function as3ArrayCall(value:unknown, method:string, args:unknown[]):unknown {
    if (method === "filter") {
        const array=ordinaryArray(value);
        if (args.length < 1 || args.length > 2 || Object.getPrototypeOf(array) !== Array.prototype
            || Object.prototype.hasOwnProperty.call(array,"filter"))
            throw new AS3ArrayOperationUnavailable("Array.filter requires an ordinary native method and one or two arguments");
        const callback=as3FunctionSlot(args[0]);
        const receiver=args.length === 2 ? args[1] : null;
        if (isAS3MethodClosure(callback) && receiver != null) {
            const error=new TypeError("Error #1510: When the callback argument is a method of a class, the optional this argument must be null.");
            Object.defineProperty(error,"errorID",{value:1510});throw error;
        }
        const result:unknown[]=[];
        if (callback === null) return result;
        const length=array.length;
        // AIR visits every original position, even deleted or now out-of-range
        // slots, and retains only literal true rather than truthy results.
        for (let index=0; index < length; index++) {
            const item=as3ArrayRead(array,index);
            if (Reflect.apply(callback,receiver,[item,index,array]) === true) result.push(item);
        }
        return result;
    }
    if (method === "indexOf") {
        const array=ordinaryArray(value);
        if (args.length < 1 || args.length > 2 || Object.getPrototypeOf(array) !== Array.prototype
            || Object.prototype.hasOwnProperty.call(array,"indexOf"))
            throw new AS3ArrayOperationUnavailable("Array.indexOf requires an ordinary native method and one or two arguments");
        // AIR coerces fromIndex to int before observing length, even for empty arrays.
        // Search values are never coerced, and an absent index reads as undefined.
        const from=args.length === 2 ? as3NativeNumber(args[1]) >> 0 : 0;
        const length=array.length;
        for (let index=from < 0 ? Math.max(length+from,0) : from; index < length; index++) {
            if (as3ArrayRead(array,index) === args[0]) return index | 0;
        }
        return -1;
    }
    if (method === "hasOwnProperty") {
        const array=ordinaryArray(value);
        if (args.length !== 1 || typeof args[0] !== "string"
            || Reflect.get(array,"hasOwnProperty") !== Object.prototype.hasOwnProperty)
            throw new AS3ArrayOperationUnavailable("Array ownership requires one String key and an unmodified native method");
        return Object.prototype.hasOwnProperty.call(array,args[0]);
    }
    if (method === "splice") {
        const array=ordinaryArray(value);
        if (Reflect.get(array,"splice") !== Array.prototype.splice)
            throw new AS3ArrayOperationUnavailable("Overridden Array splice requires native dispatch evidence");
        return spliceArray(array,args);
    }
    if (method === "sort") {
        const array=ordinaryArray(value);
        if (args.length !== 1) throw new AS3ArrayOperationUnavailable("Array.sort requires numeric options");
        const sorted=as3ArraySortNumeric(array,args[0]);
        ARRAY_STORAGE.set(array,null);return sorted;
    }
    if (method === "sortOn") {
        const array=ordinaryArray(value);
        if (args.length !== 2) throw new AS3ArrayOperationUnavailable("Array.sortOn requires field and numeric options");
        const sorted=as3ArraySortOnNumeric(array,args[0],args[1]);
        ARRAY_STORAGE.set(array,null);return sorted;
    }
    if (value === null) {
        const error = new TypeError("Error #1009: Cannot access a property or method of a null object reference.");
        Object.defineProperty(error,"errorID",{value:1009}); throw error;
    }
    if (!Array.isArray(value) || !authenticatedArray(value) || !["push","pop","shift","unshift","concat","join"].includes(method)
        || (["pop","shift"].includes(method) && args.length !== 0))
        throw new AS3ArrayOperationUnavailable("Array mutation requires a supported Array receiver, method and arity");
    const nativeMethod = Array.prototype[method as "push" | "pop" | "shift" | "unshift" | "concat" | "join"];
    if (Reflect.get(value,method) !== nativeMethod)
        throw new AS3ArrayOperationUnavailable("Overridden Array mutation methods require native dispatch evidence");
    if (method === "concat") return concatArrays(value,args);
    if (method === "join") {
        if (args.length > 1) throw new AS3ArrayOperationUnavailable("Array.join accepts at most one separator");
        return as3NativeArrayJoin(value,args[0]);
    }
    if ((method === "push" || method === "unshift") && value.length + args.length > 0xffffffff)
        throw new AS3ArrayOperationUnavailable("Array length overflow requires retained native behavior");
    const priorLength=value.length,state=storage(value);
    const result=Reflect.apply(nativeMethod,value,args);
    if (state && method === "push" && args.length) {
        if (!state.sparse) {
            state.used+=args.length;
            if(sparseStorage(value.length-state.start,state.used)) state.sparse=true;
            else {state.end=value.length;growStorage(state,state.end-state.start);}
        }
    } else if (state && (args.length || priorLength) && method !== "push") {
        // Existing operations keep their established semantics; splice must not
        // reconstruct allocation history after an unqualified storage transition.
        ARRAY_STORAGE.set(value,null);
    }
    return result;
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
        if (!authenticatedArray(item) || Object.getOwnPropertySymbols(item).length)
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
    if (!Array.isArray(value) || !authenticatedArray(value) || Object.keys(Array.prototype).length !== 0)
        throw new AS3ArrayOperationUnavailable("Array enumeration requires an ordinary native Array");
    // Declared AS3 traits are not dynamic enumeration entries even though the
    // generated storage uses JS own properties.
    const declared = Object.getPrototypeOf(value) === Array.prototype ? new Set<string>()
        : new Set(lookupObjectClass(value)!.chain.flatMap(owner=>owner.traits?.members.map(member=>member.name) || []));
    const validate = ():void => {
        const keys=Reflect.ownKeys(value).filter(key=>typeof key !== "string" || !declared.has(key));
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

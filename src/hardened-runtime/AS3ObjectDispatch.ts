import { lookupObjectClass, lookupObjectCaller, AS3ObjectTraits } from "./internal/AS3TypeRegistry";
import { as3BindMethod } from "./AS3MethodClosure";

type Member = AS3ObjectTraits["members"][number];
type ClassInfo = NonNullable<ReturnType<typeof lookupObjectClass>>;
const NATIVE_FUNCTION_LABELS = new WeakMap<Function,string>();

export class AS3ObjectDispatchUnavailable extends Error {
    constructor(message:string) { super(message); this.name = "AS3ObjectDispatchUnavailable"; }
}
function unavailable(message:string):never { throw new AS3ObjectDispatchUnavailable(message); }
function referenceError(id:number, key:string, owner:string):never {
    const descriptions:Record<number,string> = {
        1069:`Property ${key} not found on ${owner} and there is no default value.`,
        1056:`Cannot create property ${key} on ${owner}.`,
        1074:`Illegal write to read-only property ${key} on ${owner}.`,
        1037:`Cannot assign to a method ${key} on ${owner}.`,
    };
    const error = new ReferenceError(`Error #${id}: ${descriptions[id]}`);
    Object.defineProperty(error,"errorID",{value:id, enumerable:false});
    throw error;
}
function receiver(value:unknown):object {
    if (value === null || value === undefined) {
        const id = value === null ? 1009 : 1010;
        const error = new TypeError(`Error #${id}: ${id === 1009 ? "Cannot access a property or method of a null object reference." : "A term is undefined and has no properties."}`);
        Object.defineProperty(error,"errorID",{value:id}); throw error;
    }
    if (typeof value !== "object") return unavailable("Primitive and Class Object receivers require native dispatch support");
    return value;
}
function keyName(value:unknown):string {
    if (value !== null && typeof value === "object" || typeof value === "function")
        return unavailable("Object-valued keys require native public-namespace ToPrimitive");
    return String(value);
}
function describe(value:object):ClassInfo | null {
    const info = lookupObjectClass(value);
    if (info) {
        if (info.chain.some(owner => owner.traits === null)) return unavailable("Mapped class traits are unresolved");
        return info;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
        return unavailable("Unregistered Object receiver identity");
    return null;
}
function packageName(qname:string):string { return qname.slice(0,Math.max(0,qname.lastIndexOf("."))); }
function findTrait(info:ClassInfo, key:string, caller:string | null, publicOnly:boolean):Member[] {
    const context = caller === null ? [] : lookupObjectCaller(caller);
    const matches:Member[] = [];
    const storage = new Set<string>();
    for (const owner of info.chain) {
        for (const member of owner.traits!.members.filter(member => member.name === key)) {
            if (member.namespaceName !== null) return unavailable("Named namespace URIs require authenticated resolution");
            const namespace = member.visibility === "private" ? `private:${owner.qname}`
                : member.visibility === "internal" ? `internal:${packageName(owner.qname)}` : member.visibility;
            storage.add(namespace);
            const visible = member.visibility === "public" || !publicOnly && caller !== null && (
                member.visibility === "private" && caller === owner.qname
                || member.visibility === "internal" && packageName(caller) === packageName(owner.qname));
            if (!publicOnly && member.visibility === "protected" && context.includes(owner.qname))
                return unavailable("Protected dynamic lookup requires retained inheritance evidence");
            if (visible) matches.push(member);
        }
    }
    // Current generated storage uses source spellings. Distinct namespaces may
    // share a spelling but must never silently share the same JS slot.
    if (storage.size > 1) return unavailable("Distinct namespace slots share a generated storage name");
    return matches;
}
function labelFunction(fn:Function,label:string):Function { NATIVE_FUNCTION_LABELS.set(fn,label); return fn; }
export function as3ObjectFunctionLabel(value:unknown):string | null {
    return typeof value === "function" ? NATIVE_FUNCTION_LABELS.get(value) ?? null : null;
}
const BUILTINS = new Map<string,Function>();
BUILTINS.set("toString", labelFunction(function(this:unknown):string {
    const target = receiver(this), info = describe(target);
    return `[object ${info ? info.qname.split(".").pop() : "Object"}]`;
},"function Function() {}"));
BUILTINS.set("hasOwnProperty", labelFunction(function(this:unknown,key:unknown):boolean {
    return as3ObjectHasOwn(this,key === undefined ? null : key);
},"function Function() {}"));
BUILTINS.set("valueOf", labelFunction(function(this:unknown):unknown { return receiver(this); },"function Function() {}"));

BUILTINS.set("toLocaleString",labelFunction(function(this:unknown):unknown {
    // Native Object's locale form keeps its builtin class tag even when a
    // dynamic public toString property is replaced.
    return Reflect.apply(BUILTINS.get("toString")!,this,[]);
},"function Function() {}"));
BUILTINS.set("propertyIsEnumerable",labelFunction(function(this:unknown,key:unknown):boolean {
    const target=receiver(this), name=keyName(key === undefined ? null : key), info=describe(target);
    if (info && !info.chain[0]!.traits!.dynamic) return false;
    return Object.getOwnPropertyDescriptor(target,name)?.enumerable === true;
},"function Function() {}"));
BUILTINS.set("setPropertyIsEnumerable",labelFunction(function(this:unknown,key:unknown,flag?:unknown):void {
    const target=receiver(this), name=keyName(key === undefined ? null : key), info=describe(target);
    if (info && !info.chain[0]!.traits!.dynamic) referenceError(1056,name,info.qname);
    const descriptor=Object.getOwnPropertyDescriptor(target,name);
    if (descriptor) Object.defineProperty(target,name,{...descriptor,enumerable:arguments.length < 2 ? true : Boolean(flag)});
},"function Function() {}"));
BUILTINS.set("isPrototypeOf",labelFunction(function(this:unknown,other:unknown):boolean {
    const target=receiver(this); describe(target);
    return Reflect.apply(Object.prototype.isPrototypeOf,target,[other]);
},"function Function() {}"));

export function as3ObjectRead(value:unknown, key:unknown, caller:string | null = null):unknown {
    const target = receiver(value), name = keyName(key), info = describe(target);
    if (caller !== null) lookupObjectCaller(caller);
    if (info) {
        const members = findTrait(info,name,caller,false);
        const readable = members.find(member => member.kind !== "setter");
        if (readable) {
            const result = Reflect.get(target,name);
            if (readable.kind === "method") {
                if (typeof result !== "function") return unavailable("Authenticated method storage is not callable");
                const closure = as3BindMethod(target,result as (...args:unknown[])=>unknown);
                return labelFunction(closure,"function Function() {}");
            }
            return result;
        }
        if (members.length) return unavailable("Write-only dynamic getter behavior is not retained");
    } else if (Object.prototype.hasOwnProperty.call(target,name)) return Reflect.get(target,name);
    if (BUILTINS.has(name)) return BUILTINS.get(name);
    if (name === "constructor") {
        const ctor = info?.constructor ?? Object;
        return labelFunction(ctor,`[class ${info ? info.qname.split(".").pop() : "Object"}]`);
    }
    if (info && !info.chain[0]!.traits!.dynamic) return referenceError(1069,name,info.qname);
    return undefined;
}
function slotValue(type:string,value:unknown):unknown {
    switch(type) {
        case "*": return value;
        case "Object": return value === undefined ? null : value;
        case "int": if (value !== null && typeof value === "object" || typeof value === "function") break; return Number(value)>>0;
        case "uint": if (value !== null && typeof value === "object" || typeof value === "function") break; return Number(value)>>>0;
        case "Number": if (value !== null && typeof value === "object" || typeof value === "function") break; return Number(value);
        case "Boolean": return Boolean(value);
        case "String": if (value !== null && typeof value === "object" || typeof value === "function") break;
            return value === null || value === undefined ? null : String(value);
    }
    return unavailable(`Native slot coercion for ${type} requires further support`);
}
export function as3ObjectWrite(value:unknown,key:unknown,next:unknown,caller:string | null = null):unknown {
    const target = receiver(value), name = keyName(key), info = describe(target);
    if (caller !== null) lookupObjectCaller(caller);
    if (info) {
        const members = findTrait(info,name,caller,false);
        const writable = members.find(member => member.kind === "field" || member.kind === "setter");
        if (writable) { Reflect.set(target,name,slotValue(writable.type,next)); return next; }
        if (members.some(member => member.kind === "method")) return referenceError(1037,name,info.qname);
        if (members.length) return referenceError(1074,name,info.qname);
        if (!info.chain[0]!.traits!.dynamic) return referenceError(1056,name,info.qname);
    }
    Object.defineProperty(target,name,{value:next,writable:true,enumerable:true,configurable:true});
    return next;
}
export function as3ObjectHasOwn(value:unknown,key:unknown):boolean {
    const target = receiver(value), name = keyName(key), info = describe(target);
    if (info) return findTrait(info,name,null,true).length > 0
        || info.chain[0]!.traits!.dynamic && Object.prototype.hasOwnProperty.call(target,name);
    return Object.prototype.hasOwnProperty.call(target,name);
}
export function as3ObjectHas(value:unknown,key:unknown):boolean {
    return as3ObjectHasOwn(value,key) || keyName(key) === "constructor"
        || BUILTINS.has(keyName(key));
}
export function as3ObjectDelete(value:unknown,key:unknown,caller:string | null = null):boolean {
    const target = receiver(value), name = keyName(key), info = describe(target);
    if (caller !== null) lookupObjectCaller(caller);
    if (info && (!info.chain[0]!.traits!.dynamic || findTrait(info,name,caller,false).length)) return false;
    return Reflect.deleteProperty(target,name);
}
export function as3ObjectCall(value:unknown,key:unknown,args:unknown[],caller:string | null = null):unknown {
    const fn = as3ObjectRead(value,key,caller);
    if (typeof fn !== "function") return unavailable("Dynamic non-callable errors require native call evidence");
    return Reflect.apply(fn,value,args);
}

/** Preserve source evaluation order: the in key evaluates before its receiver. */
export function as3ObjectIn(key:unknown,value:unknown):boolean { return as3ObjectHas(value,key); }

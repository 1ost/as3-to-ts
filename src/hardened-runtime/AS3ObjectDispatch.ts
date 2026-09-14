import { isAS3ReflectionValue, as3ReflectionVariable, as3ReflectionAttribute } from "./AS3Reflection";
import { as3FunctionArgument, isAS3SourceLambda } from "./AS3Function";
import { AS3ArgumentError, AS3RangeError, AS3SecurityError } from "./AS3Error";
import { as3StringSplit } from "./AS3Coerce";
import { as3ArrayCall, as3ArrayDelete, as3ArrayRead, as3ArrayWrite, as3ArrayLengthWrite } from "./AS3Array";
import { as3DecimalMagnitude } from "./internal/AS3NumberFormat";
import { AS3Types, testType, lookupStaticCallClass, lookupObjectClass, lookupObjectCaller, lookupObjectCallerPackage, lookupStringClassName, lookupNamedReferenceType, castReference, AS3ObjectTraits } from "./internal/AS3TypeRegistry";
import { as3BindMethod, isAS3MethodClosure } from "./AS3MethodClosure";

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
    if (typeof value === "bigint" || typeof value === "symbol")
        return unavailable("Host-only primitives are not native Object keys");
    // Flash property names use the public String-hint conversion protocol.
    // Retained object-keys evidence includes null-result fallback and errors.
    return nativeString(value,new Set());
}
function describe(value:object):ClassInfo | null {
    const info = lookupObjectClass(value);
    if (info) {
        if (info.chain.some(owner => owner.traits === null && owner.nativeTraits === null)) return unavailable("Mapped class traits are unresolved");
        return info;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
        return unavailable("Unregistered Object receiver identity");
    return null;
}
function dynamicClass(info:ClassInfo):boolean {
    const own=info.chain[0]!;
    const dynamic=own.traits?.dynamic ?? own.nativeTraits?.dynamic;
    if (typeof dynamic !== "boolean") return unavailable("Native dynamic class flag is unresolved");
    return dynamic;
}
function findTrait(info:ClassInfo, key:string, caller:string | null, publicOnly:boolean):Member[] {
    const context = caller === null ? [] : lookupObjectCaller(caller);
    const matches:Member[] = [];
    const storage = new Set<string>();
    for (const owner of info.chain) {
        if (!owner.traits) {
            if (owner.nativeTraits!.names.includes(key)) return unavailable(`Native member ${owner.qname}.${key} lacks authenticated dynamic dispatch`);
            continue;
        }
        for (const member of owner.traits!.members.filter(member => member.name === key)) {
            if (member.namespaceName !== null) return unavailable("Named namespace URIs require authenticated resolution");
            const namespace = member.visibility === "private" ? `private:${owner.qname}`
                : member.visibility === "internal" ? `internal:${owner.packageName}` : member.visibility;
            storage.add(namespace);
            const visible = member.visibility === "public" || !publicOnly && caller !== null && (
                member.visibility === "private" && caller === owner.qname
                || member.visibility === "internal" && lookupObjectCallerPackage(caller) === owner.packageName
                || member.visibility === "protected" && context.includes(owner.qname));
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
    return `[object ${info ? info.localName : "Object"}]`;
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
    if (info && !dynamicClass(info)) return false;
    return Object.getOwnPropertyDescriptor(target,name)?.enumerable === true;
},"function Function() {}"));
BUILTINS.set("setPropertyIsEnumerable",labelFunction(function(this:unknown,key:unknown,flag?:unknown):void {
    const target=receiver(this), name=keyName(key === undefined ? null : key), info=describe(target);
    if (info && !dynamicClass(info)) referenceError(1056,name,info.diagnosticName);
    const descriptor=Object.getOwnPropertyDescriptor(target,name);
    if (descriptor) Object.defineProperty(target,name,{...descriptor,enumerable:arguments.length < 2 ? true : Boolean(flag)});
},"function Function() {}"));
BUILTINS.set("isPrototypeOf",labelFunction(function(this:unknown,other:unknown):boolean {
    const target=receiver(this); describe(target);
    return Reflect.apply(Object.prototype.isPrototypeOf,target,[other]);
},"function Function() {}"));

export function as3ObjectRead(value:unknown, key:unknown, caller:string | null = null):unknown {
    const target = receiver(value), name = keyName(key);
    if (caller !== null) lookupObjectCaller(caller);
    if (isAS3ReflectionValue(value)) {
        if (name === "variable") return as3ReflectionVariable(value);
        return unavailable("Reflection XML reads outside variable selection require native evidence");
    }
    if (Array.isArray(target)) {
        if (name === "length") return target.length;
        const index=Number(name);
        if (as3NativeString(index) === name) return as3ArrayRead(target,index);
        return unavailable("Dynamic Array named reads require native member evidence");
    }
    const info = describe(target);
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
        return labelFunction(ctor,`[class ${info ? info.localName : "Object"}]`);
    }
    if (info && !dynamicClass(info)) return referenceError(1069,name,info.diagnosticName);
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
        default: {
            // Only the sealed class/interface authority can admit reference slots.
            // Primitive conversion holds above must not enter this branch.
            let token: ReturnType<typeof lookupNamedReferenceType>;
            try { token = lookupNamedReferenceType(type); }
            catch { return unavailable(`Native slot reference type ${type} is not registered`); }
            return castReference(value, token);
        }
    }
    return unavailable(`Native slot coercion for ${type} requires further support`);
}
export function as3ObjectWrite(value:unknown,key:unknown,next:unknown,caller:string | null = null):unknown {
    const target = receiver(value), name = keyName(key);
    if (caller !== null) lookupObjectCaller(caller);
    if (Array.isArray(target)) {
        if (name === "length") return as3ArrayLengthWrite(target,next);
        const index=Number(name);
        if (as3NativeString(index) === name) return as3ArrayWrite(target,index,next);
        return unavailable("Dynamic Array named writes require native member evidence");
    }
    const info = describe(target);
    if (info) {
        const members = findTrait(info,name,caller,false);
        const writable = members.find(member => member.kind === "field" || member.kind === "setter");
        if (writable) { Reflect.set(target,name,slotValue(writable.type,next)); return next; }
        if (members.some(member => member.kind === "method")) return referenceError(1037,name,info.diagnosticName);
        if (members.length) return referenceError(1074,name,info.diagnosticName);
        if (!dynamicClass(info)) return referenceError(1056,name,info.diagnosticName);
    }
    Object.defineProperty(target,name,{value:next,writable:true,enumerable:true,configurable:true});
    return next;
}
/** Update retains receiver/key values but repeats key conversion for the store. */
export function as3ObjectUpdate(value:unknown,key:unknown,increment:0|1,prefix:boolean,caller:string | null = null):number {
    const prior=as3NativeNumber(as3ObjectRead(value,key,caller));
    const next=increment ? prior+1 : prior-1;
    as3ObjectWrite(value,key,next,caller);
    return prefix ? next : prior;
}
export function as3ObjectHasOwn(value:unknown,key:unknown):boolean {
    const target = receiver(value), name = keyName(key), info = describe(target);
    if (info) return findTrait(info,name,null,true).length > 0
        || dynamicClass(info) && Object.prototype.hasOwnProperty.call(target,name);
    return Object.prototype.hasOwnProperty.call(target,name);
}
export function as3ObjectHas(value:unknown,key:unknown):boolean {
    const target = receiver(value), name = keyName(key);
    // Convert once even when the name is missing or resolves to a builtin.
    return as3ObjectHasOwn(target,name) || name === "constructor" || BUILTINS.has(name);
}
export function as3ObjectDelete(value:unknown,key:unknown,caller:string | null = null):boolean {
    const target = receiver(value), name = keyName(key);
    if (caller !== null) lookupObjectCaller(caller);
    if (Array.isArray(target)) return as3ArrayDelete(target,name);
    const info = describe(target);
    if (info && (!dynamicClass(info) || findTrait(info,name,caller,false).length)) return false;
    return Reflect.deleteProperty(target,name);
}
/** Source Class static calls. Error identities are native-proved; exact diagnostic strings need supplemental evidence. */
function staticClassCall(value:Function,key:unknown,args:unknown[],caller:string|null):unknown {
    const info=lookupStaticCallClass(value);
    if (!info || info.traits===null) return unavailable("Class static calls lack authenticated source traits");
    if (caller!==null) lookupObjectCaller(caller);
    const name=keyName(key);
    if (info.traits.unsupportedNames.includes(name)) return unavailable("Static value/accessor calls require native source authority support");
    const method=info.traits.methods.find(item=>item.name===name);
    if (method?.visibility==="protected") return unavailable("Protected static calls require native evidence");
    const visible=method && (method.visibility==="public"
        || method.visibility==="private" && caller===info.qname
        || method.visibility==="internal" && caller!==null && lookupObjectCallerPackage(caller)===info.packageName);
    if (!visible) {
        const error=new TypeError(`Error #1006: ${name} is not a function.`);
        Object.defineProperty(error,"errorID",{value:1006});throw error;
    }
    if (args.length<method.required || !method.rest && args.length>method.total)
        throw new AS3ArgumentError(`Error #1063: Argument count mismatch on ${info.qname}/${name}(). Expected ${method.required}, got ${args.length}.`,1063);
    const descriptor=Object.getOwnPropertyDescriptor(value,name);
    if (!descriptor || !("value" in descriptor) || descriptor.value!==method.callable)
        return unavailable("Authenticated static method storage changed");
    // Convert every supplied fixed parameter left-to-right before the body. Rest
    // values remain untyped; omitted optional parameters retain source defaults.
    const converted=args.slice();
    for(let index=0;index<Math.min(args.length,method.total);index++) {
        const type=method.parameterTypes[index]!, argument=args[index];
        if (["*","Object","String","Number","int","uint","Boolean","Array","Function"].includes(type))
            converted[index]=as3FunctionArgument(argument,type);
        else if(type==="Class") {
            if(argument===null || argument===undefined) converted[index]=null;
            else if(testType(argument,AS3Types.Class)) converted[index]=argument;
            else {
                const error=new TypeError("Error #1034: Type Coercion failed: cannot convert value to Class.");
                Object.defineProperty(error,"errorID",{value:1034});throw error;
            }
        } else converted[index]=castReference(argument,lookupNamedReferenceType(type));
    }
    return Reflect.apply(method.callable,value,converted);
}

/** Emit prepare(receiver,key,caller)([arguments]) so null fails before argument effects.
 * Only String keys are currently admitted; object-key conversion ordering remains held.
 */
export function as3PrepareClassCall(value:unknown,key:string,caller:string|null=null):(args:unknown[])=>unknown {
    if (value===null || value===undefined) receiver(value);
    if (typeof value!=="function" || !lookupStaticCallClass(value))
        return unavailable("Computed Class calls require exact registered Class identity");
    if (typeof key!=="string") return unavailable("Computed Class keys require authenticated String values");
    if (caller!==null) lookupObjectCaller(caller);
    return args=>staticClassCall(value,key,args,caller);
}

export function as3ObjectCall(value:unknown,key:unknown,args:unknown[],caller:string | null = null):unknown {
    if (isAS3ReflectionValue(value)) {
        if (caller !== null) lookupObjectCaller(caller);
        if (key === "attribute" && args.length === 1) return as3ReflectionAttribute(value,args[0]);
        return unavailable("Reflection XML calls outside single-argument attribute selection require native evidence");
    }
    if (key === "split" && typeof value === "string") {
        if (caller !== null) lookupObjectCaller(caller);
        return as3StringSplit(value,args);
    }
    // Fixed-name push calls are admitted independently of computed dispatch.
    // Native primitives fail only after the caller has evaluated all arguments.
    if (key === "push" && ["string","number","boolean"].includes(typeof value)) {
        const error=new TypeError("Error #1006: value is not a function.");
        Object.defineProperty(error,"errorID",{value:1006}); throw error;
    }
    receiver(value);
    const name=keyName(key);
    if (name === "push" && Array.isArray(value)) {
        if (caller !== null) lookupObjectCaller(caller);
        return as3ArrayCall(value,"push",args);
    }
    const fn = as3ObjectRead(value,name,caller);
    if (typeof fn !== "function") {
        const error=new TypeError(`Error #1006: ${name} is not a function.`);
        Object.defineProperty(error,"errorID",{value:1006}); throw error;
    }
    if (name !== "hasOwnProperty" && name !== "toString" && !isAS3MethodClosure(fn) && !isAS3SourceLambda(fn) && ![...BUILTINS.values()].includes(fn))
        return unavailable("Dynamic function values require authenticated method-closure argument behavior");
    return Reflect.apply(fn,value,args);
}

/** Explicit Function getter call: arguments have evaluated before this lookup. */
export function as3ObjectFunctionAccessorCall(value:unknown,name:string,args:unknown[],caller:string):unknown {
    const target=receiver(value);
    lookupObjectCaller(caller);
    const info=describe(target);
    if (!info) return unavailable("Function accessor calls require a registered original instance");
    const getter=findTrait(info,name,caller,false).find(member=>member.kind === "getter");
    if (!getter || getter.type !== "Function")
        return unavailable("Function accessor calls require an authenticated Function getter");
    const fn=as3ObjectRead(value,name,caller);
    if (typeof fn !== "function") {
        const error=new TypeError("Error #1006: value is not a function.");
        Object.defineProperty(error,"errorID",{value:1006}); throw error;
    }
    if (!isAS3MethodClosure(fn) && !isAS3SourceLambda(fn))
        return unavailable("Function accessor values require an authenticated method closure or source lambda");
    return Reflect.apply(fn,value,args);
}

/** Preserve source evaluation order: the in key evaluates before its receiver. */
export function as3ObjectIn(key:unknown,value:unknown):boolean { return as3ObjectHas(value,key); }

function conversionError(id:number, description:string):never {
    const error = new TypeError(`Error #${id}: ${description}`);
    Object.defineProperty(error,"errorID",{value:id}); throw error;
}
function convertedPrimitive(value:unknown):boolean {
    // Native conversion accepts undefined but retries valueOf after a null result.
    return value !== null && typeof value !== "object" && typeof value !== "function";
}
function arrayString(value:unknown[], active:Set<object>, separator:string=","):string {
    if (active.has(value)) return unavailable("Cyclic Array String conversion requires native recursion evidence");
    if (Object.prototype.hasOwnProperty.call(value,"join"))
        return unavailable("Overridden Array join conversion requires native dispatch evidence");
    active.add(value);
    try {
        const parts:string[] = [];
        for (let i=0;i<value.length;i++) {
            const element=value[i];
            parts.push(element === null || element === undefined ? "" : nativeString(element,active));
        }
        return parts.join(separator);
    } finally { active.delete(value); }
}
function conversionMethod(value:object, name:string, active:Set<object>):unknown {
    const array=Array.isArray(value);
    const nativeError = value instanceof Error && [Error.prototype,AS3ArgumentError.prototype,AS3RangeError.prototype,AS3SecurityError.prototype,TypeError.prototype,ReferenceError.prototype,
        RangeError.prototype,SyntaxError.prototype,URIError.prototype,EvalError.prototype].includes(Object.getPrototypeOf(value));
    if (array && Object.getPrototypeOf(value) !== Array.prototype)
        return unavailable("Array subclass conversion requires authenticated native traits");
    if (nativeError) {
        return Object.prototype.hasOwnProperty.call(value,name) ? Reflect.get(value,name)
            : name === "valueOf" ? function() {return value;}
                : function() {
                    const label=nativeString((value as Error).name,active), message=nativeString((value as Error).message,active);
                    return message === "" ? label : label + ": " + message;
                };
    }
    if (array) {
        return Object.prototype.hasOwnProperty.call(value,name) ? Reflect.get(value,name)
            : name === "toString" ? function() {return arrayString(value as unknown[],active);}
                : function() {return value;};
    }
    return as3ObjectRead(value,name,null);
}
function nativePrimitive(value:object, hint:"string" | "number", active:Set<object>):unknown {
    for (const name of hint === "string" ? ["toString","valueOf"] : ["valueOf","toString"]) {
        const fn=conversionMethod(value,name,active);
        if (typeof fn !== "function") conversionError(1006,`${name} is not a function.`);
        const result=Reflect.apply(fn,value,[]);
        if (convertedPrimitive(result)) return result;
    }
    return conversionError(1050,"Cannot convert Object to primitive.");
}
function nativeString(value:unknown, active:Set<object>):string {
    const className=lookupStringClassName(value);
    if (className !== null) return `[class ${className.slice(className.lastIndexOf("::") >= 0 ? className.lastIndexOf("::") + 2 : className.lastIndexOf(".") + 1)}]`;
    if (typeof value === "function") return as3ObjectFunctionLabel(value) ?? "function Function() {}";
    if (value === null || typeof value !== "object") return String(value);
    return String(nativePrimitive(value,"string",active));
}

function additionPrimitive(value:unknown):unknown {
    if (typeof value === "function" || lookupStringClassName(value) !== null) {
        if (Object.prototype.hasOwnProperty.call(value,"valueOf") || Object.prototype.hasOwnProperty.call(value,"toString"))
            return unavailable("Overridden Function/Class addition conversion requires native dispatch evidence");
        return nativeString(value,new Set());
    }
    if (value !== null && typeof value === "object") return nativePrimitive(value,"number",new Set());
    if (typeof value === "bigint" || typeof value === "symbol")
        return unavailable("Host-only primitive has no AS3 addition conversion");
    return value;
}

/** AIR reverses primitive conversion for <= and >, after both expressions evaluate. */
export function as3NativeRelation(left:unknown, right:unknown, operator:"<" | "<=" | ">" | ">="):boolean {
    const reverse = operator === "<=" || operator === ">";
    const first = additionPrimitive(reverse ? right : left);
    const second = additionPrimitive(reverse ? left : right);
    let less:boolean;
    if (typeof first === "string" && typeof second === "string") less = first < second;
    else {
        const a = as3NativeNumber(first), b = as3NativeNumber(second);
        if (Number.isNaN(a) || Number.isNaN(b)) return false;
        less = a < b;
    }
    return operator === "<=" || operator === ">=" ? !less : less;
}

/** Native abstract equality: reference pairs never invoke primitive conversion. */
export function as3NativeEquals(left:unknown, right:unknown):boolean {
    if ([left,right].some(value => typeof value === "bigint" || typeof value === "symbol"))
        return unavailable("Host-only primitive has no AS3 equality conversion");
    if (typeof left === typeof right) return left === right;
    if (left === null || left === undefined) return right === null || right === undefined;
    if (right === null || right === undefined) return false;
    if (typeof left === "boolean") return as3NativeEquals(Number(left),right);
    if (typeof right === "boolean") return as3NativeEquals(left,Number(right));
    if (typeof left === "number" && typeof right === "string") return left === as3NativeNumber(right);
    if (typeof left === "string" && typeof right === "number") return as3NativeNumber(left) === right;
    const reference = (value:unknown):boolean => typeof value === "object" || typeof value === "function";
    if (reference(left) && reference(right)) return false;
    if (reference(left)) return as3NativeEquals(additionPrimitive(left),right);
    if (reference(right)) return as3NativeEquals(left,additionPrimitive(right));
    return false;
}

/** AIR takes a String-conversion fast path before general primitive conversion. */
export function as3NativeAdd(left:unknown, right:unknown):string|number {
    if ([left,right].some(value => typeof value === "bigint" || typeof value === "symbol"))
        return unavailable("Host-only primitive has no AS3 addition conversion");
    if (typeof left === "string")
        return nativeString(left,new Set())+nativeString(right,new Set());
    const a=additionPrimitive(left), b=additionPrimitive(right);
    if (typeof a === "string" || typeof b === "string")
        return nativeString(a,new Set())+nativeString(b,new Set());
    return as3NativeNumber(a)+as3NativeNumber(b);
}

/** AVM numeric text predates JavaScript binary/octal prefixes and accepts signed hex. */
function numberText(value:string):number {
    // This is the retained AVM whitespace set, not JavaScript's trim set.
    const spaces="[\\x09-\\x0d \\u2000-\\u200b\\u2028\\u2029\\u205f\\u3000]";
    const leading=value.replace(new RegExp("^"+spaces+"+"),"");
    const text=leading.replace(new RegExp(spaces+"+$"),"");
    if (text === "") return 0;
    if (/^[+-]?0[xX][0-9a-fA-F]+$/.test(text)) {
        const sign=text[0] === "-" ? -1 : 1;
        return sign * Number(text.replace(/^[+-]/,""));
    }
    if (new RegExp("^[+-]?Infinity(?:$|"+spaces+")").test(leading))
        return leading[0] === "-" ? -Infinity : Infinity;
    // Native decimal scanning stops at a NUL after numeric input. A bare e/e+
    // has exponent zero; an e- at the physical end of the string is invalid.
    const decimal=leading.split("\0",1)[0]!.replace(new RegExp(spaces+"+$"),"");
    const match=/^([+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+))(?:[eE]([+-]?)([0-9]*))?$/.exec(decimal);
    if (!match || /[eE]-$/.test(leading)) return NaN;
    let exponent=0;
    for (const digit of match[3] || "") exponent=(exponent*10+Number(digit))|0;
    if (match[2] === "-") exponent=(-exponent)|0;
    return as3DecimalMagnitude(match[1]!, exponent);
}

/** Number-hint conversion uses public valueOf before toString, exactly once each. */
export function as3NativeNumber(value:unknown):number {
    if (typeof value === "function" || lookupStringClassName(value) !== null) {
        if (Object.prototype.hasOwnProperty.call(value,"valueOf") || Object.prototype.hasOwnProperty.call(value,"toString"))
            return unavailable("Overridden Function/Class numeric conversion requires native dispatch evidence");
        return NaN;
    }
    const primitive=value !== null && typeof value === "object"
        ? nativePrimitive(value,"number",new Set()) : value;
    if (typeof primitive === "string") return numberText(primitive);
    if (typeof primitive === "bigint" || typeof primitive === "symbol")
        return unavailable("Host-only primitive has no AS3 Number conversion");
    return Number(primitive);
}

/** Native String conversion for scalars, Arrays and authenticated local Object traits. */
export function as3NativeString(value:unknown):string { return nativeString(value,new Set()); }

/** Native Array.join converts the separator before visiting elements, with undefined defaulting to comma. */
export function as3NativeArrayJoin(value:unknown[], separator:unknown):string {
    const active=new Set<object>();
    const text=separator === undefined ? "," : nativeString(separator,active);
    return arrayString(value,active,text);
}

/** Dynamic properties enumerate without a promised order; declared traits never become entries. */
export function* as3ObjectEnumerableValues(value:object):Generator<unknown,void,unknown> {
    const info=describe(value);
    if (info && !dynamicClass(info)) return;
    const declared=new Set(info?.chain.flatMap(owner=>owner.traits?.members.map(member=>member.name)
        || owner.nativeTraits?.names || []) || []);
    for (const name in value) {
        if (declared.has(name)) continue;
        yield Reflect.get(value,name);
    }
}

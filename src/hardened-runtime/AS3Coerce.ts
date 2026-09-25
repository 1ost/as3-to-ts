import { AS3ArgumentError, AS3RangeError, AS3SecurityError } from "./AS3Error";
import { as3ArrayLiteral } from "./AS3Array";
import { as3IntegerText } from "./internal/AS3ParseInteger";
import { as3ObjectLiteral } from "./AS3Object";
import { as3FixedDecimal } from "./internal/AS3NumberFormat";
import { AS3_LOWERCASE_BMP } from "./internal/AS3CaseTable";
import { as3NativeString, as3NativeNumber, as3NativeAdd, as3NativeEquals, as3NativeRelation, AS3ObjectDispatchUnavailable } from "./AS3ObjectDispatch";

/** AIR51 numeric Math.round: addition rounds before floor, and zero becomes positive. */
export function as3MathRound(value:number):number {
    if(typeof value!=="number") throw new AS3ObjectDispatchUnavailable("Math.round requires a proven numeric input");
    return Math.floor(value+0.5);
}

export function as3Int(value: unknown = 0): number {
    return as3NativeNumber(value) >> 0;
}

export function as3Uint(value: unknown = 0): number {
    return as3NativeNumber(value) >>> 0;
}

export function as3Number(value?: unknown): number {
    return arguments.length === 0 ? 0 : as3NativeNumber(value);
}

/** Global isNaN coerces through the native Number protocol exactly once. */
export function as3IsNaN(value:unknown=NaN):boolean {
    return Number.isNaN(as3NativeNumber(value));
}

export function as3Boolean(value: unknown = false): boolean {
    return Boolean(value);
}

export function as3String(value?: unknown): string {
    return arguments.length === 0 ? "" : as3NativeString(value);
}

/** AVM Object slots preserve primitive/reference values but normalize undefined. */
export function as3Object(value: unknown): unknown {
    return value === undefined ? null : value;
}


/** Native Object(value) creates a fresh object for nullish values, unlike slot conversion. */
export function as3ObjectConversion(value: unknown): unknown {
    return value === null || value === undefined ? as3ObjectLiteral([]) : value;
}

/** Delay conversion until the shared trace bridge reaches this argument. */
export function as3TraceValue(value:unknown):{toString():string} {
    return {toString:() => as3String(value)};
}

/** Both operand expressions evaluate before either native numeric conversion. */
export function as3NumericBinary(operator:"-" | "*" | "/" | "%", left:unknown, right:unknown):number {
    const a=as3NativeNumber(left), b=as3NativeNumber(right);
    switch (operator) {
        case "-": return a-b;
        case "*": return a*b;
        case "/": return a/b;
        case "%": return a%b;
    }
}


function primitiveReceiver(value:unknown):void {
    if (value === null || value === undefined) {
        const id=value === null ? 1009 : 1010;
        const error=new TypeError(`Error #${id}: ${id === 1009 ? "Cannot access a property or method of a null object reference." : "A term is undefined and has no properties."}`);
        Object.defineProperty(error,"errorID",{value:id});throw error;
    }
}

function primitiveString(value:unknown, operation:string):string {
    primitiveReceiver(value);
    if(typeof value!=="string")
        throw new AS3ObjectDispatchUnavailable(`String.${operation} requires an original String value`);
    return value;
}

/** AVM String indices use Number conversion followed by truncation, without uint wrapping. */
function as3StringIndex(value:unknown, nanValue:number):number {
    const numeric=as3NativeNumber(value);
    if(Number.isNaN(numeric)) return nanValue;
    if(numeric===0 || !Number.isFinite(numeric)) return numeric;
    return numeric < 0 ? Math.ceil(numeric) : Math.floor(numeric);
}

/** Flash String.length counts UTF-16 code units and retains native null errors. */
export function as3StringLength(value:unknown):number {
    primitiveReceiver(value);
    if (typeof value !== "string") throw new AS3ObjectDispatchUnavailable("String.length requires an original String value");
    return value.length;
}

/** Native Error defaults to ID zero; shared runtime errors retain their explicit integer ID. */
export function as3ErrorID(value:unknown):number {
    primitiveReceiver(value);
    if (!(value instanceof Error)) throw new AS3ObjectDispatchUnavailable("Error.errorID requires a native Error");
    const descriptor=Object.getOwnPropertyDescriptor(value,"errorID");
    if (!descriptor && !("errorID" in value)) return 0;
    if (!descriptor || !("value" in descriptor) || !Number.isInteger(descriptor.value)
        || descriptor.value < -2147483648 || descriptor.value > 2147483647)
        throw new AS3ObjectDispatchUnavailable("Error.errorID requires an integer native error slot");
    return descriptor.value;
}

/** Canonical native Error.toString; custom overrides require their own dispatch evidence. */
export function as3ErrorToString(value:unknown):string {
    primitiveReceiver(value);
    if (!(value instanceof Error) || ![Error.prototype,AS3ArgumentError.prototype,AS3RangeError.prototype,AS3SecurityError.prototype,TypeError.prototype,ReferenceError.prototype,
        RangeError.prototype,SyntaxError.prototype,URIError.prototype,EvalError.prototype].includes(Object.getPrototypeOf(value))
        || Reflect.get(value,"toString") !== Error.prototype.toString)
        throw new AS3ObjectDispatchUnavailable("Error.toString requires canonical native Error traits");
    return as3String(value);
}


/** AIR uses single UTF-16-unit lowercase mappings, without contextual or expanding casing. */
export function as3StringToLowerCase(value:unknown):string {
    primitiveReceiver(value);
    if (typeof value !== "string") throw new AS3ObjectDispatchUnavailable("String.toLowerCase requires an original String value");
    const result:string[]=[];
    for (let i=0;i<value.length;i++) {
        const unit=value.charCodeAt(i);
        result.push(String.fromCharCode(AS3_LOWERCASE_BMP[unit] ?? unit));
    }
    return result.join("");
}

/** Native charAt indexes UTF-16 units without wrapping large indices to int32. */
export function as3StringCharAt(value:unknown, index:number=0):string {
    primitiveReceiver(value);
    if (typeof value !== "string" || typeof index !== "number")
        throw new AS3ObjectDispatchUnavailable("String.charAt requires an original String and numeric index");
    return value.charAt(index);
}

/** Native lastIndexOf: arguments are already evaluated; position converts before search. */
export function as3StringLastIndexOf(value:unknown,args:unknown[]):number {
    if(args.length>2)
        throw new AS3ObjectDispatchUnavailable("String.lastIndexOf requires at most two arguments");
    const text=primitiveString(value,"lastIndexOf");
    const position=args.length<2 ? 2147483647 : as3StringIndex(args[1],2147483647);
    const search=args.length<1 ? "undefined" : as3NativeString(args[0]);
    if(position<0) return -1;
    return text.lastIndexOf(search,Math.min(position,text.length));
}

function as3StringRange(value:unknown,args:unknown[],operation:"substring"|"slice"):string {
    if(args.length>2)
        throw new AS3ObjectDispatchUnavailable(`String.${operation} requires at most two arguments`);
    const text=primitiveString(value,operation);
    // AIR converts the later Number parameter before the earlier one.
    const end=args.length<2 ? text.length : as3StringIndex(args[1],0);
    const start=args.length<1 ? 0 : as3StringIndex(args[0],0);
    if(operation==="substring") {
        const boundedStart=Math.min(Math.max(start,0),text.length);
        const boundedEnd=Math.min(Math.max(end,0),text.length);
        return boundedStart<=boundedEnd ? text.substring(boundedStart,boundedEnd)
            : text.substring(boundedEnd,boundedStart);
    }
    const relative=(index:number):number => index<0 ? Math.max(text.length+index,0) : Math.min(index,text.length);
    return text.slice(relative(start),relative(end));
}

/** Native substring with AIR defaults, bounds and reverse parameter coercion. */
export function as3StringSubstring(value:unknown,args:unknown[]):string {
    return as3StringRange(value,args,"substring");
}

/** Native slice with AIR defaults, relative bounds and reverse parameter coercion. */
export function as3StringSlice(value:unknown,args:unknown[]):string {
    return as3StringRange(value,args,"slice");
}

/** Native String-delimiter splitting, including argument conversion order. */
export function as3StringSplit(value:unknown,args:unknown[]):unknown[] {
    primitiveReceiver(value);
    if (typeof value !== "string" || args.length > 2)
        throw new AS3ObjectDispatchUnavailable("String.split requires an original String and at most two arguments");
    const limit=args.length < 2 || args[1] === null || args[1] === undefined ? 0xffffffff : as3Uint(args[1]);
    if (limit === 0) return as3ArrayLiteral([]);
    // AIR skips delimiter conversion for empty input, even with a custom hook.
    if (value.length === 0 || args.length === 0) return as3ArrayLiteral([value]);
    const delimiter=as3NativeString(args[0]);
    return as3ArrayLiteral(value.split(delimiter,limit));
}

/** Native Number method: evaluate arguments first, then convert precision to int. */
export function as3NumberToFixed(value:unknown, precision:unknown=0):string {
    primitiveReceiver(value);
    if (typeof value !== "number") throw new AS3ObjectDispatchUnavailable("Number.toFixed requires an original numeric value");
    return as3FixedDecimal(value,as3Int(precision));
}

/** Both operand expressions evaluate before the native addition conversion. */
export function as3Add(left:string, right:unknown):string;
export function as3Add(left:unknown, right:string):string;
export function as3Add(left:unknown, right:unknown):string|number;
export function as3Add(left:unknown, right:unknown):string|number {
    return as3NativeAdd(left,right);
}

/** Argument evaluation stays left to right; native primitive conversion is operator-specific. */
export function as3Relation(left:unknown, right:unknown, operator:"<" | "<=" | ">" | ">="):boolean {
    return as3NativeRelation(left,right,operator);
}

/** Both operand expressions evaluate before native equality conversion starts. */
export function as3Equals(left:unknown, right:unknown):boolean {
    return as3NativeEquals(left,right);
}

/** Native global parseInt: evaluate both arguments before String then int conversion. */
export function as3ParseInt(value?: unknown, radix?: unknown): number {
    // Native String parameter coercion maps explicit undefined to null.
    const text = arguments.length === 0 ? "NaN" : as3String(value === undefined ? null : value);
    const base = arguments.length < 2 ? 0 : as3Int(radix);
    return as3IntegerText(text, base);
}

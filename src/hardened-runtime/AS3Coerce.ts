import { as3ObjectLiteral } from "./AS3Object";
import { as3FixedDecimal } from "./internal/AS3NumberFormat";
import { AS3_LOWERCASE_BMP } from "./internal/AS3CaseTable";
import { as3NativeString, as3NativeNumber, as3NativeAdd, as3NativeEquals, AS3ObjectDispatchUnavailable } from "./AS3ObjectDispatch";

export function as3Int(value: unknown = 0): number {
    return as3NativeNumber(value) >> 0;
}

export function as3Uint(value: unknown = 0): number {
    return as3NativeNumber(value) >>> 0;
}

export function as3Number(value?: unknown): number {
    return arguments.length === 0 ? 0 : as3NativeNumber(value);
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

/** Flash String.length counts UTF-16 code units and retains native null errors. */
export function as3StringLength(value:unknown):number {
    primitiveReceiver(value);
    if (typeof value !== "string") throw new AS3ObjectDispatchUnavailable("String.length requires an original String value");
    return value.length;
}

/** Canonical native Error.toString; custom overrides require their own dispatch evidence. */
export function as3ErrorToString(value:unknown):string {
    primitiveReceiver(value);
    if (!(value instanceof Error) || ![Error.prototype,TypeError.prototype,ReferenceError.prototype,
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

/** Native Number method: evaluate arguments first, then convert precision to int. */
export function as3NumberToFixed(value:unknown, precision:unknown=0):string {
    primitiveReceiver(value);
    if (typeof value !== "number") throw new AS3ObjectDispatchUnavailable("Number.toFixed requires an original numeric value");
    return as3FixedDecimal(value,as3Int(precision));
}

/** Both operand expressions evaluate before the native addition conversion. */
export function as3Add(left:unknown, right:unknown):string|number {
    return as3NativeAdd(left,right);
}

/** Both operand expressions evaluate before native equality conversion starts. */
export function as3Equals(left:unknown, right:unknown):boolean {
    return as3NativeEquals(left,right);
}

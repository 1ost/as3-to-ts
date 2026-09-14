/** Zero-argument Date subset; SDK constructors/calendar parsing remain compiler holds. */
const NativeDate = Date;
const nativeValueOf = Date.prototype.valueOf;
const values = new WeakMap<object, Date>();
export function isAS3Date(value: unknown): value is AS3Date {
    return typeof value === "object" && value !== null && values.has(value);
}
/** Preserve Flash null-receiver errors before JavaScript property lookup. */
export function as3DateReceiver(value: unknown): AS3Date {
    if (value === null || value === undefined) {
        const id=value === null ? 1009 : 1010;
        const error=new TypeError(`Error #${id}: ${id === 1009 ? "Cannot access a property or method of a null object reference." : "A term is undefined and has no properties."}`);
        Object.defineProperty(error,"errorID",{value:id});throw error;
    }
    if (!isAS3Date(value)) throw new TypeError("Date method requires its original native Date receiver");
    return value;
}
function milliseconds(value: object): number {
    const date=values.get(value);
    if(!date) throw new TypeError("Date method requires its original native Date receiver");
    return nativeValueOf.call(date);
}
export class AS3Date {
    constructor() {
        if(arguments.length!==0) throw new TypeError("Only zero-argument Date construction is supported");
        values.set(this,new NativeDate());
    }
    [Symbol.toPrimitive](): never { throw new TypeError("Date primitive conversion is outside the supported native subset"); }
    valueOf(): number { return milliseconds(this); }
    getTime(): number { return milliseconds(this); }
    get time(): number { return milliseconds(this); }
}

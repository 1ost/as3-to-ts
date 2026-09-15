/** Authenticated zero-argument and six-number local-calendar Date subset. */
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
    constructor(...args: [] | [number, number, number, number, number, number]) {
        if(args.length!==0 && args.length!==6)
            throw new TypeError("Date construction requires zero arguments or six numeric calendar components");
        if(args.length===6 && args.some(value=>typeof value!=="number"))
            throw new TypeError("Six-component Date construction requires numeric arguments");
        values.set(this,args.length===0 ? new NativeDate()
            : new NativeDate(args[0],args[1],args[2],args[3],args[4],args[5]));
    }
    [Symbol.toPrimitive](): never { throw new TypeError("Date primitive conversion is outside the supported native subset"); }
    valueOf(): number { return milliseconds(this); }
    getTime(): number { return milliseconds(this); }
    get time(): number { return milliseconds(this); }
}

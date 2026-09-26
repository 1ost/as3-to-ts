/** Authenticated AP zero/four/six-component construction and bounded local Date mutation subset. */
const NativeDate = Date;
const NativeNumber = Number;
const nativeValueOf = Date.prototype.valueOf;
const nativeSetTime = Date.prototype.setTime;
const nativeSetHours = Date.prototype.setHours;
const nativeGetMinutes = Date.prototype.getMinutes;
const nativeSetMinutes = Date.prototype.setMinutes;
const nativeGetTimezoneOffset = Date.prototype.getTimezoneOffset;
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
    return Reflect.apply(nativeValueOf,date,[]);
}
function storedDate(value: object): Date {
    const date=values.get(value);
    if(!date) throw new TypeError("Date method requires its original native Date receiver");
    return date;
}
function numberArgument(value: unknown, operation: string): number {
    if(typeof value!=="number") throw new TypeError(`${operation} requires exact Number arguments`);
    return value;
}
type CalendarComponent = number | string;
export class AS3Date {
    constructor();
    constructor(value: number);
    constructor(year: number, month: number, date: number, hours: number);
    constructor(year: CalendarComponent, month: CalendarComponent, date: CalendarComponent,
        hours: CalendarComponent, minutes: CalendarComponent, seconds: CalendarComponent);
    constructor(...args: [] | [number] | [number, number, number, number] | [CalendarComponent, CalendarComponent, CalendarComponent,
        CalendarComponent, CalendarComponent, CalendarComponent]) {
        if(args.length!==0 && args.length!==1 && args.length!==4 && args.length!==6)
            throw new TypeError("Date construction requires zero arguments, one exact Number, four numeric, or six proven primitive calendar components");
        if(args.length===1 && typeof args[0]!=="number")
            throw new TypeError("One-argument Date construction requires an exact Number");
        if(args.length===4 && args.some(value=>typeof value!=="number"))
            throw new TypeError("Four-component Date construction requires exact Number arguments");
        if(args.length===6 && args.some(value=>typeof value!=="number" && typeof value!=="string"))
            throw new TypeError("Six-component Date construction requires primitive String or Number arguments");
        if(args.length===0) values.set(this,new NativeDate());
        else if(args.length===1) values.set(this,new NativeDate(args[0]));
        else {
            // JavaScript evaluates all constructor arguments before entering this
            // body. Convert only the already-captured primitive values, in order.
            const components=args.map(value=>NativeNumber(value));
            values.set(this,new NativeDate(components[0]!,components[1]!,components[2]!,
                components[3]!,args.length===4 ? 0 : components[4]!,args.length===4 ? 0 : components[5]!));
        }
    }
    [Symbol.toPrimitive](): never { throw new TypeError("Date primitive conversion is outside the supported native subset"); }
    valueOf(): number { return milliseconds(this); }
    getTime(): number { return milliseconds(this); }
    setTime(value: number): number {
        if(arguments.length!==1) throw new TypeError("Date.setTime requires exactly one Number argument");
        return Reflect.apply(nativeSetTime,storedDate(this),[numberArgument(value,"Date.setTime")]);
    }
    setHours(hours: number, minutes: number, seconds: number): number {
        if(arguments.length!==3) throw new TypeError("Date.setHours requires exactly three Number arguments");
        return Reflect.apply(nativeSetHours,storedDate(this),[
            numberArgument(hours,"Date.setHours"), numberArgument(minutes,"Date.setHours"),
            numberArgument(seconds,"Date.setHours"),
        ]);
    }
    get minutes(): number { return Reflect.apply(nativeGetMinutes,storedDate(this),[]); }
    set minutes(value: number) {
        Reflect.apply(nativeSetMinutes,storedDate(this),[numberArgument(value,"Date.minutes")]);
    }
    get time(): number { return milliseconds(this); }
    set time(value: number) {
        Reflect.apply(nativeSetTime,storedDate(this),[numberArgument(value,"Date.time")]);
    }
    get timezoneOffset(): number { return Reflect.apply(nativeGetTimezoneOffset,storedDate(this),[]); }
}

/** AIR ordered Date comparisons use numeric time and treat a null Date slot as zero. */
export function as3DateRelation(left: AS3Date | null, right: AS3Date | null,
    operator: "<" | "<=" | ">" | ">="): boolean {
    const first=left===null ? 0 : as3DateReceiver(left).valueOf();
    const second=right===null ? 0 : as3DateReceiver(right).valueOf();
    if(Number.isNaN(first)||Number.isNaN(second)) return false;
    switch(operator) {
        case "<": return first<second;
        case "<=": return first<=second;
        case ">": return first>second;
        case ">=": return first>=second;
    }
}

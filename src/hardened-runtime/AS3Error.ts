import {as3NativeNumber} from "./AS3ObjectDispatch";

/** AIR ArgumentError keeps the message value verbatim until string conversion.
 * Numeric identifiers are converted to native int after all arguments evaluate.
 * Typed catches, custom subclasses and reflection require separate authority.
 */
export class AS3ArgumentError extends Error {
    declare readonly errorID: number;
    constructor(message?: unknown, id: number = 0) {
        super();
        if (typeof id !== "number") throw new TypeError("ArgumentError identifier requires a proven numeric value");
        this.name = "ArgumentError";
        Object.defineProperty(this, "message", {
            value: arguments.length === 0 ? "" : message, writable: true, configurable: true,
        });
        Object.defineProperty(this, "errorID", { value: id >> 0 });
    }
}

/** Native RangeError stores message unchanged; optional id conversion happens after argument evaluation. */
export class AS3RangeError extends Error {
    declare readonly errorID:number;
    constructor(message?:unknown,id:unknown=0) {
        super();
        Object.defineProperty(this,"message",{
            value:arguments.length===0?"":message,writable:true,configurable:true,
        });
        Object.defineProperty(this,"errorID",{value:as3NativeNumber(id)>>0});
        this.name="RangeError";
    }
}

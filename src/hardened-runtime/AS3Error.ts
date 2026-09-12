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

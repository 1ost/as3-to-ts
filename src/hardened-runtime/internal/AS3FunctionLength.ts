/** Source arity is independent of JavaScript optional-parameter and wrapper lengths. */
const LENGTHS = new WeakMap<Function, number>();

export function defineFunctionLength<T extends Function>(value:T, length:number):T {
    if (typeof value !== "function" || !Number.isSafeInteger(length) || length < 0)
        throw new TypeError("Source function length requires callable identity and a nonnegative integer");
    const prior = LENGTHS.get(value);
    if (prior !== undefined && prior !== length) throw new TypeError("Source function length cannot change");
    LENGTHS.set(value,length);
    return value;
}

export function copyFunctionLength(source:Function, target:Function):void {
    const length = LENGTHS.get(source);
    if (length !== undefined) defineFunctionLength(target,length);
}

export function as3DefineMethodLength(owner:object, name:string, length:number):void {
    const descriptor = Object.getOwnPropertyDescriptor(owner,name);
    if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "function")
        throw new TypeError("Source method length requires an own method descriptor");
    defineFunctionLength(descriptor.value,length);
}

export function as3FunctionLength(value:unknown):number {
    if (value === null || value === undefined) {
        const id = value === null ? 1009 : 1010;
        const error = new TypeError(value === null
            ? "Error #1009: Cannot access a property or method of a null object reference."
            : "Error #1010: A term is undefined and has no properties.");
        Object.defineProperty(error,"errorID",{value:id});
        throw error;
    }
    const length = typeof value === "function" ? LENGTHS.get(value) : undefined;
    if (length === undefined) throw new TypeError("Function.length requires retained source arity metadata");
    return length;
}

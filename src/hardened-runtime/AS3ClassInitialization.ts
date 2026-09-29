import { classInitializationBase } from "./internal/AS3TypeRegistry";

type StaticSlot = { readonly name: string; readonly value: unknown; readonly readonly: boolean };
type Initializer = { readonly proof: unknown; readonly slots: readonly StaticSlot[];
    readonly run: () => void; state: "cold" | "initializing" | "ready" };
const INITIALIZERS = new WeakMap<object, Initializer>();

/** Definition-only registration. Original initializer bodies remain unexecuted. */
export function as3DefineClassInitialization(constructor: object, proof: unknown,
    slots: readonly StaticSlot[], run: () => void): void {
    if (typeof constructor !== "function" || INITIALIZERS.has(constructor) || typeof run !== "function"
        || !Array.isArray(slots) || slots.some(slot => !slot || typeof slot.name !== "string"
            || typeof slot.readonly !== "boolean") || new Set(slots.map(slot => slot.name)).size !== slots.length)
        throw new TypeError("Invalid AS3 class initializer definition");
    INITIALIZERS.set(constructor, {proof, slots:slots.map(slot => Object.freeze({...slot})), run, state:"cold"});
}

/** Source getlex initializes a class once. Its own lexical class value is available during cinit. */
export function as3InitializeClass<T>(constructor: T, lexicalSelf: boolean = false): T {
    const row = (typeof constructor === "function" || typeof constructor === "object") && constructor !== null
        ? INITIALIZERS.get(constructor as object) : undefined;
    if (!row) return constructor;
    const base = classInitializationBase(constructor, row.proof);
    if (row.state === "ready") return constructor;
    if (row.state === "initializing") return lexicalSelf ? constructor : null as T;
    row.state = "initializing";
    try {
        if (base !== null) as3ClassMemberReceiver(as3InitializeClass(base));
        for (const slot of row.slots) Object.defineProperty(constructor, slot.name,
            {value:slot.value, writable:!slot.readonly, enumerable:true, configurable:true});
        row.run();
        row.state = "ready";
        return constructor;
    } catch (error) {
        // AIR retries cinit after a failed getlex; it does not cache the first exception.
        row.state = "cold";
        throw error;
    }
}

/** Writes an original static initializer while its authenticated cinit is active. */
export function as3InitializeStaticField(constructor: object, proof: unknown, name: string, value: unknown): void {
    const row=INITIALIZERS.get(constructor), slot=row?.slots.find(slot => slot.name === name);
    if (!row || row.state !== "initializing" || row.proof !== proof || !slot)
        throw new TypeError("AS3 static initialization is not active for this field");
    classInitializationBase(constructor, proof);
    Object.defineProperty(constructor,name,{value,writable:!slot.readonly,enumerable:true,configurable:true});
}

/** A cyclic external class lookup yields null; member access then raises native #1009. */
export function as3ClassMemberReceiver<T>(value: T): T {
    if (value === null || value === undefined) {
        const id=value === null ? 1009 : 1010;
        const error=new TypeError(`Error #${id}: ${id === 1009 ? "Cannot access a property or method of a null object reference." : "A term is undefined and has no properties."}`);
        Object.defineProperty(error,"errorID",{value:id});throw error;
    }
    return value;
}

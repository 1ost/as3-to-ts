import { as3NativeString } from "./AS3ObjectDispatch";

export function as3Int(value: unknown = 0): number {
    return Number(value) >> 0;
}

export function as3Uint(value: unknown = 0): number {
    return Number(value) >>> 0;
}

export function as3Number(value: unknown = 0): number {
    return Number(value);
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


/** Delay conversion until the shared trace bridge reaches this argument. */
export function as3TraceValue(value:unknown):{toString():string} {
    return {toString:() => as3String(value)};
}

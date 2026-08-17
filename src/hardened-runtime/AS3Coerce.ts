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
    return arguments.length === 0 ? "" : String(value);
}

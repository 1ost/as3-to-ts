/**
 * AVM newobject consumes already-evaluated name/value pairs from the stack.
 * Values evaluate in source order; reverse definition makes the first duplicate
 * name win. defineProperty keeps __proto__ an ordinary own data property.
 */
export function as3ObjectLiteral(entries: readonly (readonly [string, unknown])[]): object {
    const result = {};
    for (let index = entries.length - 1; index >= 0; index--) {
        const entry = entries[index]!;
        Object.defineProperty(result, entry[0], {
            value: entry[1], writable: true, configurable: true, enumerable: true,
        });
    }
    return result;
}

/*
 * Narrow native Array index boundary for the admitted AS3 read-only slice.
 * This intentionally does not emulate dynamic Object or display-list properties.
 */

export const AS3_ARRAY_MAX_INDEX = 0xfffffffe;

export function as3ArrayIndex(value: number): number {
    if (!Number.isInteger(value) || value < 0 || value > AS3_ARRAY_MAX_INDEX) {
        throw new RangeError("AS3 Array index must be an integer from 0 through 4294967294");
    }
    return value;
}

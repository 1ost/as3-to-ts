/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
/** Adapted from Adobe AVMplus core/MathUtils.cpp parseInt (MPL-2.0).
 * https://github.com/adobe/avmplus/blob/master/core/MathUtils.cpp
 * AIR 51 macOS native evidence additionally requires fused digit accumulation.
 */
// AVM kNaN widens the float payload 0x7fffffff to a double.
const nativeNaNView = new DataView(new ArrayBuffer(4));
nativeNaNView.setUint32(0, 0x7fffffff);
const nativeNaN = nativeNaNView.getFloat32(0);

function digit(text: string, index: number): number {
    const c = text.charCodeAt(index);
    return c >= 48 && c <= 57 ? c - 48 : c >= 65 && c <= 90 ? c - 55
        : c >= 97 && c <= 122 ? c - 87 : -1;
}

/** One rounding per digit, including beyond 53 bits; bound BigInt to finite doubles. */
function accumulate(value: number, radix: number, next: number): number {
    if (!Number.isFinite(value)) return value;
    if (value <= (Number.MAX_SAFE_INTEGER - next) / radix) return value * radix + next;
    return Number(BigInt(value) * BigInt(radix) + BigInt(next));
}

export function as3IntegerText(text: string, radix: number): number {
    let index = /^[\x09-\x0d \u2000-\u200b\u2028\u2029\u205f\u3000]*/.exec(text)![0].length;
    const negative = text[index] === "-";
    if (negative || text[index] === "+") index++;
    if (text[index] === "0" && /[xX]/.test(text[index + 1] || "") && (radix === 0 || radix === 16)) {
        index += 2;
        radix = 16;
    } else if (radix === 0) radix = 10;
    if (radix < 2 || radix > 36) return nativeNaN;
    const start = index;
    let value = 0;
    while (index < text.length) {
        const next = digit(text, index);
        if (next < 0 || next >= radix) break;
        value = accumulate(value, radix, next);
        index++;
    }
    if (index === start) return nativeNaN;
    // AVM recalculates power-of-two bases with its original rounding window.
    if (value >= 2 ** 53 && [2, 4, 8, 16, 32].includes(radix)) {
        value = 0;
        const bits = Math.log2(radix);
        let end = start;
        while (text[end] === "0") end++;
        let next = 0, v = 0;
        for (; next * bits <= 52; next++) {
            v = digit(text, end++);
            if (v < 0 || v >= radix) { v = 0; break; }
            value = accumulate(value, radix, v);
            if (end >= text.length) break;
        }
        if (next * bits > 52) {
            let bit53 = 0, bit54 = 0, tail = false, factor = 1;
            switch (radix) {
                case 32:
                    bit53 = v & 4; bit54 = v & 2; tail = (v & 1) !== 0;
                    break;
                case 16:
                    bit53 = v & 1;
                    v = digit(text, end);
                    if (v >= 0 && v < radix) {
                        factor *= radix; bit54 = v & 8; tail = (v & 3) !== 0;
                    } else tail = bit53 !== 0;
                    break;
                case 8:
                case 4:
                    v = digit(text, end);
                    if (v < 0 || v >= radix) v = 0;
                    factor *= radix; bit53 = v & 2; bit54 = v & 1;
                    break;
                case 2:
                    bit53 = v & 1;
                    v = digit(text, end);
                    if (v >= 0 && v < radix) { factor *= radix; bit54 = v & 1; }
                    break;
            }
            while (++end < text.length) {
                v = digit(text, end);
                if (v < 0 || v >= radix) break;
                tail ||= v !== 0;
                factor *= radix;
            }
            if (bit54 && (bit53 || tail)) value += 1;
            value *= factor;
        }
    }
    return negative ? -value : value;
}

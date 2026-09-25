const INVALID_URI_MESSAGE = "Error #1052: Invalid URI passed to encodeURIComponent function.";

function invalidUri(): never {
    const error = new URIError(INVALID_URI_MESSAGE);
    Object.defineProperty(error, "errorID", {value: 1052});
    throw error;
}

function escaped(byte: number): string {
    const digits = "0123456789ABCDEF";
    return "%" + digits[(byte >>> 4) & 15] + digits[byte & 15];
}

function unescaped(code: number): boolean {
    return code >= 65 && code <= 90 || code >= 97 && code <= 122 || code >= 48 && code <= 57
        || code === 45 || code === 95 || code === 46 || code === 33 || code === 126
        || code === 42 || code === 39 || code === 40 || code === 41;
}

/** Exact one-String AVM package-global encodeURIComponent operation. */
export function as3EncodeURIComponent(value: string): string {
    if (typeof value !== "string") throw new TypeError("as3EncodeURIComponent requires one proven String argument");
    let result = "";
    for (let index = 0; index < value.length; index += 1) {
        const first = value.charCodeAt(index);
        let codePoint = first;
        if (first >= 0xd800 && first <= 0xdbff) {
            if (index + 1 >= value.length) invalidUri();
            const second = value.charCodeAt(index + 1);
            if (second < 0xdc00 || second > 0xdfff) invalidUri();
            codePoint = 0x10000 + ((first - 0xd800) << 10) + second - 0xdc00;
            index += 1;
        } else if (first >= 0xdc00 && first <= 0xdfff) {
            invalidUri();
        }
        if (unescaped(codePoint)) {
            result += String.fromCharCode(codePoint);
        } else if (codePoint <= 0x7f) {
            result += escaped(codePoint);
        } else if (codePoint <= 0x7ff) {
            result += escaped(0xc0 | codePoint >>> 6) + escaped(0x80 | codePoint & 0x3f);
        } else if (codePoint <= 0xffff) {
            result += escaped(0xe0 | codePoint >>> 12) + escaped(0x80 | codePoint >>> 6 & 0x3f)
                + escaped(0x80 | codePoint & 0x3f);
        } else {
            result += escaped(0xf0 | codePoint >>> 18) + escaped(0x80 | codePoint >>> 12 & 0x3f)
                + escaped(0x80 | codePoint >>> 6 & 0x3f) + escaped(0x80 | codePoint & 0x3f);
        }
    }
    return result;
}

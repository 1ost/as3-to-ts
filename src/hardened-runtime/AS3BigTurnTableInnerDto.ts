export const BIG_TURN_TABLE_INNER_SCHEMA = "bleach-big-turn-table-inner-config@1" as const;

export interface BigTurnTableInnerCostChip {
    readonly index: number;
    readonly value: number;
}

export interface BigTurnTableInnerEntry {
    readonly index: number;
    readonly getType: number;
    readonly costChip: readonly [BigTurnTableInnerCostChip];
    readonly award: readonly [number];
    readonly des: string;
    readonly flag: readonly [number, number, number, number, number, number];
}

declare const CONFIG_BRAND: unique symbol;
export interface BigTurnTableInnerConfig {
    readonly [CONFIG_BRAND]: "BigTurnTableInnerConfig";
}

const validatedEntries = new WeakMap<object, BigTurnTableInnerEntry>();
const brandedEntries = new WeakSet<object>();

function reject(detail: string): never {
    throw new TypeError(`Big Turntable inner DTO rejected: ${detail}`);
}

function exactDataObject(value: unknown, keys: readonly string[], detail: string): { [key: string]: unknown } {
    if (typeof value !== "object" || value === null || Array.isArray(value)) reject(`${detail} must be a plain object`);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) reject(`${detail} must have a plain prototype`);
    const ownKeys = Reflect.ownKeys(value);
    const stringKeys = ownKeys.filter((key): key is string => typeof key === "string").sort();
    if (stringKeys.length !== ownKeys.length || stringKeys.length !== keys.length
        || stringKeys.some((key, index) => key !== keys[index])) {
        reject(`${detail} has an unsealed key set`);
    }
    const record = value as { [key: string]: unknown };
    for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined || !("value" in descriptor) || descriptor.get !== undefined
            || descriptor.set !== undefined || descriptor.enumerable !== true
            || descriptor.configurable !== true || descriptor.writable !== true) {
            reject(`${detail}.${key} must be one own enumerable data property`);
        }
    }
    return record;
}

function exactArray(value: unknown, length: number, detail: string): readonly unknown[] {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== length) {
        reject(`${detail} must be one plain length-${length} array`);
    }
    const expectedKeys: PropertyKey[] = Array.from({ length }, (_unused, index) => String(index)).concat("length");
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== expectedKeys.length || ownKeys.some((key, index) => key !== expectedKeys[index])) {
        reject(`${detail} must be dense and have no extra properties`);
    }
    for (let index = 0; index < length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !("value" in descriptor) || descriptor.get !== undefined
            || descriptor.set !== undefined || descriptor.enumerable !== true) {
            reject(`${detail}[${index}] must be one own enumerable data property`);
        }
    }
    return value;
}

function signedInt(value: unknown, detail: string): number {
    if (typeof value !== "number" || !Number.isInteger(value)
        || value < -0x80000000 || value > 0x7fffffff || Object.is(value, -0)) {
        reject(`${detail} must be one exact signed 32-bit integer`);
    }
    return value;
}

function data(record: { [key: string]: unknown }, key: string): unknown {
    return Object.getOwnPropertyDescriptor(record, key)!.value;
}

function exactUnicodeScalarString(value: string): string {
    for (let index = 0; index < value.length; index += 1) {
        const unit = value.charCodeAt(index);
        if (unit >= 0xd800 && unit <= 0xdbff) {
            const next = value.charCodeAt(index + 1);
            if (!(next >= 0xdc00 && next <= 0xdfff)) reject("JSON string contains an unpaired surrogate");
            index += 1;
        } else if (unit >= 0xdc00 && unit <= 0xdfff) {
            reject("JSON string contains an unpaired surrogate");
        }
    }
    return value;
}

function auditStrictJson(raw: string): void {
    if (raw.length === 0 || raw.length > 0x10000 || raw.charCodeAt(0) === 0xfeff
        || raw.indexOf("\0") >= 0 || raw.indexOf("\r") >= 0) {
        reject("source JSON has an invalid size, BOM, NUL, or carriage return");
    }
    let cursor = 0;
    let nodes = 0;
    const whitespace = (): void => {
        while (raw[cursor] === " " || raw[cursor] === "\t" || raw[cursor] === "\n") cursor += 1;
    };
    const string = (): string => {
        const start = cursor;
        if (raw[cursor++] !== "\"") reject("JSON object key or string is malformed");
        while (cursor < raw.length) {
            const code = raw.charCodeAt(cursor);
            if (code < 0x20) reject("JSON string contains a control character");
            if (raw[cursor] === "\"") {
                cursor += 1;
                return exactUnicodeScalarString(JSON.parse(raw.slice(start, cursor)) as string);
            }
            if (raw[cursor] === "\\") {
                cursor += 1;
                if (cursor >= raw.length || !'"\\/bfnrtu'.includes(raw[cursor]!)) {
                    reject("JSON string escape is malformed");
                }
                if (raw[cursor] === "u") {
                    if (!/^[0-9a-fA-F]{4}$/.test(raw.slice(cursor + 1, cursor + 5))) {
                        reject("JSON unicode escape is malformed");
                    }
                    cursor += 4;
                }
            }
            cursor += 1;
        }
        reject("JSON string is unterminated");
    };
    const value = (depth: number): void => {
        nodes += 1;
        if (depth > 32 || nodes > 1024) reject("JSON structure exceeds the bounded DTO envelope");
        whitespace();
        const token = raw[cursor];
        if (token === "\"") {
            string();
            return;
        }
        if (token === "[") {
            cursor += 1;
            whitespace();
            if (raw[cursor] === "]") { cursor += 1; return; }
            while (true) {
                value(depth + 1);
                whitespace();
                if (raw[cursor] === "]") { cursor += 1; return; }
                if (raw[cursor++] !== ",") reject("JSON array delimiter is malformed");
            }
        }
        if (token === "{") {
            cursor += 1;
            whitespace();
            if (raw[cursor] === "}") { cursor += 1; return; }
            const keys = new Set<string>();
            while (true) {
                whitespace();
                const key = string();
                if (keys.has(key)) reject(`JSON object key is duplicated: ${key}`);
                keys.add(key);
                whitespace();
                if (raw[cursor++] !== ":") reject("JSON object separator is malformed");
                value(depth + 1);
                whitespace();
                if (raw[cursor] === "}") { cursor += 1; return; }
                if (raw[cursor++] !== ",") reject("JSON object delimiter is malformed");
            }
        }
        const rest = raw.slice(cursor);
        const scalar = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(rest);
        if (scalar === null) reject("JSON scalar is malformed");
        if (scalar[0] !== "true" && scalar[0] !== "false" && scalar[0] !== "null") {
            if (/[.eE]/.test(scalar[0])) reject("JSON numeric leaf must use one exact integer lexeme");
            const exactInteger = BigInt(scalar[0]);
            if (exactInteger < -0x80000000n || exactInteger > 0x7fffffffn) {
                reject("JSON integer lexeme is outside signed 32-bit bounds");
            }
        }
        cursor += scalar[0].length;
    };
    value(0);
    whitespace();
    if (cursor !== raw.length) reject("JSON source has trailing data");
}

function validate(input: unknown): BigTurnTableInnerEntry {
    // Reflection is confined to the fresh graph returned by JSON.parse in the decoder below.
    // No caller-supplied object reaches this function, so host Proxy traps cannot execute here.
    const root = exactArray(input, 1, "root");
    const entry = exactDataObject(root[0], ["award", "costChip", "des", "flag", "getType", "index"], "root[0]");
    const costRoot = exactArray(data(entry, "costChip"), 1, "root[0].costChip");
    const cost = exactDataObject(costRoot[0], ["index", "value"], "root[0].costChip[0]");
    const award = exactArray(data(entry, "award"), 1, "root[0].award");
    const flag = exactArray(data(entry, "flag"), 6, "root[0].flag");
    const description = data(entry, "des");
    if (typeof description !== "string") reject("root[0].des must be one string");
    const flags = Object.freeze(flag.map((item, index) => signedInt(item, `root[0].flag[${index}]`))) as
        readonly [number, number, number, number, number, number];
    const snapshot = Object.freeze({
        index: signedInt(data(entry, "index"), "root[0].index"),
        getType: signedInt(data(entry, "getType"), "root[0].getType"),
        costChip: Object.freeze([Object.freeze({
            index: signedInt(data(cost, "index"), "root[0].costChip[0].index"),
            value: signedInt(data(cost, "value"), "root[0].costChip[0].value"),
        })]) as readonly [BigTurnTableInnerCostChip],
        award: Object.freeze([signedInt(award[0], "root[0].award[0]")]) as readonly [number],
        des: description,
        flag: flags,
    });
    brandedEntries.add(snapshot);
    return snapshot;
}

export function as3DecodeBigTurnTableInnerConfig(raw: string): BigTurnTableInnerConfig {
    if (typeof raw !== "string") reject("source JSON must be one string");
    auditStrictJson(raw);
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (_error) {
        reject("source JSON parser rejected the audited input");
    }
    const snapshot = validate(parsed);
    validatedEntries.set(parsed as object, snapshot);
    return parsed as BigTurnTableInnerConfig;
}

export function as3BigTurnTableInnerEntry(
    input: BigTurnTableInnerConfig,
    index: number,
): BigTurnTableInnerEntry {
    if (index !== 0) reject("only the authenticated root index 0 is admitted");
    if (typeof input !== "object" || input === null) reject("root lacks the private decoder brand");
    const cached = validatedEntries.get(input as object);
    if (cached === undefined || !brandedEntries.has(cached)) reject("root lacks the private decoder brand");
    return cached;
}

import {
    CapabilityAuthorityInput,
    CapabilityMapping,
    CapabilityMappingDocument,
    LoadedCapabilityAuthority,
    NativeTimerFunctionMapping,
    HardenedSemanticError,
} from "./contracts";

export type Sha256Function = (bytes: string) => string;

const SHA256 = /^[0-9a-f]{64}$/;
const QNAME = /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)+$/;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const TARGET_MODULE_PREFIX = "src/layaAir/";
const PUBLIC_MODULE_SEGMENT = /^[A-Za-z$][A-Za-z0-9_$]*$/;
const LOADED_AUTHORITIES = new WeakSet<object>();
const INTRINSIC_TYPES = Object.freeze([Object.freeze({
    sourceQName: "flash.utils.Dictionary",
    sourceRoles: Object.freeze(["constructor", "import", "instance-member", "wildcard-resolution"]),
    targetModule: "@bleach/as3-runtime/AS3Dictionary",
    targetExport: "AS3Dictionary",
    targetKind: "class" as "class",
    targetSignature: "new (weakKeys?: boolean): AS3Dictionary",
}), Object.freeze({
    sourceQName: "flash.utils.ByteArray",
    sourceRoles: Object.freeze(["base-type", "constructor", "import", "instance-member", "wildcard-resolution"]),
    targetModule: "@bleach/as3-runtime/AS3ByteArray",
    targetExport: "AS3ByteArray",
    targetKind: "class" as "class",
    targetSignature: "new (): AS3ByteArray",
}), Object.freeze({
    sourceQName: "flash.utils.Endian",
    sourceRoles: Object.freeze(["import", "static-member", "wildcard-resolution"]),
    targetModule: "@bleach/as3-runtime/AS3ByteArray",
    targetExport: "AS3Endian",
    targetKind: "class" as "class",
    targetSignature: "static endian constants",
})]);

const NATIVE_TIMER_FUNCTIONS: readonly Readonly<NativeTimerFunctionMapping>[] = Object.freeze([
    Object.freeze({
        sourceQName: "flash.utils.clearInterval" as "flash.utils.clearInterval",
        sourceRoles: Object.freeze(["import", "package-function", "wildcard-resolution"]) as unknown as string[],
        sourceSignature: "public function clearInterval(id:uint) : void",
        minArgs: 1, maxArgs: 1, parameterTypes: Object.freeze(["uint"]) as unknown as string[], restType: null,
        returnType: "void", targetModule: "@bleach/as3-runtime/AS3Timer",
        targetExport: "clearInterval" as "clearInterval", targetSignature: "(id: number) => void",
    }),
    Object.freeze({
        sourceQName: "flash.utils.clearTimeout" as "flash.utils.clearTimeout",
        sourceRoles: Object.freeze(["import", "package-function", "wildcard-resolution"]) as unknown as string[],
        sourceSignature: "public function clearTimeout(id:uint) : void",
        minArgs: 1, maxArgs: 1, parameterTypes: Object.freeze(["uint"]) as unknown as string[], restType: null,
        returnType: "void", targetModule: "@bleach/as3-runtime/AS3Timer",
        targetExport: "clearTimeout" as "clearTimeout", targetSignature: "(id: number) => void",
    }),
    Object.freeze({
        sourceQName: "flash.utils.getTimer" as "flash.utils.getTimer",
        sourceRoles: Object.freeze(["import", "package-function"]) as unknown as string[],
        sourceSignature: "public native function getTimer() : int;",
        minArgs: 0, maxArgs: 0, parameterTypes: Object.freeze([]) as unknown as string[], restType: null,
        returnType: "int", targetModule: "@bleach/as3-runtime/AS3Timer",
        targetExport: "getTimer" as "getTimer", targetSignature: "() => number",
    }),
    Object.freeze({
        sourceQName: "flash.utils.setInterval" as "flash.utils.setInterval",
        sourceRoles: Object.freeze(["import", "package-function", "wildcard-resolution"]) as unknown as string[],
        sourceSignature: "public function setInterval(closure:Function, delay:Number, ... arguments) : uint",
        minArgs: 2, maxArgs: null, parameterTypes: Object.freeze(["Function", "Number"]) as unknown as string[], restType: "*",
        returnType: "uint", targetModule: "@bleach/as3-runtime/AS3Timer",
        targetExport: "setInterval" as "setInterval",
        targetSignature: "(closure: Function, delay: number, ...args: unknown[]) => number",
    }),
    Object.freeze({
        sourceQName: "flash.utils.setTimeout" as "flash.utils.setTimeout",
        sourceRoles: Object.freeze(["import", "package-function", "wildcard-resolution"]) as unknown as string[],
        sourceSignature: "public function setTimeout(closure:Function, delay:Number, ... arguments) : uint",
        minArgs: 2, maxArgs: null, parameterTypes: Object.freeze(["Function", "Number"]) as unknown as string[], restType: "*",
        returnType: "uint", targetModule: "@bleach/as3-runtime/AS3Timer",
        targetExport: "setTimeout" as "setTimeout",
        targetSignature: "(closure: Function, delay: number, ...args: unknown[]) => number",
    }),
]);

interface IntrinsicMemberDefinition {
    sourceQName: string;
    name: string;
    access: "call" | "read" | "write";
    minArgs: number;
    maxArgs: number;
    parameterTypes: string[];
    returnType: string;
    sourceSignature: string;
}

const INTRINSIC_MEMBERS: readonly IntrinsicMemberDefinition[] = [
    { sourceQName: "flash.utils.ByteArray", name: "ByteArray", access: "call", minArgs: 0, maxArgs: 0,
        parameterTypes: [], returnType: "ByteArray", sourceSignature: "public function ByteArray()" },
    { sourceQName: "flash.utils.Endian", name: "BIG_ENDIAN", access: "read", minArgs: 0, maxArgs: 0,
        parameterTypes: [], returnType: "String", sourceSignature: "public static const BIG_ENDIAN:String = \"bigEndian\";" },
    { sourceQName: "flash.utils.Endian", name: "LITTLE_ENDIAN", access: "read", minArgs: 0, maxArgs: 0,
        parameterTypes: [], returnType: "String", sourceSignature: "public static const LITTLE_ENDIAN:String = \"littleEndian\";" },
    { sourceQName: "flash.utils.ByteArray", name: "bytesAvailable", access: "read", minArgs: 0, maxArgs: 0,
        parameterTypes: [], returnType: "uint", sourceSignature: "public native function get bytesAvailable() : uint;" },
    { sourceQName: "flash.utils.ByteArray", name: "clear", access: "call", minArgs: 0, maxArgs: 0,
        parameterTypes: [], returnType: "void", sourceSignature: "public native function clear() : void;" },
    { sourceQName: "flash.utils.ByteArray", name: "endian", access: "write", minArgs: 1, maxArgs: 1,
        parameterTypes: ["String"], returnType: "void", sourceSignature: "public native function set endian(param1:String) : void;" },
    { sourceQName: "flash.utils.ByteArray", name: "length", access: "read", minArgs: 0, maxArgs: 0,
        parameterTypes: [], returnType: "uint", sourceSignature: "public native function get length() : uint;" },
    { sourceQName: "flash.utils.ByteArray", name: "length", access: "write", minArgs: 1, maxArgs: 1,
        parameterTypes: ["uint"], returnType: "void", sourceSignature: "public native function set length(param1:uint) : void;" },
    { sourceQName: "flash.utils.ByteArray", name: "position", access: "read", minArgs: 0, maxArgs: 0,
        parameterTypes: [], returnType: "uint", sourceSignature: "public native function get position() : uint;" },
    { sourceQName: "flash.utils.ByteArray", name: "position", access: "write", minArgs: 1, maxArgs: 1,
        parameterTypes: ["uint"], returnType: "void", sourceSignature: "public native function set position(param1:uint) : void;" },
    { sourceQName: "flash.utils.ByteArray", name: "readBoolean", access: "call", minArgs: 0, maxArgs: 0,
        parameterTypes: [], returnType: "Boolean", sourceSignature: "public native function readBoolean() : Boolean;" },
    { sourceQName: "flash.utils.ByteArray", name: "readByte", access: "call", minArgs: 0, maxArgs: 0,
        parameterTypes: [], returnType: "int", sourceSignature: "public native function readByte() : int;" },
    { sourceQName: "flash.utils.ByteArray", name: "readBytes", access: "call", minArgs: 1, maxArgs: 3,
        parameterTypes: ["ByteArray", "uint", "uint"], returnType: "void",
        sourceSignature: "public native function readBytes(param1:ByteArray, param2:uint = 0, param3:uint = 0) : void;" },
    { sourceQName: "flash.utils.ByteArray", name: "readDouble", access: "call", minArgs: 0, maxArgs: 0,
        parameterTypes: [], returnType: "Number", sourceSignature: "public native function readDouble() : Number;" },
    { sourceQName: "flash.utils.ByteArray", name: "readFloat", access: "call", minArgs: 0, maxArgs: 0,
        parameterTypes: [], returnType: "Number", sourceSignature: "public native function readFloat() : Number;" },
    { sourceQName: "flash.utils.ByteArray", name: "readInt", access: "call", minArgs: 0, maxArgs: 0,
        parameterTypes: [], returnType: "int", sourceSignature: "public native function readInt() : int;" },
    { sourceQName: "flash.utils.ByteArray", name: "readShort", access: "call", minArgs: 0, maxArgs: 0,
        parameterTypes: [], returnType: "int", sourceSignature: "public native function readShort() : int;" },
    { sourceQName: "flash.utils.ByteArray", name: "readUTF", access: "call", minArgs: 0, maxArgs: 0,
        parameterTypes: [], returnType: "String", sourceSignature: "public native function readUTF() : String;" },
    { sourceQName: "flash.utils.ByteArray", name: "readUTFBytes", access: "call", minArgs: 1, maxArgs: 1,
        parameterTypes: ["uint"], returnType: "String", sourceSignature: "public native function readUTFBytes(param1:uint) : String;" },
    { sourceQName: "flash.utils.ByteArray", name: "readUnsignedByte", access: "call", minArgs: 0, maxArgs: 0,
        parameterTypes: [], returnType: "uint", sourceSignature: "public native function readUnsignedByte() : uint;" },
    { sourceQName: "flash.utils.ByteArray", name: "readUnsignedInt", access: "call", minArgs: 0, maxArgs: 0,
        parameterTypes: [], returnType: "uint", sourceSignature: "public native function readUnsignedInt() : uint;" },
    { sourceQName: "flash.utils.ByteArray", name: "readUnsignedShort", access: "call", minArgs: 0, maxArgs: 0,
        parameterTypes: [], returnType: "uint", sourceSignature: "public native function readUnsignedShort() : uint;" },
    { sourceQName: "flash.utils.ByteArray", name: "writeBoolean", access: "call", minArgs: 1, maxArgs: 1,
        parameterTypes: ["Boolean"], returnType: "void", sourceSignature: "public native function writeBoolean(param1:Boolean) : void;" },
    { sourceQName: "flash.utils.ByteArray", name: "writeByte", access: "call", minArgs: 1, maxArgs: 1,
        parameterTypes: ["int"], returnType: "void", sourceSignature: "public native function writeByte(param1:int) : void;" },
    { sourceQName: "flash.utils.ByteArray", name: "writeBytes", access: "call", minArgs: 1, maxArgs: 3,
        parameterTypes: ["ByteArray", "uint", "uint"], returnType: "void",
        sourceSignature: "public native function writeBytes(param1:ByteArray, param2:uint = 0, param3:uint = 0) : void;" },
    { sourceQName: "flash.utils.ByteArray", name: "writeDouble", access: "call", minArgs: 1, maxArgs: 1,
        parameterTypes: ["Number"], returnType: "void", sourceSignature: "public native function writeDouble(param1:Number) : void;" },
    { sourceQName: "flash.utils.ByteArray", name: "writeInt", access: "call", minArgs: 1, maxArgs: 1,
        parameterTypes: ["int"], returnType: "void", sourceSignature: "public native function writeInt(param1:int) : void;" },
    { sourceQName: "flash.utils.ByteArray", name: "writeMultiByte", access: "call", minArgs: 2, maxArgs: 2,
        parameterTypes: ["String", "String"], returnType: "void",
        sourceSignature: "public native function writeMultiByte(param1:String, param2:String) : void;" },
    { sourceQName: "flash.utils.ByteArray", name: "writeShort", access: "call", minArgs: 1, maxArgs: 1,
        parameterTypes: ["int"], returnType: "void", sourceSignature: "public native function writeShort(param1:int) : void;" },
    { sourceQName: "flash.utils.ByteArray", name: "writeUTF", access: "call", minArgs: 1, maxArgs: 1,
        parameterTypes: ["String"], returnType: "void", sourceSignature: "public native function writeUTF(param1:String) : void;" },
    { sourceQName: "flash.utils.ByteArray", name: "writeUTFBytes", access: "call", minArgs: 1, maxArgs: 1,
        parameterTypes: ["String"], returnType: "void", sourceSignature: "public native function writeUTFBytes(param1:String) : void;" },
    { sourceQName: "flash.utils.ByteArray", name: "writeUnsignedInt", access: "call", minArgs: 1, maxArgs: 1,
        parameterTypes: ["uint"], returnType: "void", sourceSignature: "public native function writeUnsignedInt(param1:uint) : void;" },
];

function isObject(value: unknown): value is { [key: string]: unknown } {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: { [key: string]: unknown }, keys: string[]): boolean {
    const actual = Object.keys(value).sort();
    const expected = keys.slice().sort();
    return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isPublicTargetModule(value: string): boolean {
    if (!value.startsWith(TARGET_MODULE_PREFIX) || !value.endsWith(".ts")) {
        return false;
    }
    const relative = value.slice(TARGET_MODULE_PREFIX.length, -".ts".length);
    const segments = relative.split("/");
    return segments.length > 0 && segments.every((segment) =>
        PUBLIC_MODULE_SEGMENT.test(segment) && !segment.startsWith("_"));
}

function canonicalValue(value: unknown): string {
    if (value === null || typeof value === "boolean" || typeof value === "string") {
        return JSON.stringify(value);
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return "[" + value.map(canonicalValue).join(",") + "]";
    }
    if (isObject(value)) {
        return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonicalValue(value[key])).join(",") + "}";
    }
    throw new HardenedSemanticError("HARDENED_CAPABILITY_JSON_VALUE", "capability mapping contains a non-canonical JSON value");
}

export function canonicalMappingJson(value: CapabilityMappingDocument): string {
    return canonicalValue(value) + "\n";
}

function parseJson(bytes: string, code: string): unknown {
    try {
        return JSON.parse(bytes);
    } catch (_error) {
        throw new HardenedSemanticError(code, "capability authority is not valid JSON");
    }
}

function requireHash(bytes: string, expected: string, sha256: Sha256Function, code: string): void {
    if (!SHA256.test(expected) || sha256(bytes) !== expected) {
        throw new HardenedSemanticError(code, "capability authority bytes do not match the required SHA-256");
    }
}

interface NativeTimerAuthority {
    module: string;
    sourcePath: "src/hardened-runtime/AS3Timer.ts";
    sourceSha256: string;
    exports: Array<{ name: string; signature: string }>;
}

function parseNativeTimerAuthority(raw: unknown, runtimePackage: string): NativeTimerAuthority {
    if (!isObject(raw) || !exactKeys(raw, ["exports", "module", "schema", "sourcePath", "sourceSha256"])
        || (raw.schema !== "bleach-native-timer-authority@1" && raw.schema !== "as3-native-timer-authority@1")
        || raw.module !== `${runtimePackage}/AS3Timer`
        || raw.sourcePath !== "src/hardened-runtime/AS3Timer.ts"
        || typeof raw.sourceSha256 !== "string" || !SHA256.test(raw.sourceSha256)
        || !Array.isArray(raw.exports)) {
        throw new HardenedSemanticError("HARDENED_NATIVE_TIMER_AUTHORITY",
            "native timer authority has the wrong closed schema");
    }
    const exports = raw.exports.map((value: unknown) => {
        if (!isObject(value) || !exactKeys(value, ["name", "signature"])
            || !IDENTIFIER.test(String(value.name)) || String(value.name).startsWith("_")
            || typeof value.signature !== "string" || value.signature.length === 0) {
            throw new HardenedSemanticError("HARDENED_NATIVE_TIMER_EXPORT",
                "native timer authority export is invalid");
        }
        return { name: String(value.name), signature: String(value.signature) };
    });
    if (exports.some((value, index) => index > 0 && exports[index - 1]!.name >= value.name)) {
        throw new HardenedSemanticError("HARDENED_NATIVE_TIMER_EXPORT",
            "native timer authority exports must be unique and sorted");
    }
    return { module: raw.module, sourcePath: raw.sourcePath, sourceSha256: raw.sourceSha256, exports };
}

function parseMapping(raw: unknown): CapabilityMappingDocument {
    if (!isObject(raw) || !exactKeys(raw, ["mappings", "schema"])
        || raw.schema !== "as3-source-to-laya-capability-map@1" || !Array.isArray(raw.mappings)) {
        throw new HardenedSemanticError("HARDENED_CAPABILITY_MAPPING_SCHEMA", "capability mapping has the wrong closed schema");
    }
    const mappings = raw.mappings.map((value: unknown): CapabilityMapping => {
        const keys = ["sourceMember", "sourceQName", "sourceRoles", "targetCapabilityId", "targetExport",
            "targetKind", "targetMember", "targetModule", "targetSignature"];
        if (!isObject(value)) {
            throw new HardenedSemanticError("HARDENED_CAPABILITY_MAPPING", "capability mapping entry is invalid");
        }
        const sourceRoles = value.sourceRoles;
        if (!exactKeys(value, keys) || (!QNAME.test(String(value.sourceQName)) && value.sourceQName !== "trace")
            || !Array.isArray(sourceRoles) || sourceRoles.length === 0
            || sourceRoles.some((role: unknown) => typeof role !== "string" || role.length === 0)
            || sourceRoles.slice().sort().some((role: unknown, index: number) => role !== sourceRoles[index])
            || new Set(sourceRoles).size !== sourceRoles.length
            || typeof value.targetCapabilityId !== "string" || value.targetCapabilityId.length === 0
            || !isPublicTargetModule(String(value.targetModule)) || !IDENTIFIER.test(String(value.targetExport))
            || String(value.targetExport).startsWith("_") || typeof value.targetKind !== "string"
            || typeof value.targetSignature !== "string" || value.targetSignature.length === 0) {
            throw new HardenedSemanticError("HARDENED_CAPABILITY_MAPPING", "capability mapping entry is invalid");
        }
        let sourceMember = null;
        if (value.sourceMember !== null) {
            if (!isObject(value.sourceMember) || !exactKeys(value.sourceMember,
                ["access", "maxArgs", "minArgs", "name", "signature"])
                || ["call", "read", "write"].indexOf(String(value.sourceMember.access)) < 0
                || !IDENTIFIER.test(String(value.sourceMember.name)) || typeof value.sourceMember.signature !== "string"
                || value.sourceMember.signature.length === 0 || !Number.isInteger(value.sourceMember.minArgs)
                || !Number.isInteger(value.sourceMember.maxArgs) || Number(value.sourceMember.minArgs) < 0
                || Number(value.sourceMember.maxArgs) < Number(value.sourceMember.minArgs)) {
                throw new HardenedSemanticError("HARDENED_SOURCE_MEMBER_MAPPING", "source member mapping is invalid");
            }
            sourceMember = {
                access: value.sourceMember.access as "call" | "read" | "write",
                minArgs: Number(value.sourceMember.minArgs),
                maxArgs: Number(value.sourceMember.maxArgs),
                name: String(value.sourceMember.name),
                signature: String(value.sourceMember.signature),
            };
        }
        let targetMember = null;
        if (value.targetMember !== null) {
            if (!isObject(value.targetMember) || !exactKeys(value.targetMember, ["kind", "name", "scope", "signature"])
                || !IDENTIFIER.test(String(value.targetMember.name)) || String(value.targetMember.name).startsWith("_")
                || typeof value.targetMember.kind !== "string" || value.targetMember.kind.length === 0
                || ["instance", "static"].indexOf(String(value.targetMember.scope)) < 0
                || typeof value.targetMember.signature !== "string" || value.targetMember.signature.length === 0) {
                throw new HardenedSemanticError("HARDENED_TARGET_MEMBER_MAPPING", "target member mapping is invalid or internal");
            }
            targetMember = {
                name: String(value.targetMember.name),
                kind: String(value.targetMember.kind),
                scope: value.targetMember.scope as "instance" | "static",
                signature: String(value.targetMember.signature),
            };
        }
        if ((sourceMember === null) !== (targetMember === null)) {
            throw new HardenedSemanticError("HARDENED_CAPABILITY_MEMBER_PAIR", "source and target member mappings must be paired");
        }
        const textAutoSizeBridge = value.sourceQName === "flash.text.TextField"
            && value.targetModule === "src/layaAir/flash/text/TextField.ts" && value.targetExport === "TextField"
            && sourceMember?.name === "autoSize" && ["read", "write"].includes(sourceMember.access)
            && targetMember?.name === "flashAutoSize" && targetMember.scope === "instance"
            && targetMember.signature === "string";
        if (sourceMember !== null && targetMember !== null && sourceMember.name !== targetMember.name && !textAutoSizeBridge) {
            throw new HardenedSemanticError("HARDENED_CAPABILITY_MEMBER_NAME", "source-visible Flash member name must be preserved by the target bridge");
        }
        const constructorRole = sourceMember !== null && sourceRoles.indexOf("constructor") >= 0;
        const constructorTarget = targetMember !== null && targetMember.kind === "constructor";
        if (constructorRole !== constructorTarget || (constructorRole && (sourceMember === null
            || sourceMember.access !== "call" || sourceMember.name !== value.targetExport
            || targetMember!.scope !== "static"))) {
            throw new HardenedSemanticError("HARDENED_CAPABILITY_CONSTRUCTOR_PAIR",
                "constructor mappings must pair the exact source class call with a static target constructor");
        }
        if (constructorTarget) {
            const match = /^new \((.*)\): [A-Za-z_$][A-Za-z0-9_$]*$/.exec(targetMember!.signature);
            if (!match) {
                throw new HardenedSemanticError("HARDENED_TARGET_CONSTRUCTOR_SIGNATURE", "target constructor signature is not canonical");
            }
            const body = match[1]!.trim();
            const parameters = body === "" ? [] : body.split(/,\s*/);
            const optional = parameters.findIndex((parameter) => /^[A-Za-z_$][A-Za-z0-9_$]*\?\s*:/.test(parameter));
            const targetMin = optional < 0 ? parameters.length : optional;
            if (parameters.some((parameter, index) => parameter.length === 0 || parameter.startsWith("...")
                || (index >= targetMin) !== /\?\s*:/.test(parameter))
                || sourceMember!.minArgs !== targetMin || sourceMember!.maxArgs !== parameters.length) {
                throw new HardenedSemanticError("HARDENED_TARGET_CONSTRUCTOR_ARITY",
                    "source and target constructor arities are not exact");
            }
        }
        return {
            sourceQName: String(value.sourceQName),
            sourceRoles: sourceRoles.slice() as string[],
            sourceMember,
            targetCapabilityId: String(value.targetCapabilityId),
            targetModule: String(value.targetModule),
            targetExport: String(value.targetExport),
            targetKind: String(value.targetKind),
            targetSignature: String(value.targetSignature),
            targetMember,
        };
    });
    return { schema: "as3-source-to-laya-capability-map@1", mappings };
}

function splitSignatureParameters(text: string): string[] | null {
    if (text.trim() === "") return [];
    const result: string[] = [];
    let start = 0;
    let depth = 0;
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index]!;
        if ("([{<".indexOf(char) >= 0) depth += 1;
        else if (")]>}".indexOf(char) >= 0) depth -= 1;
        else if (char === "," && depth === 0) {
            result.push(text.slice(start, index).trim());
            start = index + 1;
        }
        if (depth < 0) return null;
    }
    if (depth !== 0) return null;
    result.push(text.slice(start).trim());
    return result;
}

function canonicalSourceType(type: string, bitmapNumeric = false): string {
    const local = type.split(".").pop()!;
    const primitives: { [name: string]: string } = { Number: "number", Boolean: "boolean", String: "string",
        ...(bitmapNumeric ? { int: "number", uint: "number" } : {}) };
    return primitives[local] || local;
}

interface TargetTypeDescriptor {
    type: string;
    nullable: boolean;
}

function targetTypeDescriptor(type: string): TargetTypeDescriptor | null {
    const parts = type.split("|").map(item => item.trim());
    const withoutNullable = parts.filter(item => item !== "null");
    return withoutNullable.length === 1 && !parts.some(item => item === "")
        ? { type: withoutNullable[0]!.split(".").pop()!, nullable: parts.includes("null") }
        : null;
}

const NON_NULLABLE_SOURCE_TYPES = new Set(["number", "boolean", "int", "uint", "void"]);
const BITMAP_QNAMES = new Set(["flash.display.Bitmap", "flash.display.BitmapData", "flash.display.BitmapDataChannel"]);
const BITMAP_SOURCE_QNAMES = new Set([...BITMAP_QNAMES, "flash.display.PixelSnapping"]);
const TEXT_FILTER_QNAMES = new Set(["flash.text.TextField", "flash.text.TextFormat", "flash.filters.BitmapFilter",
    "flash.filters.BlurFilter", "flash.filters.ColorMatrixFilter", "flash.filters.DropShadowFilter", "flash.filters.GlowFilter"]);
const TEXT_CONSTANT_VALUES: { [qname: string]: { [name: string]: string } } = Object.freeze({
    "flash.text.AntiAliasType": Object.freeze({ ADVANCED: "advanced" }),
    "flash.text.TextFieldAutoSize": Object.freeze({ CENTER: "center", LEFT: "left", NONE: "none" }),
    "flash.text.TextFieldType": Object.freeze({ DYNAMIC: "dynamic", INPUT: "input" }),
    "flash.text.TextFormatAlign": Object.freeze({ CENTER: "center", LEFT: "left" }),
});
const TEXT_CONSTANT_QNAMES = new Set(Object.keys(TEXT_CONSTANT_VALUES));
const STRICT_SOURCE_QNAMES = new Set([...BITMAP_SOURCE_QNAMES, ...TEXT_FILTER_QNAMES, ...TEXT_CONSTANT_QNAMES]);
const BITMAP_ALLOWED_MEMBERS: { [qname: string]: Set<string> } = Object.freeze({
    "flash.display.Bitmap": new Set(["bitmapData", "smoothing"]),
    "flash.display.BitmapData": new Set(["BitmapData", "clone", "copyChannel", "copyPixels", "dispose", "fillRect",
        "getColorBoundsRect", "getPixel", "getPixel32", "height", "lock", "rect", "threshold", "unlock", "width"]),
    "flash.display.BitmapDataChannel": new Set(["ALPHA", "RED"]),
});
const BITMAP_CHANNEL_VALUES: { [name: string]: number } = Object.freeze({ ALPHA: 8, RED: 1 });
const TEXT_FILTER_ALLOWED_MEMBERS: { [qname: string]: Set<string> } = Object.freeze({
    "flash.text.TextField": new Set(["TextField", "addEventListener", "appendText", "getCharBoundaries",
        "getCharIndexAtPoint", "getLineLength", "getLineOffset", "getTextFormat", "removeEventListener", "replaceText",
        "setSelection", "setTextFormat"]),
    "flash.filters.BlurFilter": new Set(["BlurFilter"]),
    "flash.filters.DropShadowFilter": new Set(["DropShadowFilter"]),
    "flash.filters.GlowFilter": new Set(["GlowFilter"]),
    "flash.text.TextFormat": new Set(["TextFormat"]),
});
const TEXT_FIELD_PROPERTIES = new Set(["defaultTextFormat", "selectable", "embedFonts", "antiAliasType", "autoSize",
    "wordWrap", "text", "width", "height"]);
const EXACT_TEXT_FIELD_MEMBERS = new Set(["appendText", "getCharBoundaries", "getCharIndexAtPoint", "getLineLength",
    "getLineOffset", "getTextFormat", "replaceText", "setTextFormat"]);

function exactCallMember(qname: string, name: string): boolean {
    return BITMAP_QNAMES.has(qname) || (qname === "flash.text.TextField" && EXACT_TEXT_FIELD_MEMBERS.has(name))
        || ["flash.filters.BlurFilter", "flash.filters.DropShadowFilter", "flash.filters.GlowFilter"].indexOf(qname) >= 0;
}

function exactSourceTargetType(sourceType: string, targetType: TargetTypeDescriptor | null): boolean {
    return targetType !== null && sourceType === targetType.type
        && (!targetType.nullable || !NON_NULLABLE_SOURCE_TYPES.has(sourceType));
}

function sourceCallableTypes(signature: string, bitmapNumeric = false): { parameters: string[]; returnType: string | null } | null {
    const callable = /^public (?:native )?function (?:[A-Za-z_$][A-Za-z0-9_$]*|(?:get|set) [A-Za-z_$][A-Za-z0-9_$]*)\((.*)\)\s*:\s*([^;\s]+)\s*;?$/.exec(signature);
    const constructor = /^public function [A-Za-z_$][A-Za-z0-9_$]*\((.*)\)$/.exec(signature);
    const match = callable || constructor;
    if (!match) return null;
    const parts = splitSignatureParameters(match[1]!);
    if (parts === null) return null;
    const parameters = parts.map(part => {
        const parameter = /^(?:\.\.\.)?[A-Za-z_$][A-Za-z0-9_$]*\s*:\s*([^=\s]+)(?:\s*=.*)?$/.exec(part);
        return parameter ? canonicalSourceType(parameter[1]!, bitmapNumeric) : "";
    });
    if (parameters.some(type => type === "")) return null;
    return { parameters, returnType: callable ? canonicalSourceType(callable[2]!, bitmapNumeric) : null };
}

function targetCallableTypes(signature: string): { parameters: TargetTypeDescriptor[]; returnType: TargetTypeDescriptor } | null {
    const callable = /^\((.*)\) => (.+)$/.exec(signature);
    const constructor = /^new \((.*)\): ([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(signature);
    const match = callable || constructor;
    if (!match) return null;
    const parts = splitSignatureParameters(match[1]!);
    if (parts === null) return null;
    const parameters = parts.map(part => {
        const parameter = /^[A-Za-z_$][A-Za-z0-9_$]*\?*\s*:\s*(.+)$/.exec(part);
        return parameter ? targetTypeDescriptor(parameter[1]!) : null;
    });
    const returnType = targetTypeDescriptor(match[2]!);
    if (parameters.some(type => type === null) || returnType === null) return null;
    return { parameters: parameters as TargetTypeDescriptor[], returnType };
}

function exactCallableTypes(sourceSignature: string, targetSignature: string, constructor: boolean,
    bitmapNumeric = false): boolean {
    const source = sourceCallableTypes(sourceSignature, bitmapNumeric);
    const target = targetCallableTypes(targetSignature);
    return source !== null && target !== null
        && (constructor || (source.returnType !== null && exactSourceTargetType(source.returnType, target.returnType)))
        && source.parameters.length === target.parameters.length
        && source.parameters.every((type, index) => exactSourceTargetType(type, target.parameters[index]!));
}

function mappedPropertyType(signature: string, access: "call" | "read" | "write", bitmapNumeric = false): string | null {
    if (access === "call") return null;
    const variable = /^public (?:static )?(?:const|var) [A-Za-z_$][A-Za-z0-9_$]*:([^;\s]+)(?:\s*=\s*[^;]+)?;$/.exec(signature);
    if (variable) return canonicalSourceType(variable[1]!, bitmapNumeric);
    const callable = sourceCallableTypes(signature, bitmapNumeric);
    if (callable === null) return null;
    return access === "write" ? callable.parameters[0] || null : callable.returnType;
}

function assertMappedMemberCompatibility(mapping: CapabilityMapping): void {
    if (mapping.sourceMember === null || mapping.targetMember === null) return;
    const constructorRole = mapping.sourceRoles.length === 1 && mapping.sourceRoles[0] === "constructor";
    const admittedKinds = constructorRole ? ["constructor"] : mapping.sourceMember.access === "call" ? ["method"]
        : mapping.sourceMember.access === "read" ? ["get", "get+set", "property"]
            : ["get+set", "property", "set"];
    const staticRole = constructorRole || (mapping.sourceRoles.length === 1
        && ["static-member", "event-constant"].indexOf(mapping.sourceRoles[0]!) >= 0);
    if (mapping.sourceRoles.length !== 1 || admittedKinds.indexOf(mapping.targetMember.kind) < 0
        || mapping.targetMember.scope !== (staticRole ? "static" : "instance")) {
        throw new HardenedSemanticError("HARDENED_CAPABILITY_MEMBER_BEHAVIOR",
            "source member context and access must preserve exact target kind and scope");
    }
    const bitmap = BITMAP_QNAMES.has(mapping.sourceQName);
    const allowedBitmapMembers = BITMAP_ALLOWED_MEMBERS[mapping.sourceQName];
    if (mapping.sourceQName === "flash.display.PixelSnapping" || (bitmap
        && (!allowedBitmapMembers || !allowedBitmapMembers.has(mapping.sourceMember.name)))) {
        throw new HardenedSemanticError("HARDENED_CAPABILITY_MEMBER_BEHAVIOR",
            "bitmap member is outside the exact CPU behavioral allowlist");
    }
    if (TEXT_FILTER_QNAMES.has(mapping.sourceQName)) {
        const allowed = TEXT_FILTER_ALLOWED_MEMBERS[mapping.sourceQName];
        const textProperty = mapping.sourceQName === "flash.text.TextField" && mapping.sourceMember.access !== "call"
            && TEXT_FIELD_PROPERTIES.has(mapping.sourceMember.name) && mapping.sourceRoles[0] === "instance-member";
        if (!textProperty && (!allowed || !allowed.has(mapping.sourceMember.name) || mapping.sourceMember.access !== "call"
            || (mapping.sourceQName === "flash.text.TextField" ? mapping.sourceMember.name === "TextField"
                ? mapping.sourceRoles[0] !== "constructor" : mapping.sourceRoles[0] !== "instance-member"
                : mapping.sourceRoles[0] !== "constructor" || mapping.sourceMember.name !== mapping.targetExport))) {
            throw new HardenedSemanticError("HARDENED_CAPABILITY_MEMBER_BEHAVIOR",
                "text/filter member is outside the exact behavioral allowlist");
        }
    }
    if (TEXT_CONSTANT_QNAMES.has(mapping.sourceQName)) {
        const expected = TEXT_CONSTANT_VALUES[mapping.sourceQName]?.[mapping.sourceMember.name];
        const source = /^public static const ([A-Za-z_$][A-Za-z0-9_$]*):String\s*=\s*"([^"]*)";$/.exec(
            mapping.sourceMember.signature);
        if (mapping.sourceMember.access !== "read" || mapping.sourceRoles[0] !== "static-member"
            || mapping.targetMember.scope !== "static" || mapping.targetMember.kind !== "property"
            || expected === undefined || source === null || source[1] !== mapping.sourceMember.name
            || source[2] !== expected || mapping.targetMember.signature !== JSON.stringify(expected)) {
            throw new HardenedSemanticError("HARDENED_CAPABILITY_MEMBER_SIGNATURE",
                "Flash text constants require exact source and target literal identity");
        }
    }
    if (mapping.sourceMember.name === mapping.targetExport) {
        if (mapping.sourceRoles.indexOf("constructor") < 0 || mapping.sourceMember.access !== "call"
            || mapping.targetMember.kind !== "constructor" || mapping.targetMember.scope !== "static") {
            throw new HardenedSemanticError("HARDENED_CAPABILITY_MEMBER_BEHAVIOR",
                "bitmap source constructor identity must remain a target constructor");
        }
    }
    if (mapping.sourceMember.name === "getBounds" || mapping.sourceMember.name === "getRect"
        || mapping.sourceMember.name === "scrollRect") {
        throw new HardenedSemanticError("HARDENED_CAPABILITY_MEMBER_BEHAVIOR",
            "Flash member is an explicit behavioral hold and cannot be mapped to an inherited native surface");
    }
    const exactGeometry = mapping.sourceQName === "flash.geom.Point" || mapping.sourceQName === "flash.geom.Rectangle";
    if (bitmap && mapping.sourceQName === "flash.display.BitmapDataChannel") {
        const expected = BITMAP_CHANNEL_VALUES[mapping.sourceMember.name];
        const source = /^public static const ([A-Za-z_$][A-Za-z0-9_$]*):uint\s*=\s*([0-9]+);$/.exec(
            mapping.sourceMember.signature);
        if (mapping.sourceMember.access !== "read" || mapping.targetMember.scope !== "static"
            || mapping.targetMember.kind !== "property" || expected === undefined || source === null
            || source[1] !== mapping.sourceMember.name || Number(source[2]) !== expected
            || mapping.targetMember.signature !== String(expected)) {
            throw new HardenedSemanticError("HARDENED_CAPABILITY_MEMBER_SIGNATURE",
                "BitmapDataChannel constants require exact source and target literal identity");
        }
    } else if (mapping.sourceMember.access === "call" && (exactGeometry
        || exactCallMember(mapping.sourceQName, mapping.sourceMember.name)
        || mapping.sourceMember.name === "getBounds")) {
        if (!exactCallableTypes(mapping.sourceMember.signature, mapping.targetMember.signature,
            mapping.targetMember.kind === "constructor", exactCallMember(mapping.sourceQName, mapping.sourceMember.name))) {
            throw new HardenedSemanticError("HARDENED_CAPABILITY_MEMBER_SIGNATURE",
                "Flash and target callable parameter/result types are not exact");
        }
    } else if (exactGeometry || bitmap) {
        const sourceType = mappedPropertyType(mapping.sourceMember.signature, mapping.sourceMember.access, bitmap);
        const targetType = targetTypeDescriptor(mapping.targetMember.signature);
        if (sourceType === null || !exactSourceTargetType(sourceType, targetType)) {
            throw new HardenedSemanticError("HARDENED_CAPABILITY_MEMBER_SIGNATURE",
                "Flash and target property value types are not exact");
        }
    }
}

function exactOwnedSourceMetadata(mapping: CapabilityMapping, use: { [key: string]: unknown },
    signature: { [key: string]: unknown }): boolean {
    if (mapping.sourceMember !== null && TEXT_CONSTANT_QNAMES.has(mapping.sourceQName)) {
        return use.classification === "layaair-flash-api-bridge" && use.argumentCount === null
            && use.receiverType === mapping.sourceQName && signature.declaredBy === mapping.sourceQName
            && signature.kind === "const" && signature.static === true && signature.returnType === "String"
            && signature.minArgs === 0 && signature.maxArgs === null;
    }
    if (mapping.sourceMember === null || !exactCallMember(mapping.sourceQName, mapping.sourceMember.name)) return true;
    const constructor = mapping.sourceMember.name === mapping.targetExport;
    const expectedKind = constructor ? "constructor"
        : mapping.sourceQName === "flash.display.BitmapDataChannel" ? "const"
            : mapping.sourceMember.access === "call" ? "method" : mapping.sourceMember.access === "read" ? "get" : "set";
    const callable = sourceCallableTypes(mapping.sourceMember.signature, true);
    const expectedReturn = constructor ? mapping.targetExport
        : mapping.sourceQName === "flash.display.BitmapDataChannel"
            ? mappedPropertyType(mapping.sourceMember.signature, mapping.sourceMember.access, true)
            : mapping.sourceMember.access === "write" ? "void" : callable?.returnType || null;
    return use.classification === "layaair-flash-api-bridge" && use.receiverType === mapping.sourceQName
        && signature.declaredBy === mapping.sourceQName && signature.kind === expectedKind
        && signature.static === (mapping.sourceQName === "flash.display.BitmapDataChannel")
        && typeof signature.returnType === "string"
        && canonicalSourceType(signature.returnType, true) === expectedReturn;
}

function findSourceApi(source: { [key: string]: unknown }, mapping: CapabilityMapping): void {
    const section = source.as3SourceCapabilities;
    if (!isObject(section) || !Array.isArray(section.apis) || !Array.isArray(section.memberUses)) {
        throw new HardenedSemanticError("HARDENED_SOURCE_CENSUS_SCHEMA", "source census lacks as3SourceCapabilities authority");
    }
    const apis = section.apis.filter((value: unknown) => isObject(value) && value.qname === mapping.sourceQName);
    if (STRICT_SOURCE_QNAMES.has(mapping.sourceQName) && apis.length !== 1) {
        throw new HardenedSemanticError("HARDENED_SOURCE_CAPABILITY",
            "owned source API identity is absent or ambiguous", null);
    }
    const api = apis.length === 1 ? apis[0] : null;
    if (mapping.sourceQName === "trace" && (!isObject(api)
        || JSON.stringify(api.signatures) !== JSON.stringify(["public native function trace(... rest) : void;"])
        || mapping.sourceRoles.length !== 1 || mapping.sourceRoles[0] !== "global-function"
        || mapping.sourceMember !== null || mapping.targetMember !== null
        || mapping.targetKind !== "function" || mapping.targetExport !== "trace"
        || mapping.targetModule !== "src/layaAir/flash/debug/trace.ts"
        || mapping.targetCapabilityId !== "api.flash.debug"
        || mapping.targetSignature !== "(...values: unknown[]) => void")) {
        throw new HardenedSemanticError("HARDENED_GLOBAL_FUNCTION_AUTHORITY",
            "trace requires its exact native signature and shared target function");
    }
    const bitmapApiRoles = isObject(api) && Array.isArray(api.roles)
        ? api.roles.slice().sort() : [];
    const exactBitmapTypeRoles = STRICT_SOURCE_QNAMES.has(mapping.sourceQName) && mapping.sourceMember === null
        && bitmapApiRoles.length === mapping.sourceRoles.length
        && mapping.sourceRoles.every((role, index) => bitmapApiRoles[index] === role);
    if (!isObject(api) || api.classification !== "layaair-flash-api-bridge" || !Array.isArray(api.roles)
        || !mapping.sourceRoles.every((role) => (api.roles as unknown[]).indexOf(role) >= 0) || !isObject(api.preserve)
        || (STRICT_SOURCE_QNAMES.has(mapping.sourceQName) && mapping.sourceMember === null && !exactBitmapTypeRoles)
        || api.preserve.apiName !== true || api.preserve.signature !== true) {
        throw new HardenedSemanticError("HARDENED_SOURCE_CAPABILITY", "source Flash API use is absent or not bridge-classified", null);
    }
    if (mapping.sourceMember !== null) {
        const uses = section.memberUses.filter((value: unknown) => isObject(value)
            && value.qname === mapping.sourceQName && value.member === mapping.sourceMember!.name
            && value.access === mapping.sourceMember!.access
            && mapping.sourceRoles.length === 1 && value.context === mapping.sourceRoles[0]);
        if (STRICT_SOURCE_QNAMES.has(mapping.sourceQName)) {
            if (TEXT_CONSTANT_QNAMES.has(mapping.sourceQName) && uses.length !== 1) {
                throw new HardenedSemanticError("HARDENED_SOURCE_MEMBER_CAPABILITY",
                    "text constant source member evidence is absent or ambiguous");
            }
            const argumentCounts = new Set<string>();
            let signatureTuple: string | null = null;
            for (const value of uses) {
                if (!isObject(value) || value.classification !== "layaair-flash-api-bridge"
                    || value.preserveNameAndSignature !== true || value.receiverType !== mapping.sourceQName
                    || (TEXT_CONSTANT_QNAMES.has(mapping.sourceQName) && value.argumentCount !== null)
                    || !Array.isArray(value.signatures) || value.signatures.length !== 1
                    || !isObject(value.signatures[0]) || !exactKeys(value.signatures[0],
                        ["declaredBy", "kind", "maxArgs", "minArgs", "returnType", "signature", "static"])
                    || (TEXT_CONSTANT_QNAMES.has(mapping.sourceQName)
                        && (value.signatures[0].minArgs !== 0 || value.signatures[0].maxArgs !== null))
                    || !exactOwnedSourceMetadata(mapping, value, value.signatures[0])) {
                    throw new HardenedSemanticError("HARDENED_SOURCE_MEMBER_CAPABILITY",
                        "bitmap source member evidence is conflicting or incomplete: " + mapping.sourceQName + "." + mapping.sourceMember!.name + "/" + mapping.sourceMember!.access);
                }
                const argumentIdentity = JSON.stringify(value.argumentCount);
                const tuple = JSON.stringify(value.signatures[0]);
                if (argumentCounts.has(argumentIdentity) || (signatureTuple !== null && signatureTuple !== tuple)) {
                    throw new HardenedSemanticError("HARDENED_SOURCE_MEMBER_CAPABILITY",
                        "bitmap source member evidence is ambiguous");
                }
                argumentCounts.add(argumentIdentity);
                signatureTuple = tuple;
            }
            if (uses.length === 0) {
                throw new HardenedSemanticError("HARDENED_SOURCE_MEMBER_CAPABILITY",
                    "bitmap source member evidence is absent");
            }
        }
        const authenticatedUses = uses.filter((value: unknown) => isObject(value)
            && value.classification === "layaair-flash-api-bridge" && mapping.sourceRoles.length === 1
            && mapping.sourceRoles[0] === value.context && value.preserveNameAndSignature === true
            && Array.isArray(value.signatures) && value.signatures.some((signature: unknown) => isObject(signature)
                && signature.signature === mapping.sourceMember!.signature
                && exactOwnedSourceMetadata(mapping, value, signature)
                && (mapping.sourceMember!.access === "read" ? mapping.sourceMember!.minArgs === 0
                    && mapping.sourceMember!.maxArgs === 0
                    : mapping.sourceMember!.access === "write" ? mapping.sourceMember!.minArgs === 1
                        && mapping.sourceMember!.maxArgs === 1
                        : signature.minArgs === mapping.sourceMember!.minArgs
                            && signature.maxArgs === mapping.sourceMember!.maxArgs)));
        if (authenticatedUses.length === 0) {
            throw new HardenedSemanticError("HARDENED_SOURCE_MEMBER_CAPABILITY", "source Flash member signature is not census-authenticated");
        }
    }
}

function runtimeModule(module: string, runtimePackage: string): string {
    return module.startsWith("@bleach/as3-runtime/")
        ? `${runtimePackage}/${module.slice("@bleach/as3-runtime/".length)}` : module;
}

function intrinsicTypes(source: { [key: string]: unknown }, runtimePackage: string,
    applicationProfile: boolean): LoadedCapabilityAuthority["intrinsicTypesBySource"] {
    const section = source.as3SourceCapabilities;
    if (!isObject(section) || !Array.isArray(section.apis)) {
        throw new HardenedSemanticError("HARDENED_SOURCE_CENSUS_SCHEMA", "source census lacks intrinsic API authority");
    }
    const apis = section.apis as unknown[];
    const result: LoadedCapabilityAuthority["intrinsicTypesBySource"] = Object.create(null);
    INTRINSIC_TYPES.forEach(intrinsic => {
        const api = apis.find((value: unknown) => isObject(value) && value.qname === intrinsic.sourceQName);
        if (!isObject(api)) return;
        const sourceRoles = Array.isArray(api.roles) ? api.roles as string[] : [];
        const requiredRoles = applicationProfile ? ["import"] : intrinsic.sourceRoles;
        if (api.classification !== "layaair-flash-api-bridge" || !Array.isArray(api.roles)
            || !requiredRoles.every(role => sourceRoles.indexOf(role) >= 0)
            || !isObject(api.preserve) || api.preserve.apiName !== true || api.preserve.signature !== true) {
            throw new HardenedSemanticError("HARDENED_SOURCE_INTRINSIC",
                "source intrinsic API is present without the exact bridge contract");
        }
        result[intrinsic.sourceQName] = Object.freeze({
            sourceRoles: Object.freeze((applicationProfile ? sourceRoles : intrinsic.sourceRoles).slice()) as unknown as string[],
            targetModule: runtimeModule(intrinsic.targetModule, runtimePackage), targetExport: intrinsic.targetExport,
            targetKind: intrinsic.targetKind, targetSignature: intrinsic.targetSignature,
        });
    });
    return Object.freeze(result);
}

function intrinsicMemberKey(sourceQName: string, access: string, name: string): string {
    return `${sourceQName}\u0000${access}\u0000${name}`;
}

function intrinsicMembers(source: { [key: string]: unknown },
    intrinsicTypesBySource: LoadedCapabilityAuthority["intrinsicTypesBySource"],
    applicationProfile: boolean): LoadedCapabilityAuthority["intrinsicMembersByKey"] {
    const section = source.as3SourceCapabilities;
    if (!isObject(section) || !Array.isArray(section.memberUses)) {
        throw new HardenedSemanticError("HARDENED_SOURCE_CENSUS_SCHEMA", "source census lacks intrinsic member authority");
    }
    const result: LoadedCapabilityAuthority["intrinsicMembersByKey"] = Object.create(null);
    INTRINSIC_MEMBERS.forEach(definition => {
        if (!intrinsicTypesBySource[definition.sourceQName]) return;
        const uses = (section.memberUses as unknown[]).filter((value: unknown) => isObject(value)
            && value.qname === definition.sourceQName && value.member === definition.name
            && value.access === definition.access && value.preserveNameAndSignature === true);
        if (applicationProfile && uses.length === 0) return;
        const authenticated = uses.some(value => isObject(value) && Array.isArray(value.signatures)
            && value.signatures.some((signature: unknown) => isObject(signature)
                && signature.signature === definition.sourceSignature
                && typeof signature.returnType === "string"
                && signature.returnType.split(".").pop() === definition.returnType
                && signature.minArgs === definition.minArgs
                && (definition.access === "read" ? signature.maxArgs === null || signature.maxArgs === 0
                    : signature.maxArgs === definition.maxArgs)));
        if (!authenticated) {
            throw new HardenedSemanticError("HARDENED_SOURCE_INTRINSIC_MEMBER",
                `source intrinsic member ${definition.sourceQName}.${definition.name} lacks its exact census signature`);
        }
        const key = intrinsicMemberKey(definition.sourceQName, definition.access, definition.name);
        if (result[key]) {
            throw new HardenedSemanticError("HARDENED_SOURCE_INTRINSIC_MEMBER",
                "source intrinsic member authority contains a duplicate identity");
        }
        result[key] = Object.freeze({
            sourceQName: definition.sourceQName,
            name: definition.name,
            access: definition.access,
            minArgs: definition.minArgs,
            maxArgs: definition.maxArgs,
            parameterTypes: Object.freeze(definition.parameterTypes.slice()) as unknown as string[],
            returnType: definition.returnType,
            sourceSignature: definition.sourceSignature,
        });
    });
    return Object.freeze(result);
}

function nativeTimerFunctions(source: { [key: string]: unknown }, target: NativeTimerAuthority,
    runtimePackage: string, applicationProfile: boolean):
    LoadedCapabilityAuthority["nativeTimerFunctionsBySource"] {
    const section = source.as3SourceCapabilities;
    if (!isObject(section) || !Array.isArray(section.apis) || !Array.isArray(section.memberUses)) {
        throw new HardenedSemanticError("HARDENED_SOURCE_CENSUS_SCHEMA",
            "source census lacks native timer-function authority");
    }
    if (!applicationProfile && target.exports.length !== NATIVE_TIMER_FUNCTIONS.length) {
        throw new HardenedSemanticError("HARDENED_NATIVE_TIMER_PARITY",
            "native timer table and target authority count differ");
    }
    const apis = section.apis as unknown[];
    const memberUses = section.memberUses as unknown[];
    const result: LoadedCapabilityAuthority["nativeTimerFunctionsBySource"] = Object.create(null);
    NATIVE_TIMER_FUNCTIONS.forEach(definition => {
        const expectedTargetModule = runtimeModule(definition.targetModule, runtimePackage);
        const api = apis.find(value => isObject(value) && value.qname === definition.sourceQName);
        if (applicationProfile && !isObject(api)) return;
        if (target.module !== expectedTargetModule || !target.exports.some(item =>
            item.name === definition.targetExport && item.signature === definition.targetSignature)) {
            throw new HardenedSemanticError("HARDENED_NATIVE_TIMER_PARITY",
                `native timer target is not authenticated: ${definition.sourceQName}`);
        }
        const sourceRoles = isObject(api) && Array.isArray(api.roles) ? api.roles as string[] : [];
        const requiredRoles = applicationProfile ? ["import", "package-function"] : definition.sourceRoles;
        if (!isObject(api) || api.classification !== "layaair-flash-api-bridge" || !Array.isArray(api.roles)
            || !requiredRoles.every(role => sourceRoles.indexOf(role) >= 0)
            || !isObject(api.preserve) || api.preserve.apiName !== true || api.preserve.signature !== true) {
            throw new HardenedSemanticError("HARDENED_NATIVE_TIMER_SOURCE",
                `native timer lacks exact bridge-classified source identity: ${definition.sourceQName}`);
        }
        const uses = memberUses.filter(value => isObject(value) && value.qname === definition.sourceQName
            && value.member === "<call>" && value.access === "call" && value.context === "package-function");
        if (uses.length === 0 || !uses.every(use => isObject(use) && use.preserveNameAndSignature === true
            && Array.isArray(use.signatures) && use.signatures.some((signature: unknown) => isObject(signature)
                && signature.signature === definition.sourceSignature && signature.minArgs === definition.minArgs
                && signature.maxArgs === definition.maxArgs))) {
            throw new HardenedSemanticError("HARDENED_NATIVE_TIMER_SIGNATURE",
                `native timer signature is not census-authenticated: ${definition.sourceQName}`);
        }
        result[definition.sourceQName] = Object.freeze({
            ...definition,
            sourceRoles: applicationProfile ? Object.freeze(sourceRoles.slice()) : definition.sourceRoles,
            targetModule: expectedTargetModule,
        }) as NativeTimerFunctionMapping;
    });
    return Object.freeze(result);
}

function findTargetCapability(target: { [key: string]: unknown }, mapping: CapabilityMapping): void {
    if (target.schema !== "laya-authored-content-capabilities@1" || !Array.isArray(target.capabilities)) {
        throw new HardenedSemanticError("HARDENED_TARGET_CAPABILITIES_SCHEMA", "target Laya capability document has the wrong schema");
    }
    const strict = STRICT_SOURCE_QNAMES.has(mapping.sourceQName);
    const capabilities = target.capabilities.filter((value: unknown) => isObject(value)
        && value.id === mapping.targetCapabilityId);
    if (capabilities.length !== 1) {
        throw new HardenedSemanticError("HARDENED_TARGET_CAPABILITY", "target Laya capability identity is absent or ambiguous");
    }
    const capability = capabilities[0];
    if (!isObject(capability) || capability.status !== "typescript-obligation" || !Array.isArray(capability.obligations)) {
        throw new HardenedSemanticError("HARDENED_TARGET_CAPABILITY", "target Laya capability is not admitted as a TypeScript obligation");
    }
    const globalBitmapObligations = strict ? target.capabilities.flatMap((candidate: unknown) =>
        isObject(candidate) && candidate.status === "typescript-obligation" && Array.isArray(candidate.obligations)
            ? candidate.obligations.filter((value: unknown) => isObject(value)
                && value.export === mapping.targetExport).map((value: unknown) => ({ capability: candidate, obligation: value }))
            : []) : [];
    if (strict && globalBitmapObligations.length !== 1) {
        throw new HardenedSemanticError("HARDENED_TARGET_EXPORT",
            "bitmap target export identity is absent or ambiguous across capabilities");
    }
    const obligations = capability.obligations.filter((value: unknown) => isObject(value)
        && value.export === mapping.targetExport
        && (strict || value.module === mapping.targetModule));
    if (strict && (obligations.length !== 1
        || globalBitmapObligations[0]!.capability !== capability
        || globalBitmapObligations[0]!.obligation !== obligations[0])) {
        throw new HardenedSemanticError("HARDENED_TARGET_EXPORT", "bitmap target module/export identity is absent or ambiguous");
    }
    const obligation = obligations.length === 1 && obligations[0]!.module === mapping.targetModule
        && obligations[0]!.kind === mapping.targetKind && obligations[0]!.signature === mapping.targetSignature
        ? obligations[0] : null;
    if (!isObject(obligation)) {
        throw new HardenedSemanticError("HARDENED_TARGET_EXPORT", "target Laya module/export/signature is not capability-authenticated");
    }
    if (strict && (!Array.isArray(obligation.constructors)
        || obligation.constructors.some((signature: unknown) => typeof signature !== "string")
        || obligation.constructors.length > 1)) {
        throw new HardenedSemanticError("HARDENED_TARGET_MEMBER",
            "bitmap target constructor authority is malformed or ambiguous");
    }
    if (mapping.targetMember !== null) {
        const namedBitmapMembers = strict && Array.isArray(obligation.members)
            ? obligation.members.filter((member: unknown) => isObject(member)
                && member.name === mapping.targetMember!.name) : [];
        if (strict && mapping.targetMember.kind !== "constructor" && namedBitmapMembers.length !== 1) {
            throw new HardenedSemanticError("HARDENED_TARGET_MEMBER", "bitmap target member identity is absent or ambiguous");
        }
        const constructor = mapping.targetMember.kind === "constructor"
            && mapping.targetMember.scope === "static"
            && mapping.targetMember.name === mapping.targetExport
            && Array.isArray(obligation.constructors)
            && obligation.constructors.length === 1
            && obligation.constructors[0] === mapping.targetMember.signature;
        const ordinary = Array.isArray(obligation.members) && obligation.members.some((member: unknown) => isObject(member)
            && member.name === mapping.targetMember!.name && member.kind === mapping.targetMember!.kind
            && member.scope === mapping.targetMember!.scope && member.signature === mapping.targetMember!.signature
            && (mapping.sourceMember?.access !== "write" || member.readonly !== true)
            && (mapping.sourceQName !== "flash.display.BitmapDataChannel" || member.readonly === true)
            && (!TEXT_CONSTANT_QNAMES.has(mapping.sourceQName) || member.readonly === true));
        if (!constructor && !ordinary) {
            throw new HardenedSemanticError("HARDENED_TARGET_MEMBER", "target Laya public member signature is not capability-authenticated");
        }
    }
}

/** Select SDK member candidates with the same checks used during final loading.
 * This produces no loaded authority and does not waive publication validation.
 */
export function selectCapabilityCandidates(sourceJson: string, targetJson: string, mappingJson: string): {
    mappings: CapabilityMapping[];
    held: { mapping: unknown; code: string; message: string }[];
} {
    const source = parseJson(sourceJson, "HARDENED_SOURCE_CENSUS_JSON");
    const target = parseJson(targetJson, "HARDENED_TARGET_CAPABILITIES_JSON");
    const document = parseJson(mappingJson, "HARDENED_CAPABILITY_MAPPING_JSON");
    if (!isObject(source) || !isObject(target) || !isObject(document)
        || document.schema !== "as3-source-to-laya-capability-map@1" || !Array.isArray(document.mappings)) {
        throw new HardenedSemanticError("HARDENED_CAPABILITY_MAPPING_SCHEMA", "candidate selection requires source, target and mapping documents");
    }
    const mappings: CapabilityMapping[] = [];
    const held: { mapping: unknown; code: string; message: string }[] = [];
    for (const candidate of document.mappings) {
        try {
            const mapping = parseMapping({ schema: document.schema, mappings: [candidate] }).mappings[0]!;
            findSourceApi(source, mapping);
            findTargetCapability(target, mapping);
            assertMappedMemberCompatibility(mapping);
            mappings.push(mapping);
        } catch (error) {
            // Type identities must still be valid as a whole. Only unsupported
            // member candidates can be omitted and reported as explicit holds.
            if (!(error instanceof HardenedSemanticError) || !isObject(candidate) || !isObject(candidate.sourceMember)) throw error;
            held.push({ mapping: candidate, code: error.code, message: error.message });
        }
    }
    return { mappings, held };
}

export function loadCapabilityAuthority(input: CapabilityAuthorityInput, sha256: Sha256Function): LoadedCapabilityAuthority {
    const runtimePackage = input.runtimePackage || "@bleach/as3-runtime";
    const applicationProfile = input.applicationProfile === true;
    if (!/^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/.test(runtimePackage)) {
        throw new HardenedSemanticError("HARDENED_RUNTIME_PACKAGE", "runtime package name is invalid");
    }
    requireHash(input.sourceCensusJson, input.sourceCensusSha256, sha256, "HARDENED_SOURCE_CENSUS_HASH");
    requireHash(input.targetCapabilitiesJson, input.targetCapabilitiesSha256, sha256, "HARDENED_TARGET_CAPABILITIES_HASH");
    requireHash(input.mappingJson, input.mappingSha256, sha256, "HARDENED_CAPABILITY_MAPPING_HASH");
    requireHash(input.nativeTimerAuthorityJson, input.nativeTimerAuthoritySha256, sha256,
        "HARDENED_NATIVE_TIMER_AUTHORITY_HASH");
    const source = parseJson(input.sourceCensusJson, "HARDENED_SOURCE_CENSUS_JSON");
    const target = parseJson(input.targetCapabilitiesJson, "HARDENED_TARGET_CAPABILITIES_JSON");
    const mappingDocument = parseMapping(parseJson(input.mappingJson, "HARDENED_CAPABILITY_MAPPING_JSON"));
    const nativeTimerAuthority = parseNativeTimerAuthority(parseJson(input.nativeTimerAuthorityJson,
        "HARDENED_NATIVE_TIMER_AUTHORITY_JSON"), runtimePackage);
    if (canonicalMappingJson(mappingDocument) !== input.mappingJson || !isObject(source) || !isObject(target)) {
        throw new HardenedSemanticError("HARDENED_CAPABILITY_MAPPING_CANONICAL", "capability mapping must be canonical sorted JSON with one trailing LF");
    }
    const typeMappingsBySource: { [qualifiedName: string]: CapabilityMapping } = Object.create(null);
    const memberMappingsByKey: { [memberKey: string]: CapabilityMapping } = Object.create(null);
    mappingDocument.mappings.forEach((mapping) => {
        const memberKey = mapping.sourceMember === null ? null
            : [mapping.sourceQName, mapping.sourceMember.access, mapping.sourceMember.name, mapping.sourceMember.signature].join("\u0000");
        if ((memberKey === null && typeMappingsBySource[mapping.sourceQName])
            || (memberKey !== null && memberMappingsByKey[memberKey])) {
            throw new HardenedSemanticError("HARDENED_CAPABILITY_MAPPING_DUPLICATE", "source Flash capability mapping is duplicated");
        }
        findSourceApi(source, mapping);
        findTargetCapability(target, mapping);
        assertMappedMemberCompatibility(mapping);
        Object.freeze(mapping.sourceRoles);
        if (mapping.sourceMember !== null) {
            Object.freeze(mapping.sourceMember);
        }
        if (mapping.targetMember !== null) {
            Object.freeze(mapping.targetMember);
        }
        Object.freeze(mapping);
        if (memberKey === null) {
            typeMappingsBySource[mapping.sourceQName] = mapping;
        } else {
            memberMappingsByKey[memberKey] = mapping;
        }
    });
    Object.freeze(typeMappingsBySource);
    Object.freeze(memberMappingsByKey);
    const intrinsicTypesBySource = intrinsicTypes(source, runtimePackage, applicationProfile);
    const authority: LoadedCapabilityAuthority = Object.freeze({
        sourceCensusSha256: input.sourceCensusSha256,
        targetCapabilitiesSha256: input.targetCapabilitiesSha256,
        mappingSha256: input.mappingSha256,
        nativeTimerAuthoritySha256: input.nativeTimerAuthoritySha256,
        typeMappingsBySource,
        memberMappingsByKey,
        intrinsicTypesBySource,
        intrinsicMembersByKey: intrinsicMembers(source, intrinsicTypesBySource, applicationProfile),
        nativeTimerFunctionsBySource: nativeTimerFunctions(source, nativeTimerAuthority, runtimePackage, applicationProfile),
    });
    LOADED_AUTHORITIES.add(authority);
    return authority;
}

export function assertLoadedCapabilityAuthority(value: LoadedCapabilityAuthority): void {
    if (!value || !LOADED_AUTHORITIES.has(value as unknown as object)) {
        throw new HardenedSemanticError("HARDENED_CAPABILITY_AUTHORITY_INSTANCE", "semantic adapter requires an immutable authority returned by loadCapabilityAuthority");
    }
}

export function targetModuleSpecifier(targetModule: string): string {
    if (!isPublicTargetModule(targetModule)) {
        throw new HardenedSemanticError("HARDENED_TARGET_MODULE", "target module is outside the public Laya source namespace");
    }
    return "laya/" + targetModule.slice(TARGET_MODULE_PREFIX.length, -".ts".length);
}

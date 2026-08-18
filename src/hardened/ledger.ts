import {
    CapabilityAuthorityInput,
    CapabilityMapping,
    CapabilityMappingDocument,
    LoadedCapabilityAuthority,
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
        if (!exactKeys(value, keys) || !QNAME.test(String(value.sourceQName))
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
            if (!isObject(value.sourceMember) || !exactKeys(value.sourceMember, ["access", "maxArgs", "minArgs", "name", "signature"])
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
        if (sourceMember !== null && targetMember !== null && sourceMember.name !== targetMember.name) {
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

function findSourceApi(source: { [key: string]: unknown }, mapping: CapabilityMapping): void {
    const section = source.as3SourceCapabilities;
    if (!isObject(section) || !Array.isArray(section.apis) || !Array.isArray(section.memberUses)) {
        throw new HardenedSemanticError("HARDENED_SOURCE_CENSUS_SCHEMA", "source census lacks as3SourceCapabilities authority");
    }
    const api = section.apis.find((value: unknown) => isObject(value) && value.qname === mapping.sourceQName);
    if (!isObject(api) || api.classification !== "layaair-flash-api-bridge" || !Array.isArray(api.roles)
        || !mapping.sourceRoles.every((role) => (api.roles as unknown[]).indexOf(role) >= 0) || !isObject(api.preserve)
        || api.preserve.apiName !== true || api.preserve.signature !== true) {
        throw new HardenedSemanticError("HARDENED_SOURCE_CAPABILITY", "source Flash API use is absent or not bridge-classified", null);
    }
    if (mapping.sourceMember !== null) {
        const use = section.memberUses.find((value: unknown) => isObject(value)
            && value.qname === mapping.sourceQName && value.member === mapping.sourceMember!.name
            && value.access === mapping.sourceMember!.access
            && (mapping.sourceRoles.indexOf("constructor") < 0 || value.context === "constructor"));
        if (!isObject(use) || use.preserveNameAndSignature !== true || !Array.isArray(use.signatures)
            || !use.signatures.some((signature: unknown) => isObject(signature)
                && signature.signature === mapping.sourceMember!.signature
                && signature.minArgs === mapping.sourceMember!.minArgs
                && signature.maxArgs === mapping.sourceMember!.maxArgs)) {
            throw new HardenedSemanticError("HARDENED_SOURCE_MEMBER_CAPABILITY", "source Flash member signature is not census-authenticated");
        }
    }
}

function intrinsicTypes(source: { [key: string]: unknown }): LoadedCapabilityAuthority["intrinsicTypesBySource"] {
    const section = source.as3SourceCapabilities;
    if (!isObject(section) || !Array.isArray(section.apis)) {
        throw new HardenedSemanticError("HARDENED_SOURCE_CENSUS_SCHEMA", "source census lacks intrinsic API authority");
    }
    const apis = section.apis as unknown[];
    const result: LoadedCapabilityAuthority["intrinsicTypesBySource"] = Object.create(null);
    INTRINSIC_TYPES.forEach(intrinsic => {
        const api = apis.find((value: unknown) => isObject(value) && value.qname === intrinsic.sourceQName);
        if (!isObject(api)) return;
        if (api.classification !== "layaair-flash-api-bridge" || !Array.isArray(api.roles)
            || !intrinsic.sourceRoles.every(role => (api.roles as unknown[]).indexOf(role) >= 0)
            || !isObject(api.preserve) || api.preserve.apiName !== true || api.preserve.signature !== true) {
            throw new HardenedSemanticError("HARDENED_SOURCE_INTRINSIC",
                "source intrinsic API is present without the exact bridge contract");
        }
        result[intrinsic.sourceQName] = Object.freeze({
            sourceRoles: Object.freeze(intrinsic.sourceRoles.slice()) as unknown as string[],
            targetModule: intrinsic.targetModule, targetExport: intrinsic.targetExport,
            targetKind: intrinsic.targetKind, targetSignature: intrinsic.targetSignature,
        });
    });
    return Object.freeze(result);
}

function intrinsicMemberKey(sourceQName: string, access: string, name: string): string {
    return `${sourceQName}\u0000${access}\u0000${name}`;
}

function intrinsicMembers(source: { [key: string]: unknown },
    intrinsicTypesBySource: LoadedCapabilityAuthority["intrinsicTypesBySource"]): LoadedCapabilityAuthority["intrinsicMembersByKey"] {
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

function findTargetCapability(target: { [key: string]: unknown }, mapping: CapabilityMapping): void {
    if (target.schema !== "laya-authored-content-capabilities@1" || !Array.isArray(target.capabilities)) {
        throw new HardenedSemanticError("HARDENED_TARGET_CAPABILITIES_SCHEMA", "target Laya capability document has the wrong schema");
    }
    const capability = target.capabilities.find((value: unknown) => isObject(value) && value.id === mapping.targetCapabilityId);
    if (!isObject(capability) || capability.status !== "typescript-obligation" || !Array.isArray(capability.obligations)) {
        throw new HardenedSemanticError("HARDENED_TARGET_CAPABILITY", "target Laya capability is not admitted as a TypeScript obligation");
    }
    const obligation = capability.obligations.find((value: unknown) => isObject(value)
        && value.module === mapping.targetModule && value.export === mapping.targetExport
        && value.kind === mapping.targetKind && value.signature === mapping.targetSignature);
    if (!isObject(obligation)) {
        throw new HardenedSemanticError("HARDENED_TARGET_EXPORT", "target Laya module/export/signature is not capability-authenticated");
    }
    if (mapping.targetMember !== null) {
        const constructor = mapping.targetMember.kind === "constructor"
            && mapping.targetMember.scope === "static"
            && mapping.targetMember.name === mapping.targetExport
            && Array.isArray(obligation.constructors)
            && obligation.constructors.indexOf(mapping.targetMember.signature) >= 0;
        const ordinary = Array.isArray(obligation.members) && obligation.members.some((member: unknown) => isObject(member)
            && member.name === mapping.targetMember!.name && member.kind === mapping.targetMember!.kind
            && member.scope === mapping.targetMember!.scope && member.signature === mapping.targetMember!.signature);
        if (!constructor && !ordinary) {
            throw new HardenedSemanticError("HARDENED_TARGET_MEMBER", "target Laya public member signature is not capability-authenticated");
        }
    }
}

export function loadCapabilityAuthority(input: CapabilityAuthorityInput, sha256: Sha256Function): LoadedCapabilityAuthority {
    requireHash(input.sourceCensusJson, input.sourceCensusSha256, sha256, "HARDENED_SOURCE_CENSUS_HASH");
    requireHash(input.targetCapabilitiesJson, input.targetCapabilitiesSha256, sha256, "HARDENED_TARGET_CAPABILITIES_HASH");
    requireHash(input.mappingJson, input.mappingSha256, sha256, "HARDENED_CAPABILITY_MAPPING_HASH");
    const source = parseJson(input.sourceCensusJson, "HARDENED_SOURCE_CENSUS_JSON");
    const target = parseJson(input.targetCapabilitiesJson, "HARDENED_TARGET_CAPABILITIES_JSON");
    const mappingDocument = parseMapping(parseJson(input.mappingJson, "HARDENED_CAPABILITY_MAPPING_JSON"));
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
    const intrinsicTypesBySource = intrinsicTypes(source);
    const authority: LoadedCapabilityAuthority = Object.freeze({
        sourceCensusSha256: input.sourceCensusSha256,
        targetCapabilitiesSha256: input.targetCapabilitiesSha256,
        mappingSha256: input.mappingSha256,
        typeMappingsBySource,
        memberMappingsByKey,
        intrinsicTypesBySource,
        intrinsicMembersByKey: intrinsicMembers(source, intrinsicTypesBySource),
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

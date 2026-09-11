import {
    HardenedSemanticError,
    LoadedLocalMemberAuthority,
    LoadedLocalTypeAuthority,
    LocalDeclarationMember,
    LocalDeclarationParameter,
    LocalMemberAuthorityEntry,
    LocalMemberDeclaration,
} from "./contracts";
import { assertLoadedLocalTypeAuthority } from "./local-types";

export interface LocalMemberAuthorityInput {
    json: string;
    sha256: string;
    expectedEntryCount: number;
    expectedCompleteCount: number;
    expectedHeldCount: number;
    expectedLocalTypeMapSha256: string;
    expectedDeclarationWorkerSha256: string;
    expectedSourceCensusSha256: string;
    expectedSchema?: string;
}

export type LocalMemberSha256 = (bytes: string) => string;

const SHA256 = /^[0-9a-f]{64}$/;
const ID = /^[0-9a-f]{16}$/;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const QNAME = /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;
const HOLD_CODE = /^[A-Z][A-Z0-9_]{2,127}$/;
const TYPE = /^(?:\*|[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*|Vector\.<.+>)$/;
const MEMBER_KINDS = new Set(["constructor", "method", "getter", "setter", "field", "namespace"]);
const MODIFIERS = new Set(["public", "private", "protected", "internal", "static", "override", "final"]);
const AUTHORITIES = new WeakSet<object>();

function fail(code: string, message: string): never {
    throw new HardenedSemanticError(code, message);
}

function object(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: string[]): boolean {
    const actual = Object.keys(value).sort();
    const sorted = expected.slice().sort();
    return actual.length === sorted.length && actual.every((key, index) => key === sorted[index]);
}

function compareUtf8(left: string, right: string): number {
    return left < right ? -1 : left > right ? 1 : 0;
}

function canonical(value: unknown): string {
    if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
    if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (object(value)) {
        return `{${Object.keys(value).sort(compareUtf8).map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
    }
    fail("HARDENED_LOCAL_MEMBER_JSON", "local member authority contains a non-JSON value");
}

function freeze<T>(value: T): T {
    if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
        Object.keys(value as unknown as Record<string, unknown>).forEach(key =>
            freeze((value as unknown as Record<string, unknown>)[key]));
        Object.freeze(value);
    }
    return value;
}

function validType(value: unknown): value is string {
    if (typeof value !== "string" || value.length > 1024 || !TYPE.test(value)) return false;
    if (!value.startsWith("Vector.<")) return true;
    let depth = 0;
    for (let index = 0; index < value.length; index += 1) {
        if (value.startsWith("Vector.<", index)) {
            depth += 1;
            index += "Vector.<".length - 1;
        } else if (value[index] === ">") {
            depth -= 1;
            if (depth < 0) return false;
        } else if (value[index] === "<") return false;
    }
    return depth === 0 && value.endsWith(">");
}

function parameter(raw: unknown): LocalDeclarationParameter {
    if (!object(raw) || !exactKeys(raw, ["name", "optional", "rest", "type"])
        || typeof raw.name !== "string" || !IDENTIFIER.test(raw.name)
        || !validType(raw.type) || typeof raw.optional !== "boolean" || typeof raw.rest !== "boolean"
        || (raw.optional && raw.rest)) {
        fail("HARDENED_LOCAL_MEMBER_PARAMETER", "local member parameter is invalid");
    }
    return { name: raw.name, type: raw.type, optional: raw.optional, rest: raw.rest };
}

function member(raw: unknown): LocalDeclarationMember {
    if (!object(raw) || !exactKeys(raw, [
        "fieldType", "kind", "modifiers", "name", "namespaceName", "parameters", "readonly", "returnType",
    ]) || typeof raw.kind !== "string" || !MEMBER_KINDS.has(raw.kind)
        || typeof raw.name !== "string" || !IDENTIFIER.test(raw.name)
        || !Array.isArray(raw.modifiers) || raw.modifiers.some(item => typeof item !== "string" || !MODIFIERS.has(item))
        || new Set(raw.modifiers).size !== raw.modifiers.length
        || (raw.namespaceName !== null && (typeof raw.namespaceName !== "string" || !IDENTIFIER.test(raw.namespaceName)))
        || !Array.isArray(raw.parameters) || typeof raw.readonly !== "boolean"
        || (raw.returnType !== null && !validType(raw.returnType))
        || (raw.fieldType !== null && !validType(raw.fieldType))) {
        fail("HARDENED_LOCAL_MEMBER_SIGNATURE", "local member signature is invalid");
    }
    const parameters = raw.parameters.map(parameter);
    const kind = raw.kind as LocalDeclarationMember["kind"];
    if ((kind === "field") !== (raw.fieldType !== null) || (kind === "field" && (parameters.length !== 0 || raw.returnType !== null))
        || (kind !== "field" && raw.fieldType !== null)
        || (kind === "namespace" && (parameters.length !== 0 || raw.returnType !== null || raw.readonly))
        || (kind === "constructor" && (raw.returnType !== null || raw.readonly))
        || (kind !== "constructor" && kind !== "field" && kind !== "namespace" && raw.returnType === null)
        || (kind === "getter" && parameters.length !== 0)
        || (kind === "setter" && parameters.length !== 1)
        || parameters.some((item, index) => item.rest && index !== parameters.length - 1)) {
        fail("HARDENED_LOCAL_MEMBER_SIGNATURE", "local member kind and signature disagree");
    }
    return {
        kind, name: raw.name, modifiers: raw.modifiers.slice() as string[],
        namespaceName: raw.namespaceName as string | null, parameters,
        returnType: raw.returnType as string | null, fieldType: raw.fieldType as string | null,
        readonly: raw.readonly,
    };
}

function declaration(raw: unknown): LocalMemberDeclaration {
    if (!object(raw) || !exactKeys(raw, ["baseQNames", "interfaceQNames", "members", "packageInitializer"])
        || !Array.isArray(raw.baseQNames) || !Array.isArray(raw.interfaceQNames) || !Array.isArray(raw.members)
        || raw.baseQNames.some(item => typeof item !== "string" || !QNAME.test(item))
        || raw.interfaceQNames.some(item => typeof item !== "string" || !QNAME.test(item))
        || new Set(raw.baseQNames).size !== raw.baseQNames.length
        || new Set(raw.interfaceQNames).size !== raw.interfaceQNames.length) {
        fail("HARDENED_LOCAL_MEMBER_DECLARATION", "local declaration is invalid");
    }
    let packageInitializer: LocalMemberDeclaration["packageInitializer"] = null;
    if (raw.packageInitializer !== null) {
        if (!object(raw.packageInitializer) || !exactKeys(raw.packageInitializer, ["argumentCount", "kind", "targetQName"])
            || raw.packageInitializer.kind !== "new" || raw.packageInitializer.argumentCount !== 0
            || typeof raw.packageInitializer.targetQName !== "string" || !QNAME.test(raw.packageInitializer.targetQName)) {
            fail("HARDENED_LOCAL_MEMBER_DECLARATION", "package initializer authority is invalid");
        }
        packageInitializer = { kind: "new", targetQName: raw.packageInitializer.targetQName, argumentCount: 0 };
    }
    return {
        baseQNames: raw.baseQNames.slice() as string[],
        interfaceQNames: raw.interfaceQNames.slice() as string[],
        members: raw.members.map(member),
        packageInitializer,
    };
}

export function loadLocalMemberAuthority(input: LocalMemberAuthorityInput, sha256: LocalMemberSha256,
    localTypes: LoadedLocalTypeAuthority): LoadedLocalMemberAuthority {
    assertLoadedLocalTypeAuthority(localTypes);
    const profiled = input.expectedSchema === "as3-application-local-member-map@1";
    const inputKeys = [
        "expectedCompleteCount", "expectedDeclarationWorkerSha256", "expectedEntryCount", "expectedHeldCount",
        "expectedLocalTypeMapSha256", "expectedSourceCensusSha256", "json", "sha256",
    ].concat(profiled ? ["expectedSchema"] : []);
    if (!object(input) || !exactKeys(input as unknown as Record<string, unknown>, inputKeys)
        || typeof input.json !== "string" || typeof input.sha256 !== "string" || !SHA256.test(input.sha256)
        || sha256(input.json) !== input.sha256) {
        fail("HARDENED_LOCAL_MEMBER_HASH", "local member authority bytes do not match their exact digest");
    }
    let document: unknown;
    try { document = JSON.parse(input.json); } catch (_error) {
        fail("HARDENED_LOCAL_MEMBER_JSON", "local member authority is not JSON");
    }
    if (!object(document) || !exactKeys(document, [
        "completeCount", "declarationWorkerSha256", "entries", "entryCount", "heldCount", "localTypeMapSha256",
        "schema", "sourceCensusSha256",
    ]) || document.schema !== (profiled ? input.expectedSchema : "bleach-local-as3-member-map@2")
        || !Array.isArray(document.entries)
        || document.entryCount !== input.expectedEntryCount || document.entries.length !== input.expectedEntryCount
        || document.completeCount !== input.expectedCompleteCount || document.heldCount !== input.expectedHeldCount
        || document.completeCount + document.heldCount !== document.entryCount
        || document.localTypeMapSha256 !== input.expectedLocalTypeMapSha256
        || document.declarationWorkerSha256 !== input.expectedDeclarationWorkerSha256
        || document.sourceCensusSha256 !== input.expectedSourceCensusSha256
        || `${canonical(document)}\n` !== input.json) {
        fail("HARDENED_LOCAL_MEMBER_SCHEMA", "local member authority schema, pins, counts, or canonical bytes are invalid");
    }
    const entries: LocalMemberAuthorityEntry[] = [];
    const entriesByIdentity: { [identity: string]: LocalMemberAuthorityEntry } = Object.create(null);
    let previous = "";
    let completeCount = 0;
    let heldCount = 0;
    document.entries.forEach((raw, index) => {
        if (!object(raw) || !exactKeys(raw, [
            "declaration", "holdCode", "holdSha256", "module", "nodeId", "qname", "sourceContentSha256", "status", "typeKind",
        ]) || (raw.module !== "application" && raw.module !== "bootstrap")
            || typeof raw.qname !== "string" || raw.qname.length === 0 || raw.qname.length > 1024
            || /[\u0000-\u001f\u007f]/.test(raw.qname)
            || typeof raw.nodeId !== "string" || !ID.test(raw.nodeId)
            || typeof raw.sourceContentSha256 !== "string" || !SHA256.test(raw.sourceContentSha256)
            || (raw.typeKind !== "class" && raw.typeKind !== "interface" && raw.typeKind !== "package")
            || (raw.status !== "complete" && raw.status !== "held")) {
            fail("HARDENED_LOCAL_MEMBER_ENTRY", `local member entry ${index} has an invalid boundary shape`);
        }
        const identity = `${raw.module}\u0000${raw.qname}`;
        const localType = localTypes.entriesByIdentity[identity];
        if (identity <= previous || entriesByIdentity[identity] || !localType
            || localType.importable !== QNAME.test(raw.qname)
            || localType.nodeId !== raw.nodeId || localType.sourceContentSha256 !== raw.sourceContentSha256
            || localType.typeKind !== raw.typeKind) {
            fail("HARDENED_LOCAL_MEMBER_ENTRY", `local member entry ${index} does not match local type authority`);
        }
        previous = identity;
        let parsedDeclaration: LocalMemberDeclaration | null;
        if (raw.status === "complete") {
            if (raw.holdCode !== null || raw.holdSha256 !== null || raw.declaration === null) {
                fail("HARDENED_LOCAL_MEMBER_ENTRY", "complete local member entry has held state");
            }
            parsedDeclaration = declaration(raw.declaration);
            if (raw.typeKind === "package") {
                const localName = raw.qname.slice(raw.qname.lastIndexOf(".") + 1);
                if (parsedDeclaration.baseQNames.length !== 0 || parsedDeclaration.interfaceQNames.length !== 0
                    || parsedDeclaration.members.length !== 1
                    || parsedDeclaration.members[0]!.name !== localName
                    || (parsedDeclaration.members[0]!.kind !== "field"
                        && parsedDeclaration.members[0]!.kind !== "namespace")) {
                    fail("HARDENED_LOCAL_MEMBER_ENTRY", "package symbol declaration is not exact");
                }
                if ((parsedDeclaration.members[0]!.kind === "field") !== (parsedDeclaration.packageInitializer !== null)) {
                    fail("HARDENED_LOCAL_MEMBER_ENTRY", "package field initializer authority is not exact");
                }
            } else if (parsedDeclaration.packageInitializer !== null
                || parsedDeclaration.members.some(item => item.kind === "namespace")) {
                fail("HARDENED_LOCAL_MEMBER_ENTRY", "class or interface declaration contains a package namespace");
            }
            completeCount += 1;
        } else {
            if (typeof raw.holdCode !== "string" || !HOLD_CODE.test(raw.holdCode)
                || typeof raw.holdSha256 !== "string" || !SHA256.test(raw.holdSha256) || raw.declaration !== null) {
                fail("HARDENED_LOCAL_MEMBER_ENTRY", "held local member entry lacks exact diagnostic evidence");
            }
            parsedDeclaration = null;
            heldCount += 1;
        }
        const entry: LocalMemberAuthorityEntry = {
            module: raw.module, qname: raw.qname, nodeId: raw.nodeId,
            sourceContentSha256: raw.sourceContentSha256, typeKind: raw.typeKind,
            status: raw.status, holdCode: raw.holdCode as string | null,
            holdSha256: raw.holdSha256 as string | null, declaration: parsedDeclaration,
        };
        entries.push(entry);
        entriesByIdentity[identity] = entry;
    });
    if (completeCount !== document.completeCount || heldCount !== document.heldCount) {
        fail("HARDENED_LOCAL_MEMBER_COUNT", "local member entry statuses do not match declared counts");
    }
    const authority: LoadedLocalMemberAuthority = {
        localTypeMapSha256: String(document.localTypeMapSha256),
        declarationWorkerSha256: String(document.declarationWorkerSha256),
        sourceCensusSha256: String(document.sourceCensusSha256),
        completeCount, heldCount, entries, entriesByIdentity,
    };
    freeze(authority);
    AUTHORITIES.add(authority);
    return authority;
}

export function assertLoadedLocalMemberAuthority(value: LoadedLocalMemberAuthority): void {
    if (!object(value) || !AUTHORITIES.has(value)) {
        fail("HARDENED_LOCAL_MEMBER_AUTHORITY_INSTANCE", "local signatures require an immutable loaded member authority");
    }
}

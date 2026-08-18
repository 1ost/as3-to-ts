import { createHash } from "node:crypto";
import {
    closeSync,
    constants,
    fstatSync,
    lstatSync,
    openSync,
    readSync,
    realpathSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { loadCapabilityAuthority } from "../hardened/ledger";
import { loadLocalTypeAuthority } from "../hardened/local-types";
import { loadLocalMemberAuthority } from "../hardened/local-members";
import type { LoadedCapabilityAuthority, LoadedLocalMemberAuthority, LoadedLocalTypeAuthority } from "../hardened/contracts";
import { CliError } from "./errors";

const MAX_AUTHORITY_BYTES = 64 * 1024 * 1024;
const SHA256 = /^[0-9a-f]{64}$/;
const COMPILED_AUTHORITY_LOCK_SHA256 = "db7a64a6d4f9951ecec4dadf122f7d102a7b7b02dff0950f525c0eef2bb7cb58";
const COMPILED_LOCAL_TYPE_MAP_SHA256 = "1aab9ad6ba12187853af3668719e539108b0677d37c8de18649529a48214159f";
const COMPILED_LOCAL_TYPE_COUNT = 2923;
const COMPILED_DEPENDENCY_GRAPH_RAW_SHA256 = "11604f7e274113e26d14a4426364e278526efa8001e27d8dfd5a0e54b4caa184";
const COMPILED_DEPENDENCY_GRAPH_SEMANTIC_SHA256 = "3d0d7e0717708e2931bb9cf81de913aa21f5fe4b24babb2703edd9abdcb8f593";
const COMPILED_SOURCE_MANIFEST_SHA256 = "7e3e0475837a72fa730a37cbbb8a7863d146ec1c09debbbf23229dec5cd8a5e8";
const COMPILED_LOCAL_MEMBER_MAP_SHA256 = "f5d8d106d4edeefbd389d0a85fcb14012bbebf8494e517ab169016ca8a7cb19d";
const COMPILED_DECLARATION_WORKER_SHA256 = "f85389eb7ea24f250a229cda29f22e4f35c28cc06afbcf62746d6ca37d21af87";
const COMPILED_LOCAL_MEMBER_COMPLETE_COUNT = 2324;
const COMPILED_LOCAL_MEMBER_HELD_COUNT = 599;

const COMPILED_AUTHORITY_LOCK = Object.freeze({
    schema: "bleach-local-as3-authority-lock@1",
    upstreamParserRevision: "fa0b5151ab82758511ddd4b464f0c05b80e06da7",
    typeScriptVersion: "4.9.5",
    sourceCensusSha256: "2144b14090e51a1c0525ec3a35bfb8e532c6a19bb7ab355428ce70b4db7bde90",
    targetCapabilitiesSha256: "109405663cc7ee936008d29732026fc82a06460aff1e9f341cd761e6d12b5b54",
    capabilityMappingSha256: "cde1bd197ce4c67e3613f9ca8ee1e7eb96aa702744fe8b222c754fe1d0d13c8a",
    mappedTypeCount: 12,
    mappedMemberCount: 73,
});

export interface TranspileAuthority {
    authority: LoadedCapabilityAuthority;
    localTypes: LoadedLocalTypeAuthority;
    localMembers: LoadedLocalMemberAuthority;
    typeScriptVersion: string;
    sourceCensusSha256: string;
    targetCapabilitiesSha256: string;
    capabilityMappingSha256: string;
}

function sha256(bytes: string): string {
    return createHash("sha256").update(bytes, "utf8").digest("hex");
}

function readRegularUtf8(fileArgument: string, label: string): string {
    const lexical = resolve(fileArgument);
    let lexicalStat: ReturnType<typeof lstatSync>;
    try {
        lexicalStat = lstatSync(lexical);
    } catch {
        throw new CliError(`${label} does not exist`, 3);
    }
    if (!lexicalStat.isFile() || lexicalStat.isSymbolicLink() || lexicalStat.size > MAX_AUTHORITY_BYTES) {
        throw new CliError(`${label} must be an ordinary bounded file`, 3);
    }
    if (realpathSync.native(lexical) !== lexical) {
        throw new CliError(`${label} path must be canonical and contain no link alias`, 3);
    }
    const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
    const descriptor = openSync(lexical, constants.O_RDONLY | noFollow);
    try {
        const before = fstatSync(descriptor, { bigint: true });
        if (!before.isFile() || before.size > BigInt(MAX_AUTHORITY_BYTES)) {
            throw new CliError(`${label} must be an ordinary bounded file`, 3);
        }
        const expected = Number(before.size);
        const bytes = Buffer.allocUnsafe(expected + 1);
        let offset = 0;
        while (offset < bytes.length) {
            const count = readSync(descriptor, bytes, offset, bytes.length - offset, null);
            if (count === 0) break;
            offset += count;
        }
        const after = fstatSync(descriptor, { bigint: true });
        if (offset !== expected || before.dev !== after.dev || before.ino !== after.ino
            || before.size !== after.size || before.mtimeNs !== after.mtimeNs) {
            throw new CliError(`${label} changed while it was read`, 6);
        }
        const content = bytes.subarray(0, offset).toString("utf8");
        if (Buffer.from(content, "utf8").compare(bytes.subarray(0, offset)) !== 0) {
            throw new CliError(`${label} must be exact UTF-8`, 3);
        }
        return content.replace(/\r\n?/g, "\n");
    } finally {
        closeSync(descriptor);
    }
}

function exactLock(value: unknown): void {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new CliError("compiled authority lock has the wrong schema", 70);
    }
    const candidate = value as Record<string, unknown>;
    const expected = COMPILED_AUTHORITY_LOCK as unknown as Record<string, unknown>;
    const keys = Object.keys(expected).sort();
    const actual = Object.keys(candidate).sort();
    if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])
        || keys.some(key => candidate[key] !== expected[key])) {
        throw new CliError("local capability authority lock does not match the compiled trust root", 6);
    }
}

export function loadTranspileAuthority(
    sourceCensusPath: string,
    targetCapabilitiesPath: string,
): TranspileAuthority {
    const configRoot = resolve(join(__dirname, "..", "config"));
    const lockJson = readRegularUtf8(join(configRoot, "authority-lock.json"), "local authority lock");
    const mappingJson = readRegularUtf8(join(configRoot, "capability-map.json"), "local capability map");
    const localTypeJson = readRegularUtf8(join(configRoot, "local-type-map.json"), "local type map");
    const localMemberJson = readRegularUtf8(join(configRoot, "local-member-map.json"), "local member map");
    if (sha256(lockJson) !== COMPILED_AUTHORITY_LOCK_SHA256) {
        throw new CliError("local authority lock bytes do not match the compiled trust root", 6);
    }
    let lock: unknown;
    try {
        lock = JSON.parse(lockJson);
    } catch {
        throw new CliError("local authority lock is not JSON", 6);
    }
    exactLock(lock);
    const sourceCensusJson = readRegularUtf8(sourceCensusPath, "source capability census");
    const targetCapabilitiesJson = readRegularUtf8(targetCapabilitiesPath, "target capability ledger");
    for (const digest of [COMPILED_AUTHORITY_LOCK.sourceCensusSha256,
        COMPILED_AUTHORITY_LOCK.targetCapabilitiesSha256, COMPILED_AUTHORITY_LOCK.capabilityMappingSha256]) {
        if (!SHA256.test(digest)) throw new CliError("compiled authority digest is invalid", 70);
    }
    try {
        const authority = loadCapabilityAuthority({
            sourceCensusJson,
            sourceCensusSha256: COMPILED_AUTHORITY_LOCK.sourceCensusSha256,
            targetCapabilitiesJson,
            targetCapabilitiesSha256: COMPILED_AUTHORITY_LOCK.targetCapabilitiesSha256,
            mappingJson,
            mappingSha256: COMPILED_AUTHORITY_LOCK.capabilityMappingSha256,
        }, sha256);
        const localTypes = loadLocalTypeAuthority({
            json: localTypeJson,
            sha256: COMPILED_LOCAL_TYPE_MAP_SHA256,
            expectedEntryCount: COMPILED_LOCAL_TYPE_COUNT,
            expectedDependencyGraphRawSha256: COMPILED_DEPENDENCY_GRAPH_RAW_SHA256,
            expectedDependencyGraphSemanticSha256: COMPILED_DEPENDENCY_GRAPH_SEMANTIC_SHA256,
            expectedSourceManifestSha256: COMPILED_SOURCE_MANIFEST_SHA256,
        }, sha256);
        const localMembers = loadLocalMemberAuthority({
            json: localMemberJson,
            sha256: COMPILED_LOCAL_MEMBER_MAP_SHA256,
            expectedEntryCount: COMPILED_LOCAL_TYPE_COUNT,
            expectedCompleteCount: COMPILED_LOCAL_MEMBER_COMPLETE_COUNT,
            expectedHeldCount: COMPILED_LOCAL_MEMBER_HELD_COUNT,
            expectedLocalTypeMapSha256: COMPILED_LOCAL_TYPE_MAP_SHA256,
            expectedDeclarationWorkerSha256: COMPILED_DECLARATION_WORKER_SHA256,
        }, sha256, localTypes);
        if (Object.keys(authority.typeMappingsBySource).length !== COMPILED_AUTHORITY_LOCK.mappedTypeCount
            || Object.keys(authority.memberMappingsByKey).length !== COMPILED_AUTHORITY_LOCK.mappedMemberCount) {
            throw new CliError("loaded capability map count does not match the compiled authority lock", 6);
        }
        return Object.freeze({
            authority,
            localTypes,
            localMembers,
            typeScriptVersion: COMPILED_AUTHORITY_LOCK.typeScriptVersion,
            sourceCensusSha256: COMPILED_AUTHORITY_LOCK.sourceCensusSha256,
            targetCapabilitiesSha256: COMPILED_AUTHORITY_LOCK.targetCapabilitiesSha256,
            capabilityMappingSha256: COMPILED_AUTHORITY_LOCK.capabilityMappingSha256,
        });
    } catch (error) {
        if (error instanceof CliError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        throw new CliError(`capability authority rejected: ${message}`, 6);
    }
}

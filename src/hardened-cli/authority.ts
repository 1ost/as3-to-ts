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
import { loadMappedRuntimeTypeAuthority, type RuntimeAuthorityClassSource } from "../hardened/type-authority";
import type { LoadedCapabilityAuthority, LoadedLocalMemberAuthority, LoadedLocalTypeAuthority } from "../hardened/contracts";
import { CliError } from "./errors";

const MAX_AUTHORITY_BYTES = 64 * 1024 * 1024;
const SHA256 = /^[0-9a-f]{64}$/;
const COMPILED_AUTHORITY_LOCK_SHA256 = "e667d8cd027d2f21457fb4bbd32bcf066e9ddb929661d95302224a55a2a442ca";
const COMPILED_LOCAL_TYPE_MAP_SHA256 = "fe557887a0ea87d4549536c0a3afd708ac4877583dbf22a4ff77f4e5655869bf";
const COMPILED_LOCAL_TYPE_COUNT = 2923;
const COMPILED_DEPENDENCY_GRAPH_RAW_SHA256 = "05fe9549851f46366f4636ad4a5327876feb640fd815561bb0637c05dafd3d16";
const COMPILED_DEPENDENCY_GRAPH_SEMANTIC_SHA256 = "78957409f5bf7ec6894ad7c73af7bd3a2dcccfce930090f980f1e2d1d1db806f";
const COMPILED_SOURCE_MANIFEST_SHA256 = "7e3e0475837a72fa730a37cbbb8a7863d146ec1c09debbbf23229dec5cd8a5e8";
const COMPILED_LOCAL_MEMBER_MAP_SHA256 = "663beb2c386797966f1acf8b5248eae41e2b0a4e12b0887ef0990a46c1416b36";
const COMPILED_DECLARATION_WORKER_SHA256 = "87f04afe96e2713595eb8ed2998f158d43f57a65cbebb03d3a12be499f112db7";
const COMPILED_LOCAL_MEMBER_COMPLETE_COUNT = 2884;
const COMPILED_LOCAL_MEMBER_HELD_COUNT = 39;
const COMPILED_RUNTIME_TYPE_AUTHORITY_LOCK_SHA256 = "030721c45b89abbb7459c744ee191ec2d61b81e57526968313276b37b4a49824";
const COMPILED_RUNTIME_TYPE_PREDICATES_SHA256 = "7f42c4891177a400981b68793c6b637044c9354eb7401c36fa095ce870267ea0";
const COMPILED_LAYA_RUNTIME_REVISION = "7cdca8ac8c91d7cf1b21c0ec0c55b3b078c2f8fc";

const COMPILED_AUTHORITY_LOCK = Object.freeze({
    schema: "bleach-local-as3-authority-lock@1",
    upstreamParserRevision: "fa0b5151ab82758511ddd4b464f0c05b80e06da7",
    typeScriptVersion: "4.9.5",
    sourceCensusSha256: "69f054d0bd30b6a0955a4dae4b7ad3ce2d8d2e05958a37fed566778a8ec29858",
    targetCapabilitiesSha256: "50f96dd47947d6c223e3a3dd2877b6dff617770310e95b5e747cf6a535822bec",
    capabilityMappingSha256: "b082f8adfc0436b2a61a008ff6dd88e4683064e14917676fc4dbb14b21883560",
    mappedTypeCount: 30,
    mappedMemberCount: 138,
});

export interface TranspileAuthority {
    authority: LoadedCapabilityAuthority;
    localTypes: LoadedLocalTypeAuthority;
    localMembers: LoadedLocalMemberAuthority;
    typeScriptVersion: string;
    sourceCensusSha256: string;
    targetCapabilitiesSha256: string;
    capabilityMappingSha256: string;
    runtimeTypeSources: readonly RuntimeAuthorityClassSource[];
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
    const runtimeTypeLockJson = readRegularUtf8(join(configRoot, "runtime-type-authority-lock.json"), "runtime type authority lock");
    const runtimeTypePredicatesJson = readRegularUtf8(join(configRoot, "runtime-type-predicates.json"), "runtime type predicate authority");
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
    if (sha256(runtimeTypeLockJson) !== COMPILED_RUNTIME_TYPE_AUTHORITY_LOCK_SHA256
        || sha256(runtimeTypePredicatesJson) !== COMPILED_RUNTIME_TYPE_PREDICATES_SHA256) {
        throw new CliError("runtime type authority bytes do not match the compiled trust root", 6);
    }
    let runtimeTypeLock: unknown;
    try { runtimeTypeLock = JSON.parse(runtimeTypeLockJson); } catch {
        throw new CliError("runtime type authority lock is not JSON", 6);
    }
    if (!runtimeTypeLock || typeof runtimeTypeLock !== "object" || Array.isArray(runtimeTypeLock)) {
        throw new CliError("runtime type authority lock has the wrong schema", 6);
    }
    const runtimeLock = runtimeTypeLock as Record<string, unknown>;
    if (runtimeLock.layaRevision !== COMPILED_LAYA_RUNTIME_REVISION
        || !Array.isArray(runtimeLock.predicateAuthorityQNames)
        || runtimeLock.predicateAuthorityQNames.length !== 27
        || runtimeLock.predicateAuthorityQNames.some(name => typeof name !== "string")) {
        throw new CliError("runtime type authority lock does not match the compiled Laya identity set", 6);
    }
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
            expectedSourceCensusSha256: COMPILED_AUTHORITY_LOCK.sourceCensusSha256,
        }, sha256, localTypes);
        if (Object.keys(authority.typeMappingsBySource).length !== COMPILED_AUTHORITY_LOCK.mappedTypeCount
            || Object.keys(authority.memberMappingsByKey).length !== COMPILED_AUTHORITY_LOCK.mappedMemberCount) {
            throw new CliError("loaded capability map count does not match the compiled authority lock", 6);
        }
        const runtimeTypeSources = loadMappedRuntimeTypeAuthority(runtimeTypeLockJson, runtimeTypePredicatesJson,
            runtimeLock.predicateAuthorityQNames as string[], sha256);
        return Object.freeze({
            authority,
            localTypes,
            localMembers,
            typeScriptVersion: COMPILED_AUTHORITY_LOCK.typeScriptVersion,
            sourceCensusSha256: COMPILED_AUTHORITY_LOCK.sourceCensusSha256,
            targetCapabilitiesSha256: COMPILED_AUTHORITY_LOCK.targetCapabilitiesSha256,
            capabilityMappingSha256: COMPILED_AUTHORITY_LOCK.capabilityMappingSha256,
            runtimeTypeSources,
        });
    } catch (error) {
        if (error instanceof CliError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        throw new CliError(`capability authority rejected: ${message}`, 6);
    }
}

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
const COMPILED_AUTHORITY_LOCK_SHA256 = "ee7edaeddf974f67a029561f2295d0c6d27a6c2dd0501012bf388cc5572fc210";
const COMPILED_LOCAL_TYPE_MAP_SHA256 = "fe557887a0ea87d4549536c0a3afd708ac4877583dbf22a4ff77f4e5655869bf";
const COMPILED_NATIVE_TIMER_AUTHORITY_SHA256 = "04b91e7075f8eba0c4e20be272c28513010df48e2954db521369146cc89c2d77";
const COMPILED_LOCAL_TYPE_COUNT = 2923;
const COMPILED_DEPENDENCY_GRAPH_RAW_SHA256 = "05fe9549851f46366f4636ad4a5327876feb640fd815561bb0637c05dafd3d16";
const COMPILED_DEPENDENCY_GRAPH_SEMANTIC_SHA256 = "78957409f5bf7ec6894ad7c73af7bd3a2dcccfce930090f980f1e2d1d1db806f";
const COMPILED_SOURCE_MANIFEST_SHA256 = "7e3e0475837a72fa730a37cbbb8a7863d146ec1c09debbbf23229dec5cd8a5e8";
const COMPILED_LOCAL_MEMBER_MAP_SHA256 = "663beb2c386797966f1acf8b5248eae41e2b0a4e12b0887ef0990a46c1416b36";
const COMPILED_DECLARATION_WORKER_SHA256 = "87f04afe96e2713595eb8ed2998f158d43f57a65cbebb03d3a12be499f112db7";
const COMPILED_LOCAL_MEMBER_COMPLETE_COUNT = 2884;
const COMPILED_LOCAL_MEMBER_HELD_COUNT = 39;
const COMPILED_RUNTIME_TYPE_AUTHORITY_LOCK_SHA256 = "b7b1269ed917a945f0215a264c814a7282d735ba870b9b2b958b61f047965a29";
const COMPILED_RUNTIME_TYPE_PREDICATES_SHA256 = "6e97bb0b9f46c7e112408f69da2683d6c5c49276a4322f14e772c4bc215fa976";
const COMPILED_LAYA_RUNTIME_REVISION = "ecade82aa369d890730c4dc847f9d769d74e8878";

const COMPILED_AUTHORITY_LOCK = Object.freeze({
    schema: "bleach-local-as3-authority-lock@1",
    upstreamParserRevision: "fa0b5151ab82758511ddd4b464f0c05b80e06da7",
    typeScriptVersion: "4.9.5",
    sourceCensusSha256: "69f054d0bd30b6a0955a4dae4b7ad3ce2d8d2e05958a37fed566778a8ec29858",
    targetCapabilitiesSha256: "4c641d5beda0f3acbb517517ff76fa14019ddf2dc17b933b896853818a9a27e2",
    capabilityMappingSha256: "a9d355200aab8c78453d9d53e8f9b55c3b0c6340753538403e6edeae3c252b42",
    mappedTypeCount: 40,
    mappedMemberCount: 152,
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
    nativeTimerAuthoritySha256: string;
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
    const nativeTimerAuthorityJson = readRegularUtf8(join(configRoot, "native-timer-authority.json"),
        "native timer authority");
    if (sha256(nativeTimerAuthorityJson) !== COMPILED_NATIVE_TIMER_AUTHORITY_SHA256) {
        throw new CliError("native timer authority bytes do not match the compiled trust root", 6);
    }
    let nativeTimerReceipt: unknown;
    try {
        nativeTimerReceipt = JSON.parse(nativeTimerAuthorityJson);
    } catch {
        throw new CliError("native timer authority is not JSON", 6);
    }
    if (!nativeTimerReceipt || typeof nativeTimerReceipt !== "object" || Array.isArray(nativeTimerReceipt)
        || (nativeTimerReceipt as Record<string, unknown>).sourcePath !== "src/hardened-runtime/AS3Timer.ts"
        || typeof (nativeTimerReceipt as Record<string, unknown>).sourceSha256 !== "string") {
        throw new CliError("native timer authority does not identify the compiled target source", 6);
    }
    const nativeTimerSource = readRegularUtf8(join(configRoot, "..", "src", "hardened-runtime", "AS3Timer.ts"),
        "native timer target source");
    if (sha256(nativeTimerSource) !== (nativeTimerReceipt as Record<string, unknown>).sourceSha256) {
        throw new CliError("native timer target source does not match its authenticated receipt", 6);
    }
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
        || runtimeLock.predicateAuthorityQNames.length !== 28
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
            nativeTimerAuthorityJson,
            nativeTimerAuthoritySha256: COMPILED_NATIVE_TIMER_AUTHORITY_SHA256,
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
            nativeTimerAuthoritySha256: COMPILED_NATIVE_TIMER_AUTHORITY_SHA256,
        });
    } catch (error) {
        if (error instanceof CliError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        throw new CliError(`capability authority rejected: ${message}`, 6);
    }
}

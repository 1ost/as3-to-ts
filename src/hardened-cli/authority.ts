import {loadByteArrayAMF3Target} from "../hardened/bytearray-amf3-authority";
import { verifyNativeRegExpAuthority } from "../hardened/native-regexp-authority";
import {loadCompileDefinitions} from "../hardened/compile-definitions";
import {loadJSONDefinitionProviderTarget} from "../hardened/json-definition-provider-authority";
import {loadTypeErrorProviderTarget} from "../hardened/type-error-provider-authority";
import {loadMathFloorProviderTarget} from "../hardened/math-floor-provider-authority";
import {loadObjectConstructorProviderTarget} from "../hardened/object-constructor-provider-authority";
import {loadObjectHasOwnPropertyProviderTarget} from "../hardened/object-has-own-provider-authority";
import {loadArraySortProviderTarget} from "../hardened/array-sort-provider-authority";
import {loadArraySomeProviderTarget} from "../hardened/array-some-provider-authority";
import {loadErrorStackProviderTarget} from "../hardened/error-stack-provider-authority";
import {loadStringRangeProviderTarget} from "../hardened/string-range-provider-authority";
import {loadXMLStaticLiteralProviderTarget} from "../hardened/xml-static-literal-provider-authority";
import {loadDateProviderTarget} from "../hardened/date-provider-authority";
import {loadStringPatternProviderTarget} from "../hardened/string-pattern-provider-authority";
import {loadSourceIncludes} from "./source-includes-authority";
import { verifyNativeDescribeTypeAuthority } from "../hardened/native-describe-type-authority";
import {verifyNativeUriComponentAuthority} from "../hardened/native-uri-component-authority";
import { loadReflectionProviderTarget, type ReflectionProviderTarget } from "../hardened/reflection-provider-authority";
import { verifyNativeDateAuthority } from "../hardened/native-date-authority";
import { loadByteArrayNativeTarget } from "../hardened/bytearray-native-authority";
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
import { dirname, isAbsolute, join, resolve } from "node:path";
import { loadCapabilityAuthority } from "../hardened/ledger";
import { loadLocalTypeAuthority } from "../hardened/local-types";
import { loadLocalMemberAuthority } from "../hardened/local-members";
import { loadMappedRuntimeTypeAuthority, withNativeObjectMemberCensus, type RuntimeAuthoritySource } from "../hardened/type-authority";
import { loadSourceMemberAuthority, type LoadedSourceMemberAuthority } from "../hardened/source-member-authority";
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
const COMPILED_RUNTIME_TYPE_AUTHORITY_LOCK_SHA256 = "14b1446b18d9453f168621789eab9f235cc8ce22c80b37808e48063ea06d19e5";
const COMPILED_RUNTIME_TYPE_PREDICATES_SHA256 = "010dad6303ba5a6014f33c28b29fb9713f76b4698d82d155249b01858f469ae7";
const COMPILED_LAYA_RUNTIME_REVISION = "a3f690b422043c744e1146e7aaf88f1620f2d4e3";

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
    compileDefinitions?: import("../hardened/compile-definitions").CompileDefinitions;
    applicationStart?: import("../hardened/contracts").ApplicationStartContract;
    sourceIncludes?: ReturnType<typeof loadSourceIncludes>;
    reflectionProvider?: ReflectionProviderTarget;
    authority: LoadedCapabilityAuthority;
    localTypes: LoadedLocalTypeAuthority;
    localMembers: LoadedLocalMemberAuthority;
    typeScriptVersion: string;
    sourceCensusSha256: string;
    targetCapabilitiesSha256: string;
    capabilityMappingSha256: string;
    runtimeTypeSources: readonly RuntimeAuthoritySource[];
    sourceMembers: LoadedSourceMemberAuthority | null;
    nativeTimerAuthoritySha256: string;
    runtimePackage: string;
    profileSha256: string | null;
    applicationId: string;
    includeBigTurnTableDto: boolean;
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

function loadCompiledTranspileAuthority(
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
            runtimePackage: "@bleach/as3-runtime",
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
            sourceMembers: null,
            nativeTimerAuthoritySha256: COMPILED_NATIVE_TIMER_AUTHORITY_SHA256,
            runtimePackage: "@bleach/as3-runtime",
            profileSha256: null,
            applicationId: "bleach",
            includeBigTurnTableDto: true,
        });
    } catch (error) {
        if (error instanceof CliError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        throw new CliError(`capability authority rejected: ${message}`, 6);
    }
}

function canonical(value: unknown): string {
    if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
    if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
    }
    throw new CliError("application profile contains a non-JSON value", 6);
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

interface ProfileFile { path: string; sha256: string }

function profileFile(root: string, value: unknown, label: string): string {
    if (!exactKeys(value, ["path", "sha256"]) || typeof value.path !== "string"
        || value.path.length === 0 || isAbsolute(value.path) || value.path.includes("\\")
        || value.path.split("/").some(segment => segment === "" || segment === "." || segment === "..")
        || typeof value.sha256 !== "string" || !SHA256.test(value.sha256)) {
        throw new CliError(`${label} profile file reference is invalid`, 6);
    }
    const bytes = readRegularUtf8(join(root, ...value.path.split("/")), label);
    if (sha256(bytes) !== value.sha256) throw new CliError(`${label} bytes do not match the application profile`, 6);
    return bytes;
}

function parseProfileDocument(bytes: string, label: string): Record<string, unknown> {
    let value: unknown;
    try { value = JSON.parse(bytes); } catch { throw new CliError(`${label} is not JSON`, 6); }
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new CliError(`${label} has the wrong schema`, 6);
    return value as Record<string, unknown>;
}


function loadApplicationTranspileAuthority(sourceCensusPath: string, targetCapabilitiesPath: string,
    profileLockPath: string): TranspileAuthority {
    const profileJson = readRegularUtf8(profileLockPath, "application profile lock");
    if (`${canonical(JSON.parse(profileJson))}\n` !== profileJson) {
        throw new CliError("application profile lock must be canonical JSON with one trailing LF", 6);
    }
    const profile = parseProfileDocument(profileJson, "application profile lock");
    const profileSchema=profile.schema;
    const applicationStart=profile.applicationStart;
    const profileKeys=["applicationId", "counts", "files", "runtimePackage", "runtimePredicateQNames",
        "schema", "sourceCensusSha256", "sourceRoots", "targetCapabilitiesSha256", "targetRoots", "typeScriptVersion",
        ...(profileSchema==="as3-application-profile-lock@2"?["applicationStart"]:[])];
    if (!exactKeys(profile, profileKeys)
        || (profileSchema !== "as3-application-profile-lock@1"&&profileSchema!=="as3-application-profile-lock@2")
        || (profileSchema==="as3-application-profile-lock@2"&&(!exactKeys(applicationStart,
            ["cancellation","constructorArguments","exportName","qname","result","schema"])
            ||applicationStart.schema!=="as3-application-start-contract@1"
            ||typeof applicationStart.qname!=="string"||!/^(?:[A-Za-z_$][A-Za-z0-9_$]*\.)*[A-Za-z_$][A-Za-z0-9_$]*$/.test(applicationStart.qname)
            ||applicationStart.exportName!=="startAS3Application"
            ||!Array.isArray(applicationStart.constructorArguments)||applicationStart.constructorArguments.length!==0
            ||applicationStart.cancellation!=="abort-signal-before-construction@1"
            ||applicationStart.result!=="constructed-instance"))
        || typeof profile.applicationId !== "string" || !/^[a-z][a-z0-9-]{1,63}$/.test(profile.applicationId)
        || profile.typeScriptVersion !== "4.9.5"
        || typeof profile.runtimePackage !== "string"
        || !/^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/.test(profile.runtimePackage)
        || typeof profile.sourceCensusSha256 !== "string" || !SHA256.test(profile.sourceCensusSha256)
        || typeof profile.targetCapabilitiesSha256 !== "string" || !SHA256.test(profile.targetCapabilitiesSha256)
        || !exactKeys(profile.sourceRoots, ["application", "bootstrap"])
        || !exactKeys(profile.targetRoots, ["application", "bootstrap"])
        || !exactKeys(profile.files, ["capabilityMapping", "dependencyGraphRaw", "dependencyGraphSemantic",
            "localMemberMap", "localTypeMap", "nativeTimerAuthority", "runtimeTypeAuthorityLock",
            "runtimeTypePredicates", "sourceManifest", "sourceMemberAuthority"].concat(
                Object.prototype.hasOwnProperty.call(profile.files,"byteArrayNative") ? ["byteArrayNative"] : [],
                Object.prototype.hasOwnProperty.call(profile.files,"nativeRegExp") ? ["nativeRegExp"] : [],
                Object.prototype.hasOwnProperty.call(profile.files,"stringRangeProvider") ? ["stringRangeProvider"] : [],
                Object.prototype.hasOwnProperty.call(profile.files,"xmlStaticLiteralProvider") ? ["xmlStaticLiteralProvider"] : [],
                Object.prototype.hasOwnProperty.call(profile.files,"arraySortProvider") ? ["arraySortProvider"] : [],
                Object.prototype.hasOwnProperty.call(profile.files,"arraySomeProvider") ? ["arraySomeProvider"] : [],
                Object.prototype.hasOwnProperty.call(profile.files,"errorStackProvider") ? ["errorStackProvider"] : [],
                Object.prototype.hasOwnProperty.call(profile.files,"mathFloorProvider") ? ["mathFloorProvider"] : [],
                Object.prototype.hasOwnProperty.call(profile.files,"objectConstructorProvider") ? ["objectConstructorProvider"] : [],
                Object.prototype.hasOwnProperty.call(profile.files,"objectHasOwnPropertyProvider") ? ["objectHasOwnPropertyProvider"] : [],
                Object.prototype.hasOwnProperty.call(profile.files,"typeErrorProvider") ? ["typeErrorProvider"] : [],
                Object.prototype.hasOwnProperty.call(profile.files,"jsonDefinitionProvider") ? ["jsonDefinitionProvider"] : [],
                Object.prototype.hasOwnProperty.call(profile.files,"byteArrayAMF3") ? ["byteArrayAMF3"] : [],
                Object.prototype.hasOwnProperty.call(profile.files,"dateProvider") ? ["dateProvider"] : [],
                Object.prototype.hasOwnProperty.call(profile.files,"nativeDate") ? ["nativeDate"] : [],
                Object.prototype.hasOwnProperty.call(profile.files,"sourceIncludes") ? ["sourceIncludes"] : [],
                Object.prototype.hasOwnProperty.call(profile.files,"compileDefinitions") ? ["compileDefinitions"] : [],
                Object.prototype.hasOwnProperty.call(profile.files,"nativeDescribeType") ? ["nativeDescribeType"] : [],
                Object.prototype.hasOwnProperty.call(profile.files,"nativeUriComponent") ? ["nativeUriComponent"] : [],
                Object.prototype.hasOwnProperty.call(profile.files,"reflectionProvider") ? ["reflectionProvider"] : [],
                Object.prototype.hasOwnProperty.call(profile.files,"stringPatternProvider") ? ["stringPatternProvider"] : []))
        || !exactKeys(profile.counts, ["localMembersComplete", "localMembersHeld", "localTypes", "mappedMembers", "mappedTypes", "sourceMemberTypes"])
        || !Array.isArray(profile.runtimePredicateQNames)
        || profile.runtimePredicateQNames.some(value => typeof value !== "string")) {
        throw new CliError("application profile lock has the wrong closed schema", 6);
    }
    const sourceRoots = profile.sourceRoots as Record<"application" | "bootstrap", string>;
    const targetRoots = profile.targetRoots as Record<"application" | "bootstrap", string>;
    const profileRoot = dirname(resolve(profileLockPath));
    const files = profile.files as unknown as {
        capabilityMapping: ProfileFile; dependencyGraphRaw: ProfileFile; dependencyGraphSemantic: ProfileFile;
        localTypeMap: ProfileFile; localMemberMap: ProfileFile; nativeTimerAuthority: ProfileFile; byteArrayNative?: ProfileFile; nativeDate?: ProfileFile; dateProvider?: ProfileFile; stringRangeProvider?: ProfileFile; xmlStaticLiteralProvider?: ProfileFile; arraySortProvider?: ProfileFile; arraySomeProvider?: ProfileFile; errorStackProvider?: ProfileFile; mathFloorProvider?: ProfileFile; objectConstructorProvider?: ProfileFile; objectHasOwnPropertyProvider?: ProfileFile; typeErrorProvider?: ProfileFile; jsonDefinitionProvider?: ProfileFile; byteArrayAMF3?: ProfileFile; nativeRegExp?: ProfileFile; sourceIncludes?: ProfileFile; compileDefinitions?: ProfileFile; nativeDescribeType?: ProfileFile; nativeUriComponent?: ProfileFile; reflectionProvider?: ProfileFile; stringPatternProvider?: ProfileFile;
        runtimeTypeAuthorityLock: ProfileFile; runtimeTypePredicates: ProfileFile; sourceManifest: ProfileFile;
        sourceMemberAuthority: ProfileFile;
    };
    const mappingJson = profileFile(profileRoot, files.capabilityMapping, "profile capability map");
    const dependencyGraphRawJson = profileFile(profileRoot, files.dependencyGraphRaw, "profile raw dependency graph");
    const dependencyGraphSemanticJson = profileFile(profileRoot, files.dependencyGraphSemantic,
        "profile semantic dependency graph");
    const localTypeJson = profileFile(profileRoot, files.localTypeMap, "profile local type map");
    const localMemberJson = profileFile(profileRoot, files.localMemberMap, "profile local member map");
    const nativeTimerAuthorityJson = profileFile(profileRoot, files.nativeTimerAuthority, "profile native timer authority");
    const runtimeTypeLockJson = profileFile(profileRoot, files.runtimeTypeAuthorityLock, "profile runtime type lock");
    const runtimeTypePredicatesJson = profileFile(profileRoot, files.runtimeTypePredicates, "profile runtime type predicates");
    const compileDefinitions = files.compileDefinitions ? loadCompileDefinitions(profileFile(profileRoot,files.compileDefinitions,"compile definitions")) : undefined;
    const sourceIncludes = files.sourceIncludes ? loadSourceIncludes(profileFile(profileRoot,files.sourceIncludes,"source includes")) : undefined;
    const sourceManifestJson = profileFile(profileRoot, files.sourceManifest, "profile source manifest");
    const sourceMemberAuthorityJson = profileFile(profileRoot, files.sourceMemberAuthority,
        "profile source member authority");
    const sourceCensusJson = readRegularUtf8(sourceCensusPath, "source capability census");
    const targetCapabilitiesJson = readRegularUtf8(targetCapabilitiesPath, "target capability ledger");
    if (sha256(sourceCensusJson) !== profile.sourceCensusSha256
        || sha256(targetCapabilitiesJson) !== profile.targetCapabilitiesSha256) {
        throw new CliError("application input authority bytes do not match the profile lock", 6);
    }
    const localType = parseProfileDocument(localTypeJson, "profile local type map");
    const localMember = parseProfileDocument(localMemberJson, "profile local member map");
    const runtimeLock = parseProfileDocument(runtimeTypeLockJson, "profile runtime type lock");
    const counts = profile.counts as unknown as {
        localMembersComplete: number; localMembersHeld: number; localTypes: number;
        mappedMembers: number; mappedTypes: number; sourceMemberTypes: number;
    };
    if (!Object.values(counts).every(value => Number.isInteger(value) && value >= 0)
        || localType.entryCount !== counts.localTypes || localMember.entryCount !== counts.localTypes
        || localMember.completeCount !== counts.localMembersComplete || localMember.heldCount !== counts.localMembersHeld
        || localType.dependencyGraphRawSha256 !== sha256(dependencyGraphRawJson)
        || localType.dependencyGraphSemanticSha256 !== sha256(dependencyGraphSemanticJson)
        || localType.sourceManifestSha256 !== sha256(sourceManifestJson)
        || runtimeLock.layaRevision === undefined
        || JSON.stringify(runtimeLock.predicateAuthorityQNames) !== JSON.stringify(profile.runtimePredicateQNames)) {
        throw new CliError("application profile counts or runtime identity set do not match its pinned files", 6);
    }
    try {
        const reflectionProvider=files.reflectionProvider ? loadReflectionProviderTarget(
            profileFile(profileRoot,files.reflectionProvider,"reflection provider proof"),targetCapabilitiesPath,targetCapabilitiesJson) : undefined;
        const byteArrayNative=files.byteArrayNative ? loadByteArrayNativeTarget(profileRoot,
            profileFile(profileRoot,files.byteArrayNative,"native ByteArray proof"),targetCapabilitiesPath,
            targetCapabilitiesJson,sourceMemberAuthorityJson,
            profileFile(profileRoot,files.sourceManifest,"source manifest")) : undefined;
        const stringRangeProvider=files.stringRangeProvider ? loadStringRangeProviderTarget(
            profileFile(profileRoot,files.stringRangeProvider,"String range provider proof"),targetCapabilitiesPath,targetCapabilitiesJson) : undefined;
        const xmlStaticLiteralProvider=files.xmlStaticLiteralProvider ? loadXMLStaticLiteralProviderTarget(
            profileFile(profileRoot,files.xmlStaticLiteralProvider,"XML static literal provider proof"),targetCapabilitiesPath,targetCapabilitiesJson) : undefined;
        const jsonDefinitionProvider=files.jsonDefinitionProvider ? loadJSONDefinitionProviderTarget(
            profileFile(profileRoot,files.jsonDefinitionProvider,"JSON definition provider proof"),targetCapabilitiesPath,targetCapabilitiesJson,sourceMemberAuthorityJson) : undefined;
        const typeErrorProvider=files.typeErrorProvider ? loadTypeErrorProviderTarget(
            profileFile(profileRoot,files.typeErrorProvider,"TypeError provider proof"),targetCapabilitiesPath,targetCapabilitiesJson,sourceMemberAuthorityJson) : undefined;
        const mathFloorProvider=files.mathFloorProvider ? loadMathFloorProviderTarget(
            profileFile(profileRoot,files.mathFloorProvider,"Math floor provider proof"),targetCapabilitiesPath,targetCapabilitiesJson) : undefined;
        const objectConstructorProvider=files.objectConstructorProvider ? loadObjectConstructorProviderTarget(
            profileFile(profileRoot,files.objectConstructorProvider,"Object constructor provider proof"),targetCapabilitiesPath,targetCapabilitiesJson) : undefined;
        const objectHasOwnPropertyProvider=files.objectHasOwnPropertyProvider ? loadObjectHasOwnPropertyProviderTarget(
            profileFile(profileRoot,files.objectHasOwnPropertyProvider,"Object hasOwnProperty provider proof"),targetCapabilitiesPath,targetCapabilitiesJson) : undefined;
        const arraySortProvider=files.arraySortProvider ? loadArraySortProviderTarget(
            profileFile(profileRoot,files.arraySortProvider,"Array sort provider proof"),targetCapabilitiesPath,targetCapabilitiesJson) : undefined;
        const arraySomeProvider=files.arraySomeProvider ? loadArraySomeProviderTarget(
            profileFile(profileRoot,files.arraySomeProvider,"Array some provider proof"),targetCapabilitiesPath,targetCapabilitiesJson) : undefined;
        const errorStackProvider=files.errorStackProvider ? loadErrorStackProviderTarget(
            profileFile(profileRoot,files.errorStackProvider,"Error stack provider proof"),targetCapabilitiesPath,targetCapabilitiesJson,sourceMemberAuthorityJson) : undefined;
        const byteArrayAMF3=files.byteArrayAMF3 ? loadByteArrayAMF3Target(
            profileFile(profileRoot,files.byteArrayAMF3,"ByteArray AMF3 provider proof"),targetCapabilitiesPath,targetCapabilitiesJson,byteArrayNative) : undefined;
        const dateProvider=files.dateProvider ? loadDateProviderTarget(
            profileFile(profileRoot,files.dateProvider,"Date provider proof"),targetCapabilitiesPath,targetCapabilitiesJson) : undefined;
        if (dateProvider && !files.nativeDate) throw new CliError("Date provider requires native SDK Date proof",6);
        const stringPatternProvider=files.stringPatternProvider ? loadStringPatternProviderTarget(
            profileFile(profileRoot,files.stringPatternProvider,"String pattern provider proof"),targetCapabilitiesPath,targetCapabilitiesJson) : undefined;
        const authority = loadCapabilityAuthority({
            sourceCensusJson, sourceCensusSha256: profile.sourceCensusSha256 as string,
            targetCapabilitiesJson, targetCapabilitiesSha256: profile.targetCapabilitiesSha256 as string,
            mappingJson, mappingSha256: files.capabilityMapping.sha256,
            nativeTimerAuthorityJson, nativeTimerAuthoritySha256: files.nativeTimerAuthority.sha256,
            runtimePackage: profile.runtimePackage as string, applicationProfile: true,
            ...(byteArrayNative ? { byteArrayNative } : {}),
            ...(stringRangeProvider ? {stringRangeProvider} : {}),
            ...(xmlStaticLiteralProvider ? {xmlStaticLiteralProvider} : {}),
            ...(arraySortProvider ? {arraySortProvider} : {}),
            ...(arraySomeProvider ? {arraySomeProvider} : {}),
            ...(errorStackProvider ? {errorStackProvider} : {}),
            ...(mathFloorProvider ? {mathFloorProvider} : {}),
            ...(objectConstructorProvider ? {objectConstructorProvider} : {}),
            ...(objectHasOwnPropertyProvider ? {objectHasOwnPropertyProvider} : {}),
            ...(typeErrorProvider ? {typeErrorProvider} : {}),
            ...(jsonDefinitionProvider ? {jsonDefinitionProvider} : {}),
            ...(byteArrayAMF3 ? {byteArrayAMF3} : {}),
            ...(dateProvider ? {dateProvider} : {}),
            ...(stringPatternProvider ? {stringPatternProvider} : {}),
        }, sha256);
        const localTypes = loadLocalTypeAuthority({
            json: localTypeJson, sha256: files.localTypeMap.sha256,
            expectedEntryCount: counts.localTypes,
            expectedDependencyGraphRawSha256: String(localType.dependencyGraphRawSha256),
            expectedDependencyGraphSemanticSha256: String(localType.dependencyGraphSemanticSha256),
            expectedSourceManifestSha256: String(localType.sourceManifestSha256),
            expectedSchema: "as3-application-local-type-map@1", expectedSourceRoots: sourceRoots,
            expectedTargetRoots: targetRoots,
        }, sha256);
        const localMembers = loadLocalMemberAuthority({
            json: localMemberJson, sha256: files.localMemberMap.sha256,
            expectedEntryCount: counts.localTypes, expectedCompleteCount: counts.localMembersComplete,
            expectedHeldCount: counts.localMembersHeld,
            expectedLocalTypeMapSha256: files.localTypeMap.sha256,
            expectedDeclarationWorkerSha256: String(localMember.declarationWorkerSha256),
            expectedSourceCensusSha256: profile.sourceCensusSha256 as string,
            expectedSchema: "as3-application-local-member-map@1",
            ...(files.sourceIncludes ? {expectedSourceIncludesSha256:files.sourceIncludes.sha256} : {}),
            ...(files.compileDefinitions ? {expectedCompileDefinitionsSha256:files.compileDefinitions.sha256} : {}),
        }, sha256, localTypes);
        if (Object.keys(authority.typeMappingsBySource).length !== counts.mappedTypes
            || Object.keys(authority.memberMappingsByKey).length !== counts.mappedMembers) {
            throw new CliError("application capability counts differ from the profile lock", 6);
        }
        const runtimeTypeSources = loadMappedRuntimeTypeAuthority(runtimeTypeLockJson, runtimeTypePredicatesJson,
            profile.runtimePredicateQNames as string[], sha256);
        const sourceMembers = loadSourceMemberAuthority(sourceMemberAuthorityJson,
            files.sourceMemberAuthority.sha256, sha256);
        if(files.nativeRegExp) verifyNativeRegExpAuthority(sourceMembers,profileRoot,
            profileFile(profileRoot,files.nativeRegExp,"native RegExp proof"),sourceManifestJson);
        if(files.nativeDate) verifyNativeDateAuthority(sourceMembers,profileRoot,
            profileFile(profileRoot,files.nativeDate,"native Date proof"),sourceManifestJson);
        if (files.nativeDescribeType) {
            if (!reflectionProvider) throw new CliError("native describeType requires a verified reflection provider", 6);
            verifyNativeDescribeTypeAuthority(sourceMembers, profileRoot,
                profileFile(profileRoot, files.nativeDescribeType, "native describeType proof"),
                sourceManifestJson, reflectionProvider, targetCapabilitiesJson);
        }
        if(files.nativeUriComponent) verifyNativeUriComponentAuthority(sourceMembers,profileRoot,
            profileFile(profileRoot,files.nativeUriComponent,"native URI component proof"),sourceManifestJson,targetCapabilitiesJson);
        if (Object.keys(sourceMembers.entriesByQName).length !== counts.sourceMemberTypes) {
            throw new CliError("application source member count differs from the profile lock", 6);
        }
        return Object.freeze({
            ...(profileSchema==="as3-application-profile-lock@2"?{applicationStart:Object.freeze({
                schema:"as3-application-start-contract@1" as const,qname:(applicationStart as Record<string,unknown>).qname as string,
                exportName:"startAS3Application" as const,constructorArguments:Object.freeze([]) as readonly [],
                cancellation:"abort-signal-before-construction@1" as const,result:"constructed-instance" as const})}:{}),
            authority, localTypes, localMembers, ...(reflectionProvider ? {reflectionProvider} : {}), typeScriptVersion: profile.typeScriptVersion as string,
            sourceCensusSha256: profile.sourceCensusSha256 as string,
            targetCapabilitiesSha256: profile.targetCapabilitiesSha256 as string,
            capabilityMappingSha256: files.capabilityMapping.sha256,
            runtimeTypeSources: withNativeObjectMemberCensus(runtimeTypeSources, sourceMembers), sourceMembers,
            ...(sourceIncludes ? {sourceIncludes} : {}),
            ...(compileDefinitions ? {compileDefinitions} : {}),
            nativeTimerAuthoritySha256: files.nativeTimerAuthority.sha256,
            runtimePackage: profile.runtimePackage as string, profileSha256: sha256(profileJson),
            applicationId: profile.applicationId as string, includeBigTurnTableDto: false,
        });
    } catch (error) {
        if (error instanceof CliError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        throw new CliError(`application capability authority rejected: ${message}`, 6);
    }
}

export function loadTranspileAuthority(sourceCensusPath: string, targetCapabilitiesPath: string,
    profileLockPath?: string): TranspileAuthority {
    return profileLockPath === undefined
        ? loadCompiledTranspileAuthority(sourceCensusPath, targetCapabilitiesPath)
        : loadApplicationTranspileAuthority(sourceCensusPath, targetCapabilitiesPath, profileLockPath);
}

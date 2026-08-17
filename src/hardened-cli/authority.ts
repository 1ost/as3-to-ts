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
import type { LoadedCapabilityAuthority } from "../hardened/contracts";
import { CliError } from "./errors";

const MAX_AUTHORITY_BYTES = 64 * 1024 * 1024;
const SHA256 = /^[0-9a-f]{64}$/;
const COMPILED_AUTHORITY_LOCK_SHA256 = "e64a5446511f0b0f773decc8d83282045d745a350770651a5f087ac516178ebd";

const COMPILED_AUTHORITY_LOCK = Object.freeze({
    schema: "bleach-local-as3-authority-lock@1",
    upstreamParserRevision: "fa0b5151ab82758511ddd4b464f0c05b80e06da7",
    typeScriptVersion: "4.9.5",
    sourceCensusSha256: "2144b14090e51a1c0525ec3a35bfb8e532c6a19bb7ab355428ce70b4db7bde90",
    targetCapabilitiesSha256: "c364d4a0fce5df16033980a3eba4e7a72d658993eef0f3675ea9771c9eba86d2",
    capabilityMappingSha256: "cde1bd197ce4c67e3613f9ca8ee1e7eb96aa702744fe8b222c754fe1d0d13c8a",
    mappedTypeCount: 12,
    mappedMemberCount: 73,
});

export interface TranspileAuthority {
    authority: LoadedCapabilityAuthority;
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
        return content;
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
        if (Object.keys(authority.typeMappingsBySource).length !== COMPILED_AUTHORITY_LOCK.mappedTypeCount
            || Object.keys(authority.memberMappingsByKey).length !== COMPILED_AUTHORITY_LOCK.mappedMemberCount) {
            throw new CliError("loaded capability map count does not match the compiled authority lock", 6);
        }
        return Object.freeze({
            authority,
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

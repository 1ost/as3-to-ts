import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { HardenedSemanticError } from "./contracts";
const MAX_AUTHORITY_BYTES = 64 * 1024 * 1024;
const SHA256 = /^[0-9a-f]{64}$/;
const VERIFIED_TARGETS = new WeakMap<object, string>();
class ProofError extends HardenedSemanticError {
    constructor(message: string, _exitCode: number) { super("HARDENED_REFLECTION_PROVIDER_AUTHORITY", message); }
}
export interface ReflectionProviderTarget {
    readonly metadataModule: string;
    readonly metadataExport: string;
    readonly describeModule: string;
    readonly describeExport: string;
}
export function assertReflectionProviderTarget(value: ReflectionProviderTarget, targetJson: string): void {
    if (!value || VERIFIED_TARGETS.get(value) !== sha256(targetJson))
        throw new ProofError("reflection provider requires verified target evidence", 6);
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
        throw new ProofError(`${label} does not exist`, 3);
    }
    if (!lexicalStat.isFile() || lexicalStat.isSymbolicLink() || lexicalStat.size > MAX_AUTHORITY_BYTES) {
        throw new ProofError(`${label} must be an ordinary bounded file`, 3);
    }
    if (realpathSync.native(lexical) !== lexical) {
        throw new ProofError(`${label} path must be canonical and contain no link alias`, 3);
    }
    const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
    const descriptor = openSync(lexical, constants.O_RDONLY | noFollow);
    try {
        const before = fstatSync(descriptor, { bigint: true });
        if (!before.isFile() || before.size > BigInt(MAX_AUTHORITY_BYTES)) {
            throw new ProofError(`${label} must be an ordinary bounded file`, 3);
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
            throw new ProofError(`${label} changed while it was read`, 6);
        }
        const content = bytes.subarray(0, offset).toString("utf8");
        if (Buffer.from(content, "utf8").compare(bytes.subarray(0, offset)) !== 0) {
            throw new ProofError(`${label} must be exact UTF-8`, 3);
        }
        return content;
    } finally {
        closeSync(descriptor);
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
    throw new ProofError("application profile contains a non-JSON value", 6);
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
        throw new ProofError(`${label} profile file reference is invalid`, 6);
    }
    const bytes = readRegularUtf8(join(root, ...value.path.split("/")), label);
    if (sha256(bytes) !== value.sha256) throw new ProofError(`${label} bytes do not match the application profile`, 6);
    return bytes;
}

function parseProfileDocument(bytes: string, label: string): Record<string, unknown> {
    let value: unknown;
    try { value = JSON.parse(bytes); } catch { throw new ProofError(`${label} is not JSON`, 6); }
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProofError(`${label} has the wrong schema`, 6);
    return value as Record<string, unknown>;
}


const TARGETS = Object.freeze([
    {module:"src/layaAir/flash/utils/FlashReflectionMetadata.ts", export:"createFlashReflectionMetadata",
        signature:"(bindings: readonly FlashReflectionClassBinding[]) => FlashReflectionMetadata"},
    {module:"src/layaAir/flash/utils/describeTypeXml.ts", export:"describeTypeXml",
        signature:"(value: unknown, metadata: FlashReflectionMetadata) => FlashReflectionXml"},
]);

/** Optional shared TS provider proof; deliberately makes no native QName admission. */
export function loadReflectionProviderTarget(proofJson: string, targetPath: string, targetJson: string): ReflectionProviderTarget {
    verifySharedProviderTarget(proofJson,targetPath,targetJson,"as3-reflection-provider-target@1",TARGETS,
        ["src/layaAir/flash/events/UnsupportedFlashFeatureError.ts"]);
    const verified=Object.freeze({metadataModule:TARGETS[0]!.module,metadataExport:TARGETS[0]!.export,
        describeModule:TARGETS[1]!.module,describeExport:TARGETS[1]!.export});
    VERIFIED_TARGETS.set(verified,sha256(targetJson));
    return verified;
}

/** Reusable closed provider/export/transitive-source verifier; callers retain their own unforgeable handles. */
export function verifySharedProviderTarget(proofJson: string, targetPath: string, targetJson: string,
    schema: string, TARGETS: readonly {module:string;export:string;signature:string;constructors?:readonly string[]}[],
    requiredModules: readonly string[] = [], targetCapabilityId = "api.flash.utils"): void {
    const proof = parseProfileDocument(proofJson, "reflection provider proof");
    const target = parseProfileDocument(targetJson, "target capabilities");
    if (`${canonical(proof)}\n` !== proofJson
        || !exactKeys(proof,["schema","targetCapabilitiesSha256","targetCapabilityId","targets","targetSources"])
        || proof.schema !== schema
        || proof.targetCapabilitiesSha256 !== sha256(targetJson)
        || proof.targetCapabilityId !== targetCapabilityId
        || !Array.isArray(proof.targets) || proof.targets.length !== TARGETS.length
        || !proof.targetSources || typeof proof.targetSources !== "object" || Array.isArray(proof.targetSources)
        || !Array.isArray(target.capabilities))
        throw new ProofError("reflection provider proof has invalid schema or target pin",6);
    const capabilities = target.capabilities.filter((cap: unknown) => cap && typeof cap === "object"
        && (cap as Record<string,unknown>).id === proof.targetCapabilityId);
    if (capabilities.length !== 1) throw new ProofError("reflection capability must be unique",6);
    const capability = capabilities[0] as Record<string,unknown>;
    if (capability.status !== "typescript-obligation" || !Array.isArray(capability.obligations))
        throw new ProofError("reflection capability is not a TypeScript obligation",6);
    const targetRoot = realpathSync.native(resolve(dirname(targetPath), "../.."));
    const sources = proof.targetSources as Record<string,unknown>;
    for (const module of [...TARGETS.map(row=>row.module),...requiredModules])
        if (!Object.prototype.hasOwnProperty.call(sources,module)) throw new ProofError("reflection source closure is incomplete",6);
    for (const [path,hash] of Object.entries(sources)) {
        if (!path.startsWith("src/layaAir/") || typeof hash !== "string" || !SHA256.test(hash))
            throw new ProofError("reflection source identity is invalid",6);
        profileFile(targetRoot,{path,sha256:hash},"reflection target source");
    }
    const observedInputs: Record<string,string> = Object.create(null);
    for (let index=0; index<TARGETS.length; index++) {
        const expected = TARGETS[index]!;
        const item = proof.targets[index];
        if (!exactKeys(item,["module","export","signature","sha256"])
            || item.module!==expected.module || item.export!==expected.export || item.signature!==expected.signature
            || typeof item.sha256!=="string" || !SHA256.test(item.sha256))
            throw new ProofError("reflection target export/signature differs",6);
        const rows=capability.obligations.filter((row: unknown)=>row && typeof row==="object"
            && (row as Record<string,unknown>).module===item.module && (row as Record<string,unknown>).export===item.export);
        if (rows.length!==1) throw new ProofError("reflection export obligation must be unique",6);
        const row=rows[0] as Record<string,unknown>;
        if (row.kind!==(expected.constructors ? "class" : "function") || row.signature!==item.signature || row.sha256!==item.sha256
            || expected.constructors && JSON.stringify(row.constructors)!==JSON.stringify(expected.constructors))
            throw new ProofError("reflection export obligation differs",6);
        const bytes=profileFile(targetRoot,{path:expected.module,sha256:sources[expected.module] as string},"reflection export source");
        if (sha256(bytes.replace(/\r\n?/g,"\n"))!==item.sha256)
            throw new ProofError("reflection export source differs from ledger",6);
        const resolver=resolve(__dirname,"../tools/resolve-laya-export.cjs");
        const result=spawnSync(process.execPath,[resolver],{encoding:"utf8",timeout:90000,maxBuffer:8*1024*1024,
            input:JSON.stringify({root:targetRoot,facade:{module:item.module,export:item.export,sha256:item.sha256},candidates:[row],validateConstructors:!!expected.constructors})});
        if (result.status!==0) throw new ProofError("reflection export/closure resolution failed: "+result.stderr,6);
        const resolved=JSON.parse(result.stdout) as {index:number;inputs:Record<string,string>};
        if(resolved.index!==0 || !resolved.inputs || typeof resolved.inputs!=="object") throw new ProofError("reflection resolver output is invalid",6);
        for(const [path,hash] of Object.entries(resolved.inputs)) {
            if (observedInputs[path] && observedInputs[path]!==hash) throw new ProofError("reflection closure changed during resolution",6);
            observedInputs[path]=hash;
        }
    }
    const expectedInputs=Object.fromEntries(Object.entries(sources).map(([path,hash])=>[resolve(targetRoot,path),hash]));
    // Canonical JSON accepts plain records; retain the null-prototype collection internally.
    if(canonical({...observedInputs})!==canonical(expectedInputs)) throw new ProofError("reflection transitive source closure differs",6);
}

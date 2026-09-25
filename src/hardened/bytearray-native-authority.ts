import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { HardenedSemanticError, type ByteArrayNativeTarget } from "./contracts";
const MAX_AUTHORITY_BYTES = 64 * 1024 * 1024;
const SHA256 = /^[0-9a-f]{64}$/;
const VERIFIED_TARGETS = new WeakMap<object, string>();
const READ_OBJECT_TARGETS = new WeakSet<object>();
const WRITE_OBJECT_TARGETS = new WeakSet<object>();
class ProofError extends HardenedSemanticError {
    constructor(message: string, _exitCode: number) { super("HARDENED_BYTEARRAY_NATIVE_AUTHORITY", message); }
}
export function assertByteArrayNativeTarget(value: ByteArrayNativeTarget, targetJson: string): void {
    if (!value || VERIFIED_TARGETS.get(value) !== sha256(targetJson)) {
        throw new ProofError("native ByteArray authority requires genuine verified source and target evidence", 6);
    }
}
export function assertByteArrayReadObjectSource(value: ByteArrayNativeTarget, targetJson: string): void {
    assertByteArrayNativeTarget(value,targetJson);
    if (!READ_OBJECT_TARGETS.has(value))
        throw new ProofError("native ByteArray readObject requires its exact retained SDK declaration",6);
}
export function assertByteArrayWriteObjectSource(value: ByteArrayNativeTarget, targetJson: string): void {
    assertByteArrayNativeTarget(value,targetJson);
    if (!WRITE_OBJECT_TARGETS.has(value))
        throw new ProofError("native ByteArray writeObject requires its exact retained SDK declaration",6);
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

export function loadByteArrayNativeTarget(profileRoot:string, proofJson:string, targetPath:string,
    targetJson:string, sourceMemberJson:string, sourceManifestJson:string):ByteArrayNativeTarget {
    const proof = parseProfileDocument(proofJson,"native ByteArray proof");
    const source = parseProfileDocument(sourceMemberJson,"source member authority");
    const target = parseProfileDocument(targetJson,"target capabilities");
    const signature = 'public function uncompress(algorithm:String = "zlib") : void';
    if (`${canonical(proof)}\n` !== proofJson || !exactKeys(proof,["schema","sourceQName","sourceMember",
        "sourceSignature","sourceMinArgs","sourceMaxArgs","sourceArtifactSha256","sourceDeclarationPath",
        "sourceDeclarationSha256","sourceSignaturesPath","sourceSignaturesSha256","targetCapabilitiesSha256","targetCapabilityId","targetModule","targetExport",
        "targetSignature","targetConstructors","targetMembers","targetSources"])
        || proof.schema !== "as3-bytearray-native-target@1" || proof.sourceQName !== "flash.utils.ByteArray"
        || proof.sourceMember !== "uncompress" || proof.sourceSignature !== signature
        || proof.sourceMinArgs !== 0 || proof.sourceMaxArgs !== 1
        || proof.sourceArtifactSha256 !== source.sourceArtifactSha256
        || proof.targetCapabilitiesSha256 !== sha256(targetJson)
        || proof.targetModule !== "src/layaAir/flash/utils/ByteArray.ts" || proof.targetExport !== "ByteArray"
        || proof.targetSignature !== "typeof ByteArray" || !Array.isArray(target.capabilities)
        || !proof.targetSources || typeof proof.targetSources !== "object" || Array.isArray(proof.targetSources))
        throw new ProofError("native ByteArray proof identity or source/target pins are invalid",6);
    const declaration = profileFile(profileRoot,{path:proof.sourceDeclarationPath as string,
        sha256:proof.sourceDeclarationSha256 as string},"native ByteArray source declaration");
    const manifest=parseProfileDocument(sourceManifestJson,"source manifest");
    const signatures=parseProfileDocument(profileFile(profileRoot,{path:proof.sourceSignaturesPath as string,
        sha256:proof.sourceSignaturesSha256 as string},"native ByteArray SDK signatures"),"native SDK signatures");
    const nativeClass=(signatures.classes as any)?.["flash.utils.ByteArray"];
    const members=nativeClass?.members?.filter((member:any)=>member.name==="uncompress" && member.access==="call");
    if (!declaration.includes(signature) || manifest.nativeSignaturesSha256!==proof.sourceSignaturesSha256
        || manifest.nativeSdkSha256!==proof.sourceArtifactSha256 || !Array.isArray(members) || members.length!==1
        || members[0].signature!==signature || members[0].minArgs!==0 || members[0].maxArgs!==1
        || members[0].scope!=="instance" || members[0].type!=="void")
        throw new ProofError("native ByteArray SDK signature changed",6);
    const obligations = (target.capabilities as any[]).filter(cap=>cap.id===proof.targetCapabilityId
        && cap.status==="typescript-obligation").flatMap(cap=>cap.obligations || [])
        .filter(row=>row.module===proof.targetModule && row.export===proof.targetExport && row.kind==="class");
    const row = obligations.length===1 ? obligations[0] : null;
    if (!row || row.signature!==proof.targetSignature
        || canonical(row.constructors)!==canonical(["new (input?: ByteArrayInput): ByteArray"])
        || canonical(row.constructors)!==canonical(proof.targetConstructors)
        || !Array.isArray(row.members) || !Array.isArray(proof.targetMembers))
        throw new ProofError("native ByteArray target constructor is not authenticated",6);
    const expected = {buffer:["get","ArrayBuffer"],position:["get+set","number"],endian:["get+set","string"],uncompress:["method","(algorithm?: string) => void"]};
    if (proof.targetMembers.length!==4) throw new ProofError("native ByteArray target member set differs",6);
    for (const [name,[kind,signature]] of Object.entries(expected)) {
        const members=row.members.filter((member:any)=>member.name===name);
        const retained=(proof.targetMembers as any[]).filter(member=>member.name===name);
        if (members.length!==1 || retained.length!==1 || canonical(members[0])!==canonical(retained[0])
            || members[0].kind!==kind || members[0].signature!==signature || members[0].scope!=="instance")
            throw new ProofError("native ByteArray target member signature changed: "+name,6);
    }
    const targetRoot=realpathSync.native(resolve(dirname(targetPath),"../.."));
    const sources=proof.targetSources as Record<string,string>;
    if (!(proof.targetModule as string in sources) || !("src/layaAir/laya/utils/Zlib.ts" in sources))
        throw new ProofError("native ByteArray target closure lacks its operation or decoder",6);
    for (const [path,hash] of Object.entries(sources)) {
        const bytes=profileFile(targetRoot,{path,sha256:hash},"native ByteArray target source");
        if (path===proof.targetModule && sha256(bytes.replace(/\r\n?/g,"\n"))!==row.sha256)
            throw new ProofError("native ByteArray target obligation source hash changed",6);
    }
    const resolver=resolve(__dirname,"../tools/resolve-laya-export.cjs");
    const resolved=spawnSync(process.execPath,[resolver],{encoding:"utf8",timeout:90000,
        input:JSON.stringify({root:targetRoot,facade:{module:proof.targetModule,export:proof.targetExport,sha256:row.sha256},candidates:[row]})});
    if (resolved.status!==0) throw new ProofError("native ByteArray export/closure resolution failed: "+resolved.stderr,6);
    const inputs=JSON.parse(resolved.stdout).inputs as Record<string,string>;
    const expectedInputs=Object.fromEntries(Object.entries(sources).map(([path,hash])=>[resolve(targetRoot,path),hash]));
    if (canonical(inputs)!==canonical(expectedInputs)) throw new ProofError("native ByteArray transitive source closure differs",6);
    const verified = Object.freeze({targetModule:proof.targetModule,targetExport:proof.targetExport,sourceSignature:signature}) as ByteArrayNativeTarget;
    VERIFIED_TARGETS.set(verified, sha256(targetJson));
    const reads=nativeClass.members.filter((member:any)=>member.name==="readObject" && member.access==="call");
    const writes=nativeClass.members.filter((member:any)=>member.name==="writeObject" && member.access==="call");
    if (proof.sourceArtifactSha256==="e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546"
        && proof.sourceDeclarationSha256==="7d0c0fcac328b1dae3d3e4d11a9a579e81d10f5c0e4d260c53648936def2ad83"
        && declaration.split(/\r?\n/).filter(line=>line.trim()==="public native function readObject() : *;").length===1
        && reads.length===1 && reads[0].signature==="public function readObject() : *"
        && reads[0].nativeSignature==="public native function readObject() : *;"
        && reads[0].scope==="instance" && reads[0].type==="*" && reads[0].minArgs===0 && reads[0].maxArgs===0)
        READ_OBJECT_TARGETS.add(verified);
    if (proof.sourceArtifactSha256==="e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546"
        && proof.sourceDeclarationSha256==="7d0c0fcac328b1dae3d3e4d11a9a579e81d10f5c0e4d260c53648936def2ad83"
        && declaration.split(/\r?\n/).filter(line=>line.trim()==="public native function writeObject(param1:*) : void;").length===1
        && writes.length===1 && writes[0].signature==="public function writeObject(param1:*) : void"
        && writes[0].nativeSignature==="public native function writeObject(param1:*) : void;"
        && writes[0].scope==="instance" && writes[0].type==="void" && writes[0].minArgs===1 && writes[0].maxArgs===1)
        WRITE_OBJECT_TARGETS.add(verified);
    return verified;
}

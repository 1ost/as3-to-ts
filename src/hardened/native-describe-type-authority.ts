import { createHash } from "node:crypto";
import { readFileSync, lstatSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";
import { LoadedSourceMemberAuthority, assertLoadedSourceMemberAuthority } from "./source-member-authority";
import { ReflectionProviderTarget, assertReflectionProviderTarget } from "./reflection-provider-authority";
import { HardenedSemanticError } from "./contracts";

const verified = new WeakSet<object>();
const SDK = "e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546";
const DECLARATION = "9166be1cec8a61485506033aa85d40f838b74ba8487cde153fe25e98295a0b16";
const sha = (text: string): string => createHash("sha256").update(text).digest("hex");
function reject(): never {
    throw new HardenedSemanticError("HARDENED_DESCRIBE_TYPE_AUTHORITY", "describeType requires exact SDK source and verified shared reflection evidence");
}
function canonical(value: any): string {
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    if (value !== null && typeof value === "object") return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
    return JSON.stringify(value);
}
function readBound(root: string, relative: unknown, digest: unknown, max: number): string {
    if (typeof relative !== "string" || !/^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(relative)
        || relative.split("/").some(part => part === "." || part === "..")
        || typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)) reject();
    const file = resolve(root, relative);
    if (!file.startsWith(root + sep) || realpathSync(file) !== file || !lstatSync(file).isFile() || lstatSync(file).size > max) reject();
    const text = readFileSync(file, "utf8");
    if (sha(text) !== digest) reject();
    return text;
}
/** Brands only the loaded source authority after both native and target proofs pass. */
export function verifyNativeDescribeTypeAuthority(source: LoadedSourceMemberAuthority, profileRoot: string,
    proofJson: string, sourceManifestJson: string, provider: ReflectionProviderTarget, targetJson: string): void {
    assertLoadedSourceMemberAuthority(source);
    assertReflectionProviderTarget(provider, targetJson);
    let proof: any, manifest: any;
    try { proof = JSON.parse(proofJson); manifest = JSON.parse(sourceManifestJson); } catch { return reject(); }
    const keys = ["schema", "sourceArtifactSha256", "declarationPath", "declarationSha256", "signaturesPath", "signaturesSha256"];
    if (!proof || canonical(proof) + "\n" !== proofJson || Object.keys(proof).sort().join("\0") !== keys.sort().join("\0")
        || proof.schema !== "as3-native-describe-type-authority@1" || source.sourceArtifactSha256 !== SDK
        || proof.sourceArtifactSha256 !== SDK || proof.declarationSha256 !== DECLARATION
        || manifest.nativeSdkSha256 !== SDK || manifest.nativeDescribeTypeDeclarationSha256 !== DECLARATION
        || manifest.nativeSignaturesSha256 !== proof.signaturesSha256) reject();
    const root = resolve(profileRoot);
    const declaration = readBound(root, proof.declarationPath, DECLARATION, 1024 * 1024);
    if (declaration.split(/\r?\n/).filter(line => line.trim() === "public function describeType(value:*) : XML").length !== 1) reject();
    let signatures: any;
    try { signatures = JSON.parse(readBound(root, proof.signaturesPath, proof.signaturesSha256, 32 * 1024 * 1024)); } catch { return reject(); }
    // The existing SDK extractor records package functions as exact source inputs,
    // rather than inventing a class member or changing the native * argument.
    const inputs = signatures?.inputs;
    if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) reject();
    const matches = Object.keys(inputs).filter(path => path.endsWith("/sdk-source/scripts/flash/utils/describeType.as"));
    if (matches.length !== 1 || inputs[matches[0]!] !== DECLARATION) reject();
    verified.add(source);
}
export function hasNativeDescribeTypeAuthority(source: LoadedSourceMemberAuthority | null | undefined): boolean {
    return !!source && verified.has(source);
}

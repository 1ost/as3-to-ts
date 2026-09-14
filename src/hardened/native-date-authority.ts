import { createHash } from "node:crypto";
import { readFileSync, lstatSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";
import { LoadedSourceMemberAuthority, assertLoadedSourceMemberAuthority } from "./source-member-authority";
import { HardenedSemanticError } from "./contracts";
const verified = new WeakSet<object>();
const sha = (text: string): string => createHash("sha256").update(text).digest("hex");
const constructor = "public function Date(year:* = undefined, month:* = undefined, date:* = undefined, hours:* = undefined, minutes:* = undefined, seconds:* = undefined, ms:* = undefined)";
function reject(): never { throw new HardenedSemanticError("HARDENED_DATE_AUTHORITY", "Date requires exact SDK constructor and AS3 namespace member evidence"); }
function canonical(value: any): string {
    if (Array.isArray(value)) return "["+value.map(canonical).join(",")+"]";
    if(value !== null && typeof value === "object") return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+canonical(value[k])).join(",")+"}";
    return JSON.stringify(value);
}
/** No public branding hook: only this source/manifest/declaration verifier can enable Date. */
export function verifyNativeDateAuthority(source: LoadedSourceMemberAuthority, profileRoot: string,
    proofJson: string, sourceManifestJson: string): void {
    assertLoadedSourceMemberAuthority(source);
    let proof: any, manifest: any;
    try { proof=JSON.parse(proofJson); manifest=JSON.parse(sourceManifestJson); } catch { return reject(); }
    const keys=["schema","sourceArtifactSha256","declarationPath","declarationSha256","signaturesPath","signaturesSha256"];
    if (!proof || canonical(proof)+"\n"!==proofJson || Object.keys(proof).sort().join("\0")!==keys.sort().join("\0")
        || proof.schema!=="as3-native-date-authority@1" || proof.sourceArtifactSha256!==source.sourceArtifactSha256
        || manifest.nativeSdkSha256!==proof.sourceArtifactSha256 || manifest.nativeDateDeclarationSha256!==proof.declarationSha256
        || proof.sourceArtifactSha256!=="e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546"
        || proof.declarationSha256!=="5831f64888b139d562e5b0bf3fad6df476aaaa7b8ebe943b634a5f48e02db12e"
        || !/^[a-f0-9]{64}$/.test(proof.declarationSha256) || typeof proof.declarationPath!=="string"
        || !/^(?:[A-Za-z0-9_.-]+\/)*Date\.as$/.test(proof.declarationPath)
        || proof.declarationPath.split("/").some((part:string)=>part===".." || part===".")) reject();
    const root=resolve(profileRoot), file=resolve(root,proof.declarationPath);
    if(!file.startsWith(root+sep) || realpathSync(file)!==file || !lstatSync(file).isFile() || lstatSync(file).size>1024*1024) reject();
    if(typeof proof.signaturesPath!=="string" || !/^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.json$/.test(proof.signaturesPath)
        || proof.signaturesPath.split("/").some((part:string)=>part===".." || part===".")
        || manifest.nativeSignaturesSha256!==proof.signaturesSha256) reject();
    const signaturesFile=resolve(root,proof.signaturesPath);
    if(!signaturesFile.startsWith(root+sep) || realpathSync(signaturesFile)!==signaturesFile
        || !lstatSync(signaturesFile).isFile() || lstatSync(signaturesFile).size>32*1024*1024) reject();
    const signaturesJson=readFileSync(signaturesFile,"utf8");
    if(sha(signaturesJson)!==proof.signaturesSha256) reject();
    let signatures:any;try { signatures=JSON.parse(signaturesJson); } catch { return reject(); }
    const constructors=signatures?.classes?.Date?.members?.filter((member:any)=>member.constructor===true);
    if(!Array.isArray(constructors) || constructors.length!==1 || constructors[0].signature!==constructor
        || constructors[0].minArgs!==0 || constructors[0].maxArgs!==7 || constructors[0].type!=="Date") reject();
    const text=readFileSync(file,"utf8");
    if(sha(text)!==proof.declarationSha256) reject();
    const lines=text.split(/\r?\n/).map(line=>line.trim());
    for(const signature of [constructor,"AS3 native function valueOf() : Number;","AS3 native function getTime() : Number;",
        "public function get time() : Number","public dynamic class Date"])
        if(lines.filter(line=>line===signature).length!==1) reject();
    verified.add(source);
}
export function hasNativeDateAuthority(source: LoadedSourceMemberAuthority | null | undefined): boolean {
    return !!source && verified.has(source);
}

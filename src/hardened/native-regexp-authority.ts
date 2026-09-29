import { createHash } from "node:crypto";
import { readFileSync, lstatSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";
import { LoadedSourceMemberAuthority, assertLoadedSourceMemberAuthority } from "./source-member-authority";
import { HardenedSemanticError } from "./contracts";
const verified = new WeakSet<object>();
const sha = (text: string): string => createHash("sha256").update(text).digest("hex");
const constructor = "public function RegExp(pattern:* = undefined, options:* = undefined)";
function reject(): never { throw new HardenedSemanticError("HARDENED_REGEXP_AUTHORITY", "RegExp requires exact SDK constructor and AS3 namespace member evidence"); }
function canonical(value: any): string {
    if (Array.isArray(value)) return "["+value.map(canonical).join(",")+"]";
    if(value !== null && typeof value === "object") return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+canonical(value[k])).join(",")+"}";
    return JSON.stringify(value);
}
/** No public branding hook: only this source/manifest/declaration verifier can enable RegExp. */
export function verifyNativeRegExpAuthority(source: LoadedSourceMemberAuthority, profileRoot: string,
    proofJson: string, sourceManifestJson: string): void {
    assertLoadedSourceMemberAuthority(source);
    let proof: any, manifest: any;
    try { proof=JSON.parse(proofJson); manifest=JSON.parse(sourceManifestJson); } catch { return reject(); }
    const keys=["schema","sourceArtifactSha256","declarationPath","declarationSha256","signaturesPath","signaturesSha256"];
    if (!proof || canonical(proof)+"\n"!==proofJson || Object.keys(proof).sort().join("\0")!==keys.sort().join("\0")
        || proof.schema!=="as3-native-regexp-authority@1" || proof.sourceArtifactSha256!==source.sourceArtifactSha256
        || manifest.nativeSdkSha256!==proof.sourceArtifactSha256 || manifest.nativeRegExpDeclarationSha256!==proof.declarationSha256
        || proof.sourceArtifactSha256!=="e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546"
        || proof.declarationSha256!=="44aeb3fc7839a380337c64e9947e7e3a8b98ddcd41ead039ed65adfcddd553c0"
        || !/^[a-f0-9]{64}$/.test(proof.declarationSha256) || typeof proof.declarationPath!=="string"
        || !/^(?:[A-Za-z0-9_.-]+\/)*RegExp\.as$/.test(proof.declarationPath)
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
    const members=signatures?.classes?.RegExp?.members;
    const constructors=members?.filter((member:any)=>member.constructor===true);
    if(!Array.isArray(constructors) || constructors.length!==1 || constructors[0].signature!==constructor
        || constructors[0].minArgs!==0 || constructors[0].maxArgs!==2 || constructors[0].type!=="RegExp") reject();
    const exactPublicMember=(access:string,name:string,signature:string,type:string,minArgs:number,maxArgs:number):boolean=>{
        const rows=members?.filter((member:any)=>member.constructor===false && member.scope==="instance"
            && member.access===access && member.name===name);
        return Array.isArray(rows) && rows.length===1 && rows[0].signature===signature
            && rows[0].type===type && rows[0].minArgs===minArgs && rows[0].maxArgs===maxArgs;
    };
    for (const [name,type] of [["source","String"],["global","Boolean"],["ignoreCase","Boolean"],
        ["multiline","Boolean"],["lastIndex","int"],["dotall","Boolean"],["extended","Boolean"]])
        if (!exactPublicMember("read",name!,`public function get ${name}() : ${type}`,type!,0,0)) reject();
    if (!exactPublicMember("write","lastIndex","public function set lastIndex(param1:int) : *","int",1,1)) reject();
    const text=readFileSync(file,"utf8");
    if(sha(text)!==proof.declarationSha256) reject();
    const lines=text.split(/\r?\n/).map(line=>line.trim());
    for(const signature of [constructor,'AS3 native function exec(param1:String = "") : *;',
        'AS3 function test(s:String = "") : Boolean',"public dynamic class RegExp"])
        if(lines.filter(line=>line===signature).length!==1) reject();
    verified.add(source);
}
export function hasNativeRegExpAuthority(source: LoadedSourceMemberAuthority | null | undefined): boolean {
    return !!source && verified.has(source);
}

import {createHash} from "node:crypto";
import {lstatSync,readFileSync,realpathSync} from "node:fs";
import {resolve,sep} from "node:path";
import {HardenedSemanticError} from "./contracts";
import {assertLoadedSourceMemberAuthority,type LoadedSourceMemberAuthority} from "./source-member-authority";

const SDK="e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546";
const DECLARATION="7825ee4f0a278edbbdec0f78065a886c4692c36c0ef189ae1ab7bde32db7fe47";
const REVISION="1563e72a6f3849554c3ccb3eacd615fd3083f435";
const RUNTIME_SOURCE="2264c65a2c22fa66d4d14b97b299fe88ba0342f924cc948bf20df159c5cee8bf";
const DECODE_DECLARATION="fb3c28c303631a83e412a2f00f2e33563a116b76e6551316cb42593edb55cb90";
const DECODE_ERROR_DECLARATION="8e0caed79bcb9712343ad85d3932cdae9c80334219715fb1828eafa8ad94187e";
const DECODE_RUNTIME="2f5a8b644405350d04a72c768270d0fd7a29323b5642e2ff5b1e0b5e5b052f02";
const DECODE_ERROR="62fe72c0183d119d1e50560cd306161c4a8a5f09166beaf45c85a203c920379f";
const DECODE_EVIDENCE=Object.freeze({
    "DecodeURIComponentProbe.as":"3cd30573a0805ebccd8163866ce92ac1a13ff0ae1f6c7e245fd1ceb386c2979d",
    "scenario.json":"dcd1432cfba7a7ec47c762bf52e35bdd7e33a01acee31c152f817309d224d8ec",
    "native-capture.json":"7eeeeefc716f6538b971813d37c51633fe278dc12f479ae55707386f1af3f21c",
    "native-receipt.json":"07221590ed5d3ba5b2dea0529a5447fad0c849196e6bb7be488c03801a47f47c",
    "oracle.swf":"3ada944c97ebfd40246a1048bd72bdd642b41aea31a3e7793e46843d6ef5ffa7",
});
const EVIDENCE=Object.freeze({
    "EncodeURIComponentProbe.as":"d02d738d978520fd8b4a6288393042c8d2e775d6a46ca830ba489abbd1fd6e6e",
    "README.md":"fcbd516f77cd15d8800c2754f2bef2e765b47bf6a020f01363ce28adb5494967",
    "browser-air.json":"427ae9b7408c6da2026090df4e3321af78719d49ea77e2e2d8046d8853f85adf",
    "browser-pin.json":"42c5d4efebeb0eba8e4f98c9efd8b8529435033b35432b56188d14c0f61879b2",
    "native-air.json":"6e6fb03ff5373b9d57f2b4ce9f2b877619b48c12b93c789191780baa0fa470b2",
    "run-browser.mjs":"b8def9ff4b3446822336d98b34e494ea6bce2acad2e05b4a53db15ef8d9b7def",
    "scenario.json":"7e8cb57dba7c5fc74d7f818cd3072da68e2298c071b76ff1116be647de5bbd79",
});
const verified=new WeakMap<object,string>();
const verifiedDecode=new WeakMap<object,string>();
const sha=(value:string):string=>createHash("sha256").update(value).digest("hex");
const canonical=(value:any):string=>Array.isArray(value)?"["+value.map(canonical).join(",")+"]"
    :value!==null&&typeof value==="object"?"{"+Object.keys(value).sort().map(key=>JSON.stringify(key)+":"+canonical(value[key])).join(",")+"}"
    :JSON.stringify(value);
function reject():never { throw new HardenedSemanticError("HARDENED_URI_COMPONENT_AUTHORITY",
    "encodeURIComponent requires the exact SDK declaration, compiler helper, and retained AIR/browser evidence"); }
function exactKeys(value:any,keys:string[]):boolean {
    return value!==null&&typeof value==="object"&&!Array.isArray(value)
        && Object.keys(value).sort().join("\0")===[...keys].sort().join("\0");
}
function readBound(root:string,relative:unknown,digest:unknown,max:number):string {
    if(typeof relative!=="string"||!/^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(relative)
        ||relative.split("/").some(part=>part==="."||part==="..")||typeof digest!=="string"||!/^[a-f0-9]{64}$/.test(digest)) reject();
    const path=resolve(root,relative);
    if(!path.startsWith(root+sep)||realpathSync(path)!==path||!lstatSync(path).isFile()||lstatSync(path).size>max) reject();
    const bytes=readFileSync(path);
    if(createHash("sha256").update(bytes).digest("hex")!==digest) reject();
    return bytes.toString("utf8");
}

export function verifyNativeUriComponentAuthority(source:LoadedSourceMemberAuthority,profileRoot:string,
    proofJson:string,sourceManifestJson:string,targetCapabilitiesJson?:string):void {
    assertLoadedSourceMemberAuthority(source);
    let proof:any,manifest:any;
    try { proof=JSON.parse(proofJson);manifest=JSON.parse(sourceManifestJson); } catch { return reject(); }
    if(canonical(proof)+"\n"!==proofJson||!exactKeys(proof,["schema","sourceArtifactSha256","declarationPath",
        "declarationSha256","signaturesPath","signaturesSha256","evidenceRevision","evidence","runtime",
        ...(proof?.decode===undefined?[]:["decode"])])
        ||proof.schema!=="as3-native-uri-component-authority@1"||proof.sourceArtifactSha256!==SDK
        ||proof.declarationSha256!==DECLARATION||proof.evidenceRevision!==REVISION
        ||!exactKeys(proof.runtime,["module","export","sourcePath","sourceSha256"])
        ||proof.runtime.module!=="@laya/as3-runtime/AS3URI"||proof.runtime.export!=="as3EncodeURIComponent"
        ||proof.runtime.sourcePath!=="src/hardened-runtime/AS3URI.ts"||proof.runtime.sourceSha256!==RUNTIME_SOURCE
        ||manifest.nativeSdkSha256!==SDK||manifest.nativeSignaturesSha256!==proof.signaturesSha256
        ||manifest.nativeUriComponentDeclarationSha256!==DECLARATION
        ||manifest.nativeUriComponentEvidenceRevision!==REVISION
        ||manifest.nativeUriComponentRuntimeSourceSha256!==RUNTIME_SOURCE
        ||!Array.isArray(proof.evidence)||proof.evidence.length!==Object.keys(EVIDENCE).length) reject();
    const root=resolve(profileRoot);
    const declaration=readBound(root,proof.declarationPath,DECLARATION,1024*1024);
    if(declaration.split(/\r?\n/).filter(line=>line.trim()==="public native function encodeURIComponent(param1:String = \"undefined\") : String;").length!==1) reject();
    let signatures:any;
    try { signatures=JSON.parse(readBound(root,proof.signaturesPath,proof.signaturesSha256,32*1024*1024)); } catch { return reject(); }
    const signatureMatches=Object.keys(signatures?.inputs||{}).filter(path=>path.endsWith("/sdk-source/scripts/encodeURIComponent.as"));
    if(signatureMatches.length!==1||signatures.inputs[signatureMatches[0]!]!==DECLARATION) reject();
    const evidenceFiles:Record<string,string>=Object.create(null);
    for(let index=0;index<proof.evidence.length;index+=1) {
        const row=proof.evidence[index];
        const name=Object.keys(EVIDENCE).sort()[index]!;
        if(!exactKeys(row,["name","path","sha256"])||row.name!==name||row.sha256!==(EVIDENCE as Record<string,string>)[name]) reject();
        evidenceFiles[name]=readBound(root,row.path,row.sha256,8*1024*1024);
    }
    let native:any,browser:any;
    try { native=JSON.parse(evidenceFiles["native-air.json"]!);browser=JSON.parse(evidenceFiles["browser-air.json"]!); } catch { return reject(); }
    if(native.schema!=="laya.encode-uri-component-native-air@1"||native.status!=="passed"
        ||native.runtimeAuthority?.artifacts?.["frameworks/libs/air/airglobal.swc"]!==SDK
        ||browser.schema!=="laya.encode-uri-component-air-browser-relation@1"||browser.status!=="mismatch"
        ||browser.inputs?.nativeEvidenceSha256!==EVIDENCE["native-air.json"]
        ||browser.inputs?.browserPinSha256!==EVIDENCE["browser-pin.json"]
        ||browser.inputs?.runnerSha256!==EVIDENCE["run-browser.mjs"]
        ||browser.relation?.encodedReturns!=="equal"||browser.relation?.throwDisposition!=="equal"
        ||browser.relation?.throwName!=="equal"||browser.relation?.exactThrownDiagnostics!=="different") reject();
    verified.set(source,sha(proofJson));
    if(proof.decode!==undefined) {
        const decode=proof.decode;
        if(!exactKeys(decode,["declarationPath","declarationSha256","errorDeclarationPath","errorDeclarationSha256","evidence","runtimeSourceSha256","errorSourceSha256"])
            ||decode.declarationSha256!==DECODE_DECLARATION||decode.runtimeSourceSha256!==DECODE_RUNTIME
            ||decode.errorSourceSha256!==DECODE_ERROR||decode.errorDeclarationSha256!==DECODE_ERROR_DECLARATION
            ||!Array.isArray(decode.evidence)
            ||decode.evidence.length!==Object.keys(DECODE_EVIDENCE).length||typeof targetCapabilitiesJson!=="string") reject();
        const declaration=readBound(root,decode.declarationPath,DECODE_DECLARATION,1024*1024);
        if(declaration.split(/\r?\n/).filter(line=>line.trim()==="public native function decodeURIComponent(param1:String = \"undefined\") : String;").length!==1) reject();
        const signatureMatches=Object.keys(signatures?.inputs||{}).filter(path=>path.endsWith("/sdk-source/scripts/decodeURIComponent.as"));
        if(signatureMatches.length!==1||signatures.inputs[signatureMatches[0]!]!==DECODE_DECLARATION) reject();
        const errorDeclaration=readBound(root,decode.errorDeclarationPath,DECODE_ERROR_DECLARATION,1024*1024);
        if(!errorDeclaration.includes("public dynamic class URIError extends Error")) reject();
        const errorMatches=Object.keys(signatures?.inputs||{}).filter(path=>path.endsWith("/sdk-source/scripts/URIError.as"));
        if(errorMatches.length!==1||signatures.inputs[errorMatches[0]!]!==DECODE_ERROR_DECLARATION) reject();
        const decodeFiles:Record<string,string>=Object.create(null);
        for(let index=0;index<decode.evidence.length;index+=1) {
            const row=decode.evidence[index],name=Object.keys(DECODE_EVIDENCE).sort()[index]!;
            if(!exactKeys(row,["name","path","sha256"])||row.name!==name
                ||row.sha256!==(DECODE_EVIDENCE as Record<string,string>)[name]) reject();
            decodeFiles[name]=readBound(root,row.path,row.sha256,8*1024*1024);
        }
        let receipt:any,capture:any,target:any;
        try { receipt=JSON.parse(decodeFiles["native-receipt.json"]!);
            capture=JSON.parse(decodeFiles["native-capture.json"]!);target=JSON.parse(targetCapabilitiesJson); }
        catch { return reject(); }
        if(receipt.status!=="passed"||receipt.capture?.identical!==true||receipt.capture?.observationCount!==16
            ||!Array.isArray(capture.state?.observations)||capture.state.observations.length!==16) reject();
        const obligations=(id:string):any[]=>target.capabilities?.find((item:any)=>item.id===id)?.obligations||[];
        const has=(id:string,module:string,exported:string,digest:string):boolean=>obligations(id).some((item:any)=>
            item.module===module&&item.export===exported&&item.kind==="function"&&item.sha256===digest);
        if(!has("api.flash.utils","src/layaAir/flash/utils/AS3URI.ts","as3DecodeURIComponent",DECODE_RUNTIME)
            ||!has("runtime.as3-source-error","src/layaAir/flash/errors/AS3SourceError.ts","createAS3DecodeURIError",DECODE_ERROR)
            ||!has("runtime.as3-source-error","src/layaAir/flash/errors/AS3SourceError.ts","as3IsSourceURIErrorInstance",DECODE_ERROR)) reject();
        verifiedDecode.set(source,sha(proofJson));
    }
}

export function nativeUriComponentAuthoritySha256(source:LoadedSourceMemberAuthority|null|undefined):string|null {
    return source ? verified.get(source)||null : null;
}
export function nativeDecodeUriComponentAuthoritySha256(source:LoadedSourceMemberAuthority|null|undefined):string|null {
    return source ? verifiedDecode.get(source)||null : null;
}

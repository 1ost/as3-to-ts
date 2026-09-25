import {createHash} from "node:crypto";
import {HardenedSemanticError} from "./contracts";
import {verifySharedProviderTarget} from "./reflection-provider-authority";

export interface TypeErrorProviderTarget { readonly module: string; }
const MODULE="src/layaAir/flash/utils/AS3TypeError.ts";
const SDK="e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546";
const DECLARATION="9be7f8c1e931148b71f5b6fd0e48e7407d6b49b7472211e8b583799b1dc3ff41";
const TARGETS=[{module:MODULE,export:"sourceTypeError",signature:"(message?: string) => Error"}];
const verified=new WeakMap<object,string>();
const hash=(text:string):string=>createHash("sha256").update(text).digest("hex");
const canonical=(value:any):string=>value===null||typeof value!=="object"?JSON.stringify(value)
    :Array.isArray(value)?"["+value.map(canonical).join(",")+"]"
    :"{"+Object.keys(value).sort().map(key=>JSON.stringify(key)+":"+canonical(value[key])).join(",")+"}";
function fail(message:string):never {throw new HardenedSemanticError("HARDENED_TYPE_ERROR_PROVIDER_AUTHORITY","TypeError provider: "+message);}
export function loadTypeErrorProviderTarget(proof:string,targetPath:string,targetJson:string,sourceJson:string):TypeErrorProviderTarget {
    try {
        const document=JSON.parse(proof),source=JSON.parse(sourceJson);
        if (canonical(document)+"\n"!==proof || Object.keys(document).sort().join(",")!=="declaration,schema,sourceArtifactSha256,target"
            || document.schema!=="as3-type-error-provider@1" || document.sourceArtifactSha256!==SDK
            || typeof document.declaration!=="string" || hash(document.declaration)!==DECLARATION
            || source.sourceArtifactSha256!==SDK || !Array.isArray(source.entries)
            || source.entries.filter((row:any)=>row.qname==="TypeError"&&row.baseQName==="Error"&&row.dynamic===true).length!==1)
            return fail("exact native SDK TypeError declaration and Error ancestry required");
        verifySharedProviderTarget(canonical(document.target)+"\n",targetPath,targetJson,"as3-type-error-provider-target@1",TARGETS);
    } catch(error) {return fail(error instanceof Error?error.message:String(error));}
    const target=Object.freeze({module:MODULE});verified.set(target,hash(targetJson));return target;
}
export function assertTypeErrorProviderTarget(target:TypeErrorProviderTarget,targetJson:string):void {
    if (!target || verified.get(target)!==hash(targetJson)) fail("verified shared source closure required");
}

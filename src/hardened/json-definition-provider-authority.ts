import {createHash} from "node:crypto";
import {HardenedSemanticError} from "./contracts";
import {verifySharedProviderTarget} from "./reflection-provider-authority";

export interface JSONDefinitionProviderTarget { readonly module: string; }
const MODULE="src/layaAir/flash/utils/AS3JSONDefinition.ts";
const SDK="e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546";
const DECLARATION="4ab05ed7fd98f7471d0d2e3ca24e906e1c6e221187a771a39a2003c7b6f73b52";
const TARGETS=[{module:MODULE,export:"isSourceJSONDefinition",signature:"(value: unknown) => boolean"},
    {module:MODULE,export:"callSourceJSONDefinition",signature:"(value: unknown, name: string, args: unknown[], coerceString: (value: unknown) => string | null) => unknown"}];
const verified=new WeakMap<object,string>();
const hash=(text:string):string=>createHash("sha256").update(text).digest("hex");
const canonical=(value:any):string=>value===null||typeof value!=="object"?JSON.stringify(value)
    :Array.isArray(value)?"["+value.map(canonical).join(",")+"]"
    :"{"+Object.keys(value).sort().map(key=>JSON.stringify(key)+":"+canonical(value[key])).join(",")+"}";
function fail(message:string):never {throw new HardenedSemanticError("HARDENED_JSON_DEFINITION_PROVIDER_AUTHORITY","JSON definition provider: "+message);}
export function loadJSONDefinitionProviderTarget(proof:string,targetPath:string,targetJson:string,sourceJson:string):JSONDefinitionProviderTarget {
    try {
        const document=JSON.parse(proof),source=JSON.parse(sourceJson);
        if (canonical(document)+"\n"!==proof || Object.keys(document).sort().join(",")!=="declaration,schema,sourceArtifactSha256,target"
            || document.schema!=="as3-json-definition-provider@1" || document.sourceArtifactSha256!==SDK
            || typeof document.declaration!=="string" || hash(document.declaration)!==DECLARATION
            || source.sourceArtifactSha256!==SDK || !Array.isArray(source.entries)
            || source.entries.filter((row:any)=>row.qname==="JSON"&&row.baseQName==="Object"&&row.dynamic===false).length!==1)
            return fail("exact native SDK JSON declaration and Object ancestry required");
        verifySharedProviderTarget(canonical(document.target)+"\n",targetPath,targetJson,"as3-json-definition-provider-target@1",TARGETS);
    } catch(error) {return fail(error instanceof Error?error.message:String(error));}
    const target=Object.freeze({module:MODULE});verified.set(target,hash(targetJson));return target;
}
export function assertJSONDefinitionProviderTarget(target:JSONDefinitionProviderTarget,targetJson:string):void {
    if (!target || verified.get(target)!==hash(targetJson)) fail("verified shared source closure required");
}

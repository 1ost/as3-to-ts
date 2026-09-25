import {createHash} from "node:crypto";
import {HardenedSemanticError} from "./contracts";
import {verifySharedProviderTarget} from "./reflection-provider-authority";

export interface ErrorStackProviderTarget { readonly module: string; readonly typeModule:string; }
const MODULE = "src/layaAir/flash/utils/AS3ErrorStack.ts";
const TYPE_MODULE = "src/layaAir/flash/errors/AS3SourceError.ts";
const SDK = "e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546";
const TARGETS = [{module:MODULE,export:"sourceErrorStack",
    signature:"(value: Error, firstLine: string) => string"}];
const TYPE_TARGETS = [
    {module:TYPE_MODULE,export:"AS3Error",signature:"typeof AS3Error",
        constructors:["new (message?: unknown, id?: unknown): AS3Error"]},
    {module:TYPE_MODULE,export:"isAS3ErrorRuntimeType",
        signature:"(value: unknown) => boolean"},
];
const verified = new WeakMap<object,{targetHash:string;sourceHash:string}>();
const hash = (text:string):string => createHash("sha256").update(text).digest("hex");
const canonical = (value:any):string => value===null||typeof value!=="object"?JSON.stringify(value)
    :Array.isArray(value)?"["+value.map(canonical).join(",")+"]"
    :"{"+Object.keys(value).sort().map(key=>JSON.stringify(key)+":"+canonical(value[key])).join(",")+"}";
function fail(message:string):never {
    throw new HardenedSemanticError("HARDENED_ERROR_STACK_PROVIDER_AUTHORITY","Error stack provider: "+message);
}

export function loadErrorStackProviderTarget(proof:string,targetPath:string,targetJson:string,
    sourceJson:string):ErrorStackProviderTarget {
    try {
        const document=JSON.parse(proof),source=JSON.parse(sourceJson);
        if (canonical(document)+"\n"!==proof
            || Object.keys(document).sort().join(",")!=="schema,sourceArtifactSha256,stackTarget,typeTarget"
            || document.schema!=="as3-error-stack-provider@1" || document.sourceArtifactSha256!==SDK
            || source.sourceArtifactSha256!==SDK || !Array.isArray(source.entries))
            return fail("exact native SDK Error authority required");
        const entries=source.entries.filter((row:any)=>row.qname==="Error" && row.baseQName==="Object"
            && row.dynamic===true && Array.isArray(row.ownInstanceMemberNames)
            && row.ownInstanceMemberNames.includes("getStackTrace"));
        if (entries.length!==1) return fail("native Error.getStackTrace declaration required");
        verifySharedProviderTarget(canonical(document.stackTarget)+"\n",targetPath,targetJson,
            "as3-error-stack-provider-target@1",TARGETS);
        verifySharedProviderTarget(canonical(document.typeTarget)+"\n",targetPath,targetJson,
            "as3-error-runtime-type-target@1",TYPE_TARGETS,[],"api.flash.errors");
    } catch(error) { return fail(error instanceof Error?error.message:String(error)); }
    const target=Object.freeze({module:MODULE,typeModule:TYPE_MODULE});
    verified.set(target,{targetHash:hash(targetJson),sourceHash:JSON.parse(proof).typeTarget.targetSources[TYPE_MODULE]});
    return target;
}
export function assertErrorStackProviderTarget(target:ErrorStackProviderTarget,targetJson:string):void {
    if (!target || verified.get(target)?.targetHash!==hash(targetJson))
        fail("verified shared source closure required");
}
export function errorTypeProviderSource(target:ErrorStackProviderTarget):{module:string;sha256:string} {
    const state=verified.get(target);
    if (!state) return fail("provider is not verified");
    return {module:TYPE_MODULE,sha256:state.sourceHash};
}

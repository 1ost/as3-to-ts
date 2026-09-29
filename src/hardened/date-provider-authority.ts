import {createHash} from "node:crypto";
import {HardenedSemanticError} from "./contracts";
import {verifySharedProviderTarget} from "./reflection-provider-authority";

export interface DateProviderTarget { readonly module: string; }
const MODULE = "src/layaAir/flash/utils/AS3Date.ts";
const TARGETS = [
    {module:MODULE,export:"AS3Date",signature:"typeof AS3Date",constructors:["new (...components: (number | string)[]): AS3Date"]},
    {module:MODULE,export:"isFlashDate",signature:"(candidate: unknown) => candidate is AS3Date"},
    {module:MODULE,export:"as3DateReceiver",signature:"(candidate: unknown) => AS3Date"},
];
const verified = new WeakMap<object,{targetHash:string;sourceHash:string}>();
const hash = (text:string):string => createHash("sha256").update(text).digest("hex");
function fail(message:string):never { throw new HardenedSemanticError("HARDENED_DATE_PROVIDER_AUTHORITY",message); }

export function loadDateProviderTarget(proof:string,targetPath:string,targetJson:string):DateProviderTarget {
    try { verifySharedProviderTarget(proof,targetPath,targetJson,"as3-date-provider-target@1",TARGETS); }
    catch(error) { return fail("Date provider: "+(error instanceof Error?error.message:String(error))); }
    const target=Object.freeze({module:MODULE});
    verified.set(target,{targetHash:hash(targetJson),sourceHash:JSON.parse(proof).targetSources[MODULE]});
    return target;
}
export function assertDateProviderTarget(target:DateProviderTarget,targetJson:string):void {
    if (!target || verified.get(target)?.targetHash!==hash(targetJson)) fail("Date provider requires verified source closure");
}
export function dateProviderSource(target:DateProviderTarget):{module:string;sha256:string} {
    const state=verified.get(target);
    if (!state) return fail("Date provider is not verified");
    return {module:MODULE,sha256:state.sourceHash};
}

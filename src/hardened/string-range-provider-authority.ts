import {createHash} from "node:crypto";
import {HardenedSemanticError} from "./contracts";
import {verifySharedProviderTarget} from "./reflection-provider-authority";

export interface StringRangeProviderTarget { readonly module: string; }
const MODULE = "src/layaAir/flash/utils/AS3StringIntrinsics.ts";
const TARGETS = ["CharAt","Slice","Substring"].map(name=>({module:MODULE,export:"sourceString"+name,
    signature:"(value: unknown, args: unknown[], coerce?: (value: unknown) => number) => string"})).concat([{
    module:MODULE,export:"sourceStringCharCodeAt",
    signature:"(value: unknown, args: unknown[], coerce?: (value: unknown) => number) => number",
},{
    module:MODULE,export:"sourceStringFromCharCodes",
    signature:"(codes: unknown) => string",
}]);
const verified = new WeakMap<object,{targetHash:string;sourceHash:string}>();
const hash = (text:string):string => createHash("sha256").update(text).digest("hex");
function fail(message:string):never { throw new HardenedSemanticError("HARDENED_STRING_RANGE_PROVIDER_AUTHORITY",message); }

export function loadStringRangeProviderTarget(proof:string,targetPath:string,targetJson:string):StringRangeProviderTarget {
    try { verifySharedProviderTarget(proof,targetPath,targetJson,"as3-string-range-provider-target@1",TARGETS); }
    catch(error) { return fail("String range provider: "+(error instanceof Error?error.message:String(error))); }
    const target=Object.freeze({module:MODULE});
    verified.set(target,{targetHash:hash(targetJson),sourceHash:JSON.parse(proof).targetSources[MODULE]});
    return target;
}
export function assertStringRangeProviderTarget(target:StringRangeProviderTarget,targetJson:string):void {
    if (!target || verified.get(target)?.targetHash!==hash(targetJson)) fail("String range provider requires verified source closure");
}

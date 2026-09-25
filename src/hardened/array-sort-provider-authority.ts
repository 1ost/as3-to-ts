import {createHash} from "node:crypto";
import {HardenedSemanticError} from "./contracts";
import {verifySharedProviderTarget} from "./reflection-provider-authority";

export interface ArraySortProviderTarget { readonly module: string; }
const MODULE = "src/layaAir/flash/utils/AS3ArraySort.ts";
const TARGETS = [{module:MODULE,export:"sourceArraySortCallback",
    signature:"(value: unknown, callback: unknown, invoke: (target: unknown, args: unknown[]) => unknown, coerce: (value: unknown) => number) => unknown[]"}];
const verified = new WeakMap<object,{targetHash:string;sourceHash:string}>();
const hash = (text:string):string => createHash("sha256").update(text).digest("hex");
function fail(message:string):never { throw new HardenedSemanticError("HARDENED_STRING_RANGE_PROVIDER_AUTHORITY",message); }

export function loadArraySortProviderTarget(proof:string,targetPath:string,targetJson:string):ArraySortProviderTarget {
    try { verifySharedProviderTarget(proof,targetPath,targetJson,"as3-array-sort-provider-target@1",TARGETS); }
    catch(error) { return fail("Array sort provider: "+(error instanceof Error?error.message:String(error))); }
    const target=Object.freeze({module:MODULE});
    verified.set(target,{targetHash:hash(targetJson),sourceHash:JSON.parse(proof).targetSources[MODULE]});
    return target;
}
export function assertArraySortProviderTarget(target:ArraySortProviderTarget,targetJson:string):void {
    if (!target || verified.get(target)?.targetHash!==hash(targetJson)) fail("Array sort provider requires verified source closure");
}

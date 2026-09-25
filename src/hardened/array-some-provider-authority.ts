import {createHash} from "node:crypto";
import {HardenedSemanticError} from "./contracts";
import {verifySharedProviderTarget} from "./reflection-provider-authority";

export interface ArraySomeProviderTarget { readonly module: string; }
const MODULE = "src/layaAir/flash/utils/AS3ArraySome.ts";
const TARGETS = [{module:MODULE,export:"sourceArraySome",
    signature:"(value: unknown[], callback: Function | null, receiver: unknown, read: (value: unknown, index: number) => unknown) => boolean"}];
const verified = new WeakMap<object,{targetHash:string;sourceHash:string}>();
const hash = (text:string):string => createHash("sha256").update(text).digest("hex");
function fail(message:string):never { throw new HardenedSemanticError("HARDENED_ARRAY_SOME_PROVIDER_AUTHORITY",message); }

export function loadArraySomeProviderTarget(proof:string,targetPath:string,targetJson:string):ArraySomeProviderTarget {
    try { verifySharedProviderTarget(proof,targetPath,targetJson,"as3-array-some-provider-target@1",TARGETS); }
    catch(error) { return fail("Array some provider: "+(error instanceof Error?error.message:String(error))); }
    const target=Object.freeze({module:MODULE});
    verified.set(target,{targetHash:hash(targetJson),sourceHash:JSON.parse(proof).targetSources[MODULE]});
    return target;
}
export function assertArraySomeProviderTarget(target:ArraySomeProviderTarget,targetJson:string):void {
    if (!target || verified.get(target)?.targetHash!==hash(targetJson)) fail("Array some provider requires verified source closure");
}

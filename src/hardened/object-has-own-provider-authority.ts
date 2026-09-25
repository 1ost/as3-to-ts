import {createHash} from "node:crypto";
import {HardenedSemanticError} from "./contracts";
import {verifySharedProviderTarget} from "./reflection-provider-authority";

export interface ObjectHasOwnPropertyProviderTarget { readonly module: string; }
const MODULE = "src/layaAir/flash/utils/AS3Property.ts";
const TARGETS = [{module:MODULE,export:"as3HasOwnProperty",
    signature:"(target: unknown, key: unknown) => boolean"}];
const verified = new WeakMap<object,{targetHash:string;sourceHash:string}>();
const hash = (text:string):string => createHash("sha256").update(text).digest("hex");
function fail(message:string):never {
    throw new HardenedSemanticError("HARDENED_OBJECT_HAS_OWN_PROVIDER_AUTHORITY",message);
}

export function loadObjectHasOwnPropertyProviderTarget(proof:string,targetPath:string,targetJson:string):ObjectHasOwnPropertyProviderTarget {
    try {
        verifySharedProviderTarget(proof,targetPath,targetJson,"as3-object-has-own-provider-target@1",TARGETS);
    } catch(error) {
        return fail("Object hasOwnProperty provider: "+(error instanceof Error?error.message:String(error)));
    }
    const target=Object.freeze({module:MODULE});
    verified.set(target,{targetHash:hash(targetJson),sourceHash:JSON.parse(proof).targetSources[MODULE]});
    return target;
}

export function assertObjectHasOwnPropertyProviderTarget(target:ObjectHasOwnPropertyProviderTarget,targetJson:string):void {
    if (!target || verified.get(target)?.targetHash!==hash(targetJson))
        fail("Object hasOwnProperty provider requires verified source closure");
}

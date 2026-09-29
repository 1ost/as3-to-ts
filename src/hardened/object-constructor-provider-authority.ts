import {createHash} from "node:crypto";
import {HardenedSemanticError} from "./contracts";
import {verifySharedProviderTarget} from "./reflection-provider-authority";

export interface ObjectConstructorProviderTarget { readonly module: string; }
const MODULE = "src/layaAir/flash/utils/AS3DynamicObject.ts";
const TARGETS = [{module:MODULE,export:"as3CreateDynamicObject",
    signature:"() => Record<string, any>"}];
const verified = new WeakMap<object,{targetHash:string;sourceHash:string}>();
const hash = (text:string):string => createHash("sha256").update(text).digest("hex");
function fail(message:string):never {
    throw new HardenedSemanticError("HARDENED_OBJECT_CONSTRUCTOR_PROVIDER_AUTHORITY",message);
}

export function loadObjectConstructorProviderTarget(proof:string,targetPath:string,targetJson:string):ObjectConstructorProviderTarget {
    try {
        verifySharedProviderTarget(proof,targetPath,targetJson,"as3-object-constructor-provider-target@1",TARGETS);
    } catch(error) {
        return fail("Object constructor provider: "+(error instanceof Error?error.message:String(error)));
    }
    const target=Object.freeze({module:MODULE});
    verified.set(target,{targetHash:hash(targetJson),sourceHash:JSON.parse(proof).targetSources[MODULE]});
    return target;
}

export function assertObjectConstructorProviderTarget(target:ObjectConstructorProviderTarget,targetJson:string):void {
    if (!target || verified.get(target)?.targetHash!==hash(targetJson))
        fail("Object constructor provider requires verified source closure");
}

import {createHash} from "node:crypto";
import {HardenedSemanticError} from "./contracts";
import {verifySharedProviderTarget} from "./reflection-provider-authority";

export interface MathFloorProviderTarget { readonly module: string; }
const MODULE = "src/layaAir/flash/utils/AS3Math.ts";
const TARGETS = [{module:MODULE,export:"sourceMathFloor",
    signature:"(value: number) => number"},
{module:MODULE,export:"sourceMathRandom",signature:"() => number"}];
const verified = new WeakMap<object,{targetHash:string;sourceHash:string}>();
const hash = (text:string):string => createHash("sha256").update(text).digest("hex");
function fail(message:string):never { throw new HardenedSemanticError("HARDENED_MATH_FLOOR_PROVIDER_AUTHORITY",message); }

export function loadMathFloorProviderTarget(proof:string,targetPath:string,targetJson:string):MathFloorProviderTarget {
    try { verifySharedProviderTarget(proof,targetPath,targetJson,"as3-math-floor-provider-target@1",TARGETS); }
    catch(error) { return fail("Math floor provider: "+(error instanceof Error?error.message:String(error))); }
    const target=Object.freeze({module:MODULE});
    verified.set(target,{targetHash:hash(targetJson),sourceHash:JSON.parse(proof).targetSources[MODULE]});
    return target;
}
export function assertMathFloorProviderTarget(target:MathFloorProviderTarget,targetJson:string):void {
    if (!target || verified.get(target)?.targetHash!==hash(targetJson)) fail("Math floor provider requires verified source closure");
}

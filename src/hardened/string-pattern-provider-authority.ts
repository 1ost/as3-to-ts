import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {dirname, resolve} from "node:path";
import {HardenedSemanticError} from "./contracts";
import {verifySharedProviderTarget} from "./reflection-provider-authority";

export interface StringPatternProviderTarget { readonly module: string; readonly regExpModule?: string; readonly regExpMembers?: true; }
const MODULE = "src/layaAir/flash/utils/AS3StringIntrinsics.ts";
const TARGETS = [
    {module:MODULE, export:"compileSourceStringPattern", signature:"(source: string, flags?: string) => SourceStringPattern"},
    {module:MODULE, export:"sourceStringReplace", signature:"(value: string, pattern: SourceStringPattern, replacement: unknown) => string"},
];
const REGEXP_MODULE = "src/layaAir/flash/utils/AS3RegExp.ts";
const REGEXP_TARGETS = [...TARGETS,
    {module:REGEXP_MODULE,export:"sourceRegExpReplaceWithInvoker",signature:"(value: string, expression: AS3RegExp | null, replacement: unknown, invoke: (target: Function, args: unknown[]) => unknown) => string"},
    {module:REGEXP_MODULE,export:"AS3RegExp",signature:"typeof AS3RegExp",constructors:["new (input?: unknown, options?: unknown): AS3RegExp"]},
    {module:REGEXP_MODULE,export:"isAS3RegExp",signature:"(value: unknown) => value is AS3RegExp"},
    {module:REGEXP_MODULE,export:"sourceRegExpReplace",signature:"(value: string, expression: AS3RegExp | null, replacement: unknown) => string"},
];
const verified = new WeakMap<object, {hash:string;root:string;sources:Record<string,string>;patterns:Map<string,boolean>}>();
const hash = (text:string):string => createHash("sha256").update(text).digest("hex");
function fail(message:string):never { throw new HardenedSemanticError("HARDENED_STRING_PATTERN_PROVIDER_AUTHORITY",message); }

export function loadStringPatternProviderTarget(proof:string, targetPath:string, targetJson:string):StringPatternProviderTarget {
    const members = JSON.parse(proof).schema === "as3-string-pattern-provider-target@3";
    const regexp = members || JSON.parse(proof).schema === "as3-string-pattern-provider-target@2";
    const targets=members?[...REGEXP_TARGETS,{module:REGEXP_MODULE,export:"as3RegExpReceiver",signature:"(value: unknown) => AS3RegExp"}]:regexp?REGEXP_TARGETS:TARGETS;
    try { verifySharedProviderTarget(proof,targetPath,targetJson,members ? "as3-string-pattern-provider-target@3" : regexp ? "as3-string-pattern-provider-target@2" : "as3-string-pattern-provider-target@1",targets); }
    catch (error) { fail("String pattern provider: " + (error instanceof Error ? error.message : String(error))); }
    const target = Object.freeze({module:MODULE,...(regexp ? {regExpModule:REGEXP_MODULE} : {}),...(members?{regExpMembers:true as const}:{})});
    verified.set(target,{hash:hash(targetJson),root:resolve(dirname(targetPath),"../.."),
        sources:(JSON.parse(proof) as {targetSources:Record<string,string>}).targetSources,patterns:new Map()});
    return target;
}
export function assertStringPatternProviderTarget(target:StringPatternProviderTarget,targetJson:string):void {
    if (!target || verified.get(target)?.hash !== hash(targetJson)) fail("String pattern provider requires verified source closure");
}

/** Ask the pinned engine's own parser, in a bounded child process, rather than duplicating its grammar. */
export function admitsStringPatternLiteral(target:StringPatternProviderTarget,literal:string):boolean {
    const state = verified.get(target);
    if (!state) return fail("Unverified string pattern provider");
    if (literal.length > 4096) return false;
    const match = /^\/([\s\S]+)\/([a-z]*)$/.exec(literal);
    if (!match) return false;
    if (state.patterns.has(literal)) return state.patterns.get(literal)!;
    const result=spawnSync(process.execPath,[resolve(__dirname,"../tools/qualify-laya-string-pattern.cjs")],
        {encoding:"utf8",timeout:30000,maxBuffer:1024*1024,input:JSON.stringify({root:state.root,
            sources:state.sources,module:MODULE,source:match[1],flags:match[2]})});
    if (result.status !== 0) fail("Pinned string pattern parser failed: " + result.stderr);
    let output:unknown;
    try { output=JSON.parse(result.stdout); } catch { return fail("Invalid string pattern parser response"); }
    if (!output || typeof output!=="object" || Object.keys(output).join()!=="admitted"
        || typeof (output as {admitted:unknown}).admitted!=="boolean") return fail("Invalid string pattern parser response");
    const admitted=(output as {admitted:boolean}).admitted;
    state.patterns.set(literal,admitted);
    return admitted;
}

/** A target identity only after the complete provider closure has been checked. */
export function regExpProviderSource(target:StringPatternProviderTarget):{module:string;sha256:string} {
    const state=verified.get(target);
    if (!state || target.regExpModule!==REGEXP_MODULE) return fail("RegExp object provider is not verified");
    return {module:REGEXP_MODULE,sha256:state.sources[REGEXP_MODULE]!};
}

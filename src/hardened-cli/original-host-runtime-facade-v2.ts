import {Buffer} from "node:buffer";
import {createHash} from "node:crypto";
import {posix} from "node:path";
import ts49 = require("typescript-4-9");
import {CliError} from "./errors";
import type {EmittedBrowserEsmRuntime} from "./browser-esm-runtime";

const ABI_EXPORT="AS3_ORIGINAL_HOST_RUNTIME_ABI";
const ABI_SCHEMA="as3-original-host-runtime-abi@2";
const RECEIPT_SCHEMA="as3-original-host-runtime-facade-candidate-receipt@2";
const OUTPUT_PATH="AS3OriginalHostRuntime.bundle-candidate.mjs";
const RECEIPT_PATH="AS3OriginalHostRuntime.bundle-candidate-receipt.json";
const OPERATIONS=Object.freeze(["preflightAS3TypeAuthority","installAS3EmbeddedBitmapDataHost",
    "installAS3TimerExecutionCapture","commitAS3TypeAuthority","abortAS3TypeAuthority",
    "poisonAS3TypeAuthority"] as const);
const SHA256=/^[0-9a-f]{64}$/;
const IDENTIFIER=/^[A-Za-z_$][A-Za-z0-9_$]*$/;

interface ArtifactIdentity {readonly path:string;readonly bytes:number;readonly sha256:string;}
interface ModuleBinding {readonly path:string;}
interface CompilerProviderPin {readonly repository:string;readonly commit:string;readonly packageLockSha256:string;
    readonly authoritySha256:string;readonly authorityPath:string;}
export interface OriginalHostRuntimeFacadeV2Bindings {
    readonly application:ModuleBinding&Readonly<{startOperation:string}>;
    readonly authority:ModuleBinding&Readonly<{documentExport:string;typeIdentityExport:string}>;
    readonly registry:ModuleBinding&Readonly<{preflightOperation:string;commitOperation:string;abortOperation:string;
        poisonOperation:string;receiptPredicate:string}>;
    readonly embeddedHost:ModuleBinding&Readonly<{prepareOperation:string;commitOperation:string;abortOperation:string}>;
    readonly timerCapture:ModuleBinding&Readonly<{prepareOperation:string;commitOperation:string;abortOperation:string}>;
}
export interface OriginalHostRuntimeFacadeV2Pin {
    readonly schema:"as3-original-host-runtime-facade-pin@2";
    readonly typeAuthoritySha256:string;
    readonly runtimeClosureSha256:string;
    readonly compilerProvider:CompilerProviderPin;
    readonly bindings:OriginalHostRuntimeFacadeV2Bindings;
}
export interface EmittedOriginalHostRuntimeFacadeV2Candidate {
    readonly root:"original-host-runtime-facade-v2-candidate";
    readonly module:ArtifactIdentity;
    readonly receipt:ArtifactIdentity;
    readonly files:readonly Readonly<{path:string;body:string;identity:ArtifactIdentity}>[];
}

/**
 * Derives a document-producing candidate from the compiler's exact legacy
 * authority source. Only the immediate registry import and install call are
 * replaced. This helper is not selected by the maintained CLI/output path.
 */
export function deferOriginalHostRuntimeAuthoritySource(source:string):string {
    if(typeof source!=="string"||!source.endsWith("\n"))throw new CliError("original-host authority source is invalid",6);
    const parsed=ts49.createSourceFile("AS3Authority.generated.ts",source,ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.TS);
    if((parsed as any).parseDiagnostics.length)throw new CliError("original-host authority source did not parse",4);
    let registryImport:ts49.ImportDeclaration|null=null,installation:ts49.ExpressionStatement|null=null,
        argument:ts49.ObjectLiteralExpression|null=null;
    for(const statement of parsed.statements) {
        if(ts49.isImportDeclaration(statement)&&ts49.isStringLiteral(statement.moduleSpecifier)
            &&statement.moduleSpecifier.text==="./internal/AS3TypeRegistry") {
            const bindings=statement.importClause?.namedBindings;
            if(registryImport!==null||statement.importClause?.name||!bindings||!ts49.isNamedImports(bindings)
                ||bindings.elements.length!==1||bindings.elements[0]!.propertyName
                ||bindings.elements[0]!.name.text!=="installAS3TypeAuthority")
                throw new CliError("original-host authority registry import differs",6);
            registryImport=statement;continue;
        }
        if(ts49.isExpressionStatement(statement)&&ts49.isCallExpression(statement.expression)
            &&ts49.isIdentifier(statement.expression.expression)&&statement.expression.expression.text==="installAS3TypeAuthority") {
            if(installation!==null||statement.expression.arguments.length!==1
                ||!ts49.isObjectLiteralExpression(statement.expression.arguments[0]!))
                throw new CliError("original-host authority installation differs",6);
            installation=statement;argument=statement.expression.arguments[0] as ts49.ObjectLiteralExpression;
        }
        if(ts49.isExpressionStatement(statement)&&ts49.isCallExpression(statement.expression)
            &&ts49.isIdentifier(statement.expression.expression)&&statement.expression.expression.text==="installAS3ReflectionProvider")
            throw new CliError("original-host authority cannot defer an immediate reflection provider",6);
    }
    if(!registryImport||!installation||!argument)throw new CliError("original-host authority lacks its exact immediate installation",6);
    const properties=argument.properties.map(property=>{
        if(ts49.isShorthandPropertyAssignment(property))return property.name.text;
        if(ts49.isPropertyAssignment(property)&&(ts49.isIdentifier(property.name)||ts49.isStringLiteral(property.name)))return property.name.text;
        return "";
    });
    if(properties.join("\0")!=="schema\0sha256\0qnames\0entries")
        throw new CliError("original-host authority document schema differs",6);
    let installerIdentifiers=0;const count=(node:ts49.Node):void=>{if(ts49.isIdentifier(node)&&node.text==="installAS3TypeAuthority")installerIdentifiers++;
        ts49.forEachChild(node,count);};count(parsed);
    if(installerIdentifiers!==2)throw new CliError("original-host authority installer identity escaped",6);
    const document=`export const AS3_TYPE_AUTHORITY_DOCUMENT = Object.freeze(${argument.getText(parsed)});`;
    const edits=[{start:installation.getStart(parsed),end:installation.getEnd(),text:document},
        {start:registryImport.getStart(parsed),end:registryImport.getEnd(),text:""}].sort((left,right)=>right.start-left.start);
    let result=source;for(const edit of edits)result=result.slice(0,edit.start)+edit.text+result.slice(edit.end);
    const reparsed=ts49.createSourceFile("AS3Authority.deferred.ts",result,ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.TS);
    if((reparsed as any).parseDiagnostics.length||result.includes("installAS3TypeAuthority"))
        throw new CliError("original-host deferred authority source differs",4);
    return result;
}

function sha256(value:string):string{return createHash("sha256").update(value,"utf8").digest("hex");}
function compare(left:string,right:string):number{return Buffer.compare(Buffer.from(left,"utf8"),Buffer.from(right,"utf8"));}
function artifact(path:string,body:string):ArtifactIdentity {
    return Object.freeze({path,bytes:Buffer.byteLength(body,"utf8"),sha256:sha256(body)});
}
function canonicalJson(value:unknown):string {
    if(value===null||typeof value==="boolean"||typeof value==="string")return JSON.stringify(value);
    if(typeof value==="number"&&Number.isFinite(value))return JSON.stringify(value);
    if(Array.isArray(value))return `[${value.map(canonicalJson).join(",")}]`;
    if(value&&typeof value==="object"&&Object.getPrototypeOf(value)===Object.prototype) {
        const record=value as Record<string,unknown>;
        return `{${Object.keys(record).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
    }
    throw new CliError("original-host facade authority contains a non-JSON value",6);
}
function exactKeys(value:unknown,keys:readonly string[]):value is Record<string,unknown> {
    if(!value||typeof value!=="object"||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)return false;
    const descriptors=Object.getOwnPropertyDescriptors(value),actual=Object.keys(descriptors).sort(),expected=[...keys].sort();
    return actual.length===expected.length&&actual.every((key,index)=>key===expected[index]
        &&Object.prototype.hasOwnProperty.call(descriptors[key],"value"));
}
function safePath(value:string):boolean{return /^(?:[A-Za-z0-9_$.-]+\/)*[A-Za-z0-9_$.-]+\.mjs$/.test(value)
    &&posix.normalize(value)===value&&!value.startsWith("../");}
function safeIdentifier(value:unknown):value is string{return typeof value==="string"&&IDENTIFIER.test(value);}
function validateCompilerProvider(value:unknown):asserts value is CompilerProviderPin {
    if(!exactKeys(value,["authorityPath","authoritySha256","commit","packageLockSha256","repository"])
        ||typeof value.repository!=="string"||!value.repository||typeof value.authorityPath!=="string"||!value.authorityPath
        ||typeof value.commit!=="string"||!/^[0-9a-f]{40}$/.test(value.commit)
        ||typeof value.packageLockSha256!=="string"||!SHA256.test(value.packageLockSha256)
        ||typeof value.authoritySha256!=="string"||!SHA256.test(value.authoritySha256))
        throw new CliError("original-host facade compiler provider is invalid",6);
}
function resolveOwned(from:string,requested:string,owned:ReadonlySet<string>):string|null {
    if(!requested.startsWith("."))return null;
    const candidate=posix.normalize(posix.join(posix.dirname(from),requested));
    for(const path of [candidate,`${candidate}.mjs`,`${candidate}.js`])if(owned.has(path))return path;
    return null;
}

function validateBindings(value:unknown,owned:ReadonlySet<string>):asserts value is OriginalHostRuntimeFacadeV2Bindings {
    if(!exactKeys(value,["application","authority","embeddedHost","registry","timerCapture"]))
        throw new CliError("original-host facade bindings are not closed",6);
    const records=[
        [value.application,["path","startOperation"]],
        [value.authority,["documentExport","path","typeIdentityExport"]],
        [value.registry,["abortOperation","commitOperation","path","poisonOperation","preflightOperation","receiptPredicate"]],
        [value.embeddedHost,["abortOperation","commitOperation","path","prepareOperation"]],
        [value.timerCapture,["abortOperation","commitOperation","path","prepareOperation"]],
    ] as const;
    for(const [raw,keys] of records) {
        if(!exactKeys(raw,keys)||!safePath(raw.path as string)||!owned.has(raw.path as string)
            ||keys.filter(key=>key!=="path").some(key=>!safeIdentifier(raw[key])))
            throw new CliError("original-host facade binding inventory is invalid",6);
    }
}

function runtimeEvidence(runtime:EmittedBrowserEsmRuntime,bindings:OriginalHostRuntimeFacadeV2Bindings):unknown {
    return {schema:"as3-original-host-runtime-source-closure@2",bindings,files:[...runtime.files]
        .sort((left,right)=>compare(left.path,right.path)).map(file=>({path:file.path,bytes:file.identity.bytes,
            sha256:file.identity.sha256,imports:file.imports.map(item=>({specifier:item.specifier,path:item.path}))}))};
}

/** Hash only this canonical compiler-owned closure. A release pin must be supplied independently. */
export function originalHostRuntimeFacadeV2ClosureSha256(runtime:EmittedBrowserEsmRuntime,
    bindings:OriginalHostRuntimeFacadeV2Bindings):string {
    if(!runtime||runtime.root!=="achievement-primary-runtime"||!Array.isArray(runtime.files))
        throw new CliError("original-host facade runtime input is invalid",6);
    const owned=new Set(runtime.files.map(file=>file.path));validateBindings(bindings,owned);
    return sha256(canonicalJson(runtimeEvidence(runtime,bindings)));
}

function auditPrivateModuleEvaluation(path:string,source:string):void {
    const parsed=ts49.createSourceFile(path,source,ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.JS);
    if((parsed as any).parseDiagnostics.length)throw new CliError(`original-host facade source did not parse: ${path}`,4);
    let forbidden:string|null=null;
    const localFunctions=new Set(parsed.statements.filter(ts49.isFunctionDeclaration)
        .map(statement=>statement.name?.text).filter((value):value is string=>value!==undefined));
    const forbiddenAmbient=new Set(["globalThis","window","self","document","process","require","module","exports","eval","WebAssembly"]);
    const initializer=(node:ts49.Node):void=>{
        if(ts49.isFunctionExpression(node)||ts49.isArrowFunction(node)||ts49.isClassExpression(node))return;
        if(ts49.isCallExpression(node)) {
            const allowed=ts49.isIdentifier(node.expression)&&localFunctions.has(node.expression.text)
                ||ts49.isPropertyAccessExpression(node.expression)&&ts49.isIdentifier(node.expression.expression)
                &&node.expression.expression.text==="Object"&&node.expression.name.text==="freeze";
            if(!allowed)forbidden="top-level call outside Object.freeze";
        } else if(ts49.isNewExpression(node)) {
            if(!ts49.isIdentifier(node.expression)||!["Map","Set","WeakMap","WeakSet"].includes(node.expression.text))
                forbidden="top-level construction outside private collection state";
        } else if(ts49.isAwaitExpression(node)||ts49.isYieldExpression(node)||ts49.isTaggedTemplateExpression(node)
            ||ts49.isSpreadElement(node)||ts49.isSpreadAssignment(node))forbidden="top-level executable expansion";
        else if((ts49.isGetAccessorDeclaration(node)||ts49.isSetAccessorDeclaration(node))
            &&ts49.isObjectLiteralExpression(node.parent))forbidden="top-level object accessor";
        else if(ts49.isComputedPropertyName(node))forbidden="top-level computed property";
        if(ts49.isIdentifier(node)&&forbiddenAmbient.has(node.text))forbidden=`ambient ${node.text}`;
        if((ts49.isCallExpression(node)||ts49.isNewExpression(node))&&ts49.isIdentifier(node.expression)
            &&node.expression.text==="Function")forbidden="dynamic Function construction";
        ts49.forEachChild(node,initializer);
    };
    for(const statement of parsed.statements) {
        if(ts49.isImportDeclaration(statement)||ts49.isExportDeclaration(statement)
            ||ts49.isFunctionDeclaration(statement)||ts49.isInterfaceDeclaration(statement)
            ||ts49.isTypeAliasDeclaration(statement)||ts49.isEmptyStatement(statement))continue;
        if(ts49.isClassDeclaration(statement)) {
            for(const member of statement.members)if(ts49.isClassStaticBlockDeclaration(member)
                ||ts49.isPropertyDeclaration(member)&&member.initializer)forbidden="eager class initialization";
            continue;
        }
        if(ts49.isVariableStatement(statement)) {
            for(const declaration of statement.declarationList.declarations)if(declaration.initializer)initializer(declaration.initializer);
            continue;
        }
        if(ts49.isExportAssignment(statement))forbidden="export assignment";
        else forbidden="top-level executable statement";
    }
    if(forbidden)throw new CliError(`original-host facade module evaluation is not private-state constrained (${forbidden}): ${path}`,4);
}

interface Factory {readonly id:string;readonly body:string;readonly identity:ArtifactIdentity;readonly requests:readonly string[];}
function commonJsFactory(path:string,source:string):Factory {
    auditPrivateModuleEvaluation(path,source);
    const output=ts49.transpileModule(source,{fileName:path,reportDiagnostics:true,compilerOptions:{target:ts49.ScriptTarget.ES2020,
        module:ts49.ModuleKind.CommonJS,importsNotUsedAsValues:ts49.ImportsNotUsedAsValues.Remove}});
    if((output.diagnostics||[]).some(item=>item.category===ts49.DiagnosticCategory.Error))
        throw new CliError(`original-host facade factory transpilation failed: ${path}`,4);
    const body=output.outputText.replace(/\r\n?/g,"\n").replace(/\n*$/,"\n");
    const parsed=ts49.createSourceFile(path,body,ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.JS),requests:string[]=[];
    if((parsed as any).parseDiagnostics.length)throw new CliError(`original-host facade factory did not parse: ${path}`,4);
    let forbidden:string|null=null;
    const visit=(node:ts49.Node):void=>{
        if(ts49.isIdentifier(node)&&node.text==="require") {
            const direct=ts49.isCallExpression(node.parent)&&node.parent.expression===node;
            const propertyName=ts49.isPropertyAccessExpression(node.parent)&&node.parent.name===node
                ||ts49.isPropertyAssignment(node.parent)&&node.parent.name===node;
            if(direct) {
                if(node.parent.arguments.length!==1||!ts49.isStringLiteral(node.parent.arguments[0]!))
                    forbidden="dynamic CommonJS resolution";
                else requests.push(node.parent.arguments[0]!.text);
            } else if(!propertyName)forbidden="escaped require identity";
        }
        if(ts49.isCallExpression(node)&&node.expression.kind===ts49.SyntaxKind.ImportKeyword)forbidden="dynamic import";
        if(ts49.isMetaProperty(node)&&node.keywordToken===ts49.SyntaxKind.ImportKeyword)forbidden="import metadata";
        if(ts49.isIdentifier(node)&&["globalThis","window","self","process","eval","WebAssembly"].includes(node.text))
            forbidden=`ambient ${node.text}`;
        if((ts49.isCallExpression(node)||ts49.isNewExpression(node))&&ts49.isIdentifier(node.expression)
            &&node.expression.text==="Function")forbidden="dynamic Function construction";
        ts49.forEachChild(node,visit);
    };visit(parsed);
    if(forbidden)throw new CliError(`original-host facade factory contains ${forbidden}: ${path}`,4);
    return Object.freeze({id:path,body,identity:artifact(path,body),requests:Object.freeze(requests)});
}

function runtimeSource(runtime:EmittedBrowserEsmRuntime,pin:OriginalHostRuntimeFacadeV2Pin,factories:readonly Factory[]):string {
    const binding=pin.bindings,lines=[
        "let __as3FacadeState = null;",
        "function __as3RequireFacade(receiver) {",
        `  if (receiver !== ${ABI_EXPORT}) throw new TypeError("AS3 original-host runtime operation receiver is not authentic");`,
        "  if (__as3FacadeState === null) {",
        `    const expected = ${JSON.stringify(["schema","typeAuthoritySha256","runtimeClosureSha256",...OPERATIONS])};`,
        `    const descriptors = Object.getOwnPropertyDescriptors(${ABI_EXPORT});`,
        "    const actual = Object.keys(descriptors);",
        "    if (actual.length !== expected.length || expected.some((key, index) => actual[index] !== key || !(\"value\" in descriptors[key]))) throw new TypeError(\"AS3 original-host runtime ABI was altered before first use\");",
        `    if (descriptors.schema.value !== ${JSON.stringify(ABI_SCHEMA)} || descriptors.typeAuthoritySha256.value !== ${JSON.stringify(pin.typeAuthoritySha256)} || descriptors.runtimeClosureSha256.value !== ${JSON.stringify(pin.runtimeClosureSha256)}) throw new TypeError("AS3 original-host runtime ABI identity differs");`,
        "    const operations = [preflightAS3TypeAuthority,installAS3EmbeddedBitmapDataHost,installAS3TimerExecutionCapture,commitAS3TypeAuthority,abortAS3TypeAuthority,poisonAS3TypeAuthority];",
        "    for (let index=0;index<operations.length;index+=1) if (descriptors[expected[index+3]].value !== operations[index]) throw new TypeError(\"AS3 original-host runtime ABI operation differs\");",
        `    Object.freeze(${ABI_EXPORT});`,
        "    __as3FacadeState = {phase:\"virgin\",runtime:null,reservation:null,bitmapPreparation:null,bitmapLease:null,timerPreparation:null,timerLease:null};",
        "  }",
        "  return __as3FacadeState;",
        "}",
        "function __as3RequirePhase(state, expected, message) {",
        "  if (expected.includes(state.phase)) return;",
        "  const prior=state.phase; state.phase=\"poisoning\";",
        "  if (state.runtime!==null && state.reservation!==null && ![\"aborted\",\"poisoned\"].includes(prior)) try { Reflect.apply(state.runtime.poison,undefined,[state.reservation]); } catch {}",
        "  if (state.runtime!==null) try { __as3CleanupHosts(state); } catch {}",
        "  state.phase=\"poisoned\"; throw new TypeError(message);",
        "}",
        "function __as3CreateRuntime() {",
        "  const factories = Object.create(null);",
        // Factory bodies are embedded byte-for-byte. Prefixing source lines would
        // alter multiline template-literal raw values even though provenance
        // continued to hash the unindented body.
        ...factories.map(factory=>`  factories[${JSON.stringify(factory.id)}] = function(module, exports, require) {\n${factory.body}};`),
        "  const cache = Object.create(null);",
        "  const load = id => {",
        "    if (cache[id] !== undefined) return cache[id].exports;",
        "    const factory = factories[id];",
        "    if (typeof factory !== \"function\") throw new Error(\"AS3 original-host embedded module is absent\");",
        "    const record = {exports:Object.create(null)}; cache[id] = record;",
        "    factory(record, record.exports, requested => {",
        "      if (typeof requested !== \"string\" || requested.charAt(0) !== \".\") throw new Error(\"AS3 original-host embedded dependency is unowned\");",
        "      const base = id.split(\"/\"); base.pop();",
        "      for (const part of requested.split(\"/\")) { if (part === \"\" || part === \".\") continue; if (part === \"..\") base.pop(); else base.push(part); }",
        "      const candidate = base.join(\"/\");",
        "      for (const target of [candidate, candidate + \".mjs\", candidate + \".js\"]) if (factories[target] !== undefined) return load(target);",
        "      throw new Error(\"AS3 original-host embedded dependency is absent\");",
        "    }); Object.freeze(record.exports); return record.exports;",
        "  };",
        `  const authority = load(${JSON.stringify(binding.authority.path)});`,
        `  const registry = load(${JSON.stringify(binding.registry.path)});`,
        `  const embedded = load(${JSON.stringify(binding.embeddedHost.path)});`,
        `  const timer = load(${JSON.stringify(binding.timerCapture.path)});`,
        "  const operation = (namespace, name) => { const value = namespace[name]; if (typeof value !== \"function\") throw new TypeError(\"AS3 original-host bound operation is absent\"); return value; };",
        `  if (authority[${JSON.stringify(binding.authority.typeIdentityExport)}] !== ${JSON.stringify(pin.typeAuthoritySha256)}) throw new TypeError("AS3 original-host type authority identity differs");`,
        `  const document = authority[${JSON.stringify(binding.authority.documentExport)}];`,
        "  if (document === null || typeof document !== \"object\" || document.sha256 !== "+JSON.stringify(pin.typeAuthoritySha256)+") throw new TypeError(\"AS3 original-host type authority document differs\");",
        "  return {document,preflight:operation(registry,"+JSON.stringify(binding.registry.preflightOperation)+"),commit:operation(registry,"+JSON.stringify(binding.registry.commitOperation)+"),abort:operation(registry,"+JSON.stringify(binding.registry.abortOperation)+"),poison:operation(registry,"+JSON.stringify(binding.registry.poisonOperation)+"),isReceipt:operation(registry,"+JSON.stringify(binding.registry.receiptPredicate)+"),prepareBitmap:operation(embedded,"+JSON.stringify(binding.embeddedHost.prepareOperation)+"),commitBitmap:operation(embedded,"+JSON.stringify(binding.embeddedHost.commitOperation)+"),abortBitmap:operation(embedded,"+JSON.stringify(binding.embeddedHost.abortOperation)+"),prepareTimer:operation(timer,"+JSON.stringify(binding.timerCapture.prepareOperation)+"),commitTimer:operation(timer,"+JSON.stringify(binding.timerCapture.commitOperation)+"),abortTimer:operation(timer,"+JSON.stringify(binding.timerCapture.abortOperation)+"),loadStartApplication:()=>operation(load("+JSON.stringify(binding.application.path)+"),"+JSON.stringify(binding.application.startOperation)+")};",
        "}",
        "function __as3DisposeLease(lease) { if (lease !== null && typeof lease.dispose === \"function\") lease.dispose(); }",
        "function __as3CleanupHosts(state) {",
        "  let first = null;",
        "  try { if (state.timerLease !== null) __as3DisposeLease(state.timerLease); else if (state.timerPreparation !== null) Reflect.apply(state.runtime.abortTimer,undefined,[state.timerPreparation]); } catch (error) { first = error; }",
        "  try { if (state.bitmapLease !== null) __as3DisposeLease(state.bitmapLease); else if (state.bitmapPreparation !== null) Reflect.apply(state.runtime.abortBitmap,undefined,[state.bitmapPreparation]); } catch (error) { if (first === null) first = error; }",
        "  state.timerLease=null; state.timerPreparation=null; state.bitmapLease=null; state.bitmapPreparation=null; if (first !== null) throw first;",
        "}",
        "function __as3CreateApplicationCapability(state) {",
        "  let capability=null; const start=async function(signal) { if (this!==capability) throw new TypeError(\"AS3 application capability receiver is not authentic\"); if (state.phase!==\"committed\") throw new TypeError(\"AS3 application start is out of sequence\"); if (signal===null || typeof signal!==\"object\" || typeof signal.aborted!==\"boolean\" || typeof signal.addEventListener!==\"function\") throw new TypeError(\"AS3 application start signal is invalid\"); state.phase=\"starting-application\"; try { if (signal.aborted) { const aborted=new Error(\"AS3 application start was aborted\"); aborted.name=\"AbortError\"; throw aborted; } const startApplication=state.runtime.loadStartApplication(); const result=await Reflect.apply(startApplication,undefined,[signal]); if (state.phase!==\"starting-application\") throw new Error(\"AS3 application start became terminal before completion\"); if (signal.aborted) { const aborted=new Error(\"AS3 application start was aborted\"); aborted.name=\"AbortError\"; throw aborted; } state.phase=\"application-started\"; return result; } catch (error) { if (state.phase===\"poisoned\") throw error; state.phase=\"poisoning\"; const failures=[error]; try { Reflect.apply(state.runtime.poison,undefined,[state.reservation]); } catch (poisonError) { failures.push(poisonError); } try { __as3CleanupHosts(state); } catch (cleanupError) { failures.push(cleanupError); } state.phase=\"poisoned\"; if (failures.length>1) throw new AggregateError(failures,\"AS3 application start and cleanup failed\"); throw error; } };",
        `  capability=Object.freeze({__proto__:null,schema:"as3-original-host-runtime-capability@1",typeAuthoritySha256:${JSON.stringify(pin.typeAuthoritySha256)},runtimeClosureSha256:${JSON.stringify(pin.runtimeClosureSha256)},startAS3Application:start}); return capability;`,
        "}",
        "function preflightAS3TypeAuthority() {",
        "  const state=__as3RequireFacade(this); __as3RequirePhase(state,[\"virgin\"],\"AS3 original-host preflight is out of sequence\");",
        "  state.phase=\"preflighting\"; try { const runtime=__as3CreateRuntime(); const reservation=Reflect.apply(runtime.preflight,undefined,[runtime.document]); state.runtime=runtime; state.reservation=reservation; state.phase=\"preflighted\"; return undefined; } catch (error) { state.phase=\"poisoned\"; throw error; }",
        "}",
        "function installAS3EmbeddedBitmapDataHost(host) {",
        "  const state=__as3RequireFacade(this); __as3RequirePhase(state,[\"preflighted\"],\"AS3 embedded host installation is out of sequence\");",
        "  state.phase=\"installing-bitmap\"; try { const preparation=Reflect.apply(state.runtime.prepareBitmap,undefined,[host]); state.bitmapPreparation=preparation; state.bitmapLease=Reflect.apply(state.runtime.commitBitmap,undefined,[preparation]); state.phase=\"bitmap-installed\"; return undefined; } catch (error) { try { __as3CleanupHosts(state); } catch {} state.phase=\"poisoned\"; try { Reflect.apply(state.runtime.poison,undefined,[state.reservation]); } catch {} throw error; }",
        "}",
        "function installAS3TimerExecutionCapture(capture) {",
        "  const state=__as3RequireFacade(this); __as3RequirePhase(state,[\"bitmap-installed\"],\"AS3 timer capture installation is out of sequence\");",
        "  state.phase=\"installing-timer\"; try { const preparation=Reflect.apply(state.runtime.prepareTimer,undefined,[capture]); state.timerPreparation=preparation; state.timerLease=Reflect.apply(state.runtime.commitTimer,undefined,[preparation]); state.phase=\"timer-installed\"; return undefined; } catch (error) { try { if (state.timerPreparation !== null && state.timerLease === null) Reflect.apply(state.runtime.abortTimer,undefined,[state.timerPreparation]); } catch {} try { __as3CleanupHosts(state); } catch {} state.phase=\"poisoned\"; try { Reflect.apply(state.runtime.poison,undefined,[state.reservation]); } catch {} throw error; }",
        "}",
        "function commitAS3TypeAuthority() {",
        "  const state=__as3RequireFacade(this); __as3RequirePhase(state,[\"timer-installed\"],\"AS3 original-host commit is out of sequence\");",
        "  state.phase=\"committing\"; try { const receipt=Reflect.apply(state.runtime.commit,undefined,[state.reservation]); if (!Reflect.apply(state.runtime.isReceipt,undefined,[receipt]) || receipt.schema !== \"as3-type-authority-commit-receipt@1\" || receipt.typeAuthoritySha256 !== "+JSON.stringify(pin.typeAuthoritySha256)+") throw new TypeError(\"AS3 original-host commit receipt is not authentic\"); state.phase=\"committed\"; return __as3CreateApplicationCapability(state); } catch (error) { state.phase=\"poisoned\"; try { Reflect.apply(state.runtime.poison,undefined,[state.reservation]); } catch {} try { __as3CleanupHosts(state); } catch {} throw error; }",
        "}",
        "function abortAS3TypeAuthority() {",
        "  const state=__as3RequireFacade(this); __as3RequirePhase(state,[\"preflighted\",\"bitmap-installed\",\"timer-installed\"],\"AS3 original-host abort is out of sequence\");",
        "  state.phase=\"aborting\"; let first=null; try { __as3CleanupHosts(state); } catch (error) { first=error; } try { Reflect.apply(state.runtime.abort,undefined,[state.reservation]); } catch (error) { if (first===null) first=error; } state.phase=first===null?\"aborted\":\"poisoned\"; if (first!==null) throw first; return undefined;",
        "}",
        "function poisonAS3TypeAuthority() {",
        "  const state=__as3RequireFacade(this); __as3RequirePhase(state,[\"virgin\",\"preflighted\",\"bitmap-installed\",\"timer-installed\",\"committed\",\"starting-application\",\"application-started\"],\"AS3 original-host poison is out of sequence\");",
        "  const hadReservation=state.reservation!==null; state.phase=\"poisoning\"; let first=null; if (hadReservation) try { Reflect.apply(state.runtime.poison,undefined,[state.reservation]); } catch (error) { first=error; } try { __as3CleanupHosts(state); } catch (error) { if (first===null) first=error; } state.phase=\"poisoned\"; if (first!==null) throw first; return undefined;",
        "}",
        `export const ${ABI_EXPORT} = {__proto__:null,schema:${JSON.stringify(ABI_SCHEMA)},typeAuthoritySha256:${JSON.stringify(pin.typeAuthoritySha256)},runtimeClosureSha256:${JSON.stringify(pin.runtimeClosureSha256)},preflightAS3TypeAuthority,installAS3EmbeddedBitmapDataHost,installAS3TimerExecutionCapture,commitAS3TypeAuthority,abortAS3TypeAuthority,poisonAS3TypeAuthority};`,
        "",
    ];
    void runtime;return lines.join("\n");
}

function auditEffectFreeImport(source:string):void {
    const parsed=ts49.createSourceFile(OUTPUT_PATH,source,ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.JS);
    if((parsed as any).parseDiagnostics.length)throw new CliError("original-host facade output did not parse",4);
    let stateDeclarations=0,abiDeclarations=0,forbidden:string|null=null;
    for(const statement of parsed.statements) {
        if(ts49.isFunctionDeclaration(statement))continue;
        if(ts49.isVariableStatement(statement)&&statement.declarationList.declarations.length===1) {
            const declaration=statement.declarationList.declarations[0]!;
            if(ts49.isIdentifier(declaration.name)&&declaration.name.text==="__as3FacadeState"
                &&declaration.initializer?.kind===ts49.SyntaxKind.NullKeyword) {stateDeclarations++;continue;}
            if(statement.modifiers?.some(item=>item.kind===ts49.SyntaxKind.ExportKeyword)
                &&ts49.isIdentifier(declaration.name)&&declaration.name.text===ABI_EXPORT
                &&declaration.initializer&&ts49.isObjectLiteralExpression(declaration.initializer)) {abiDeclarations++;continue;}
        }
        forbidden="unsupported top-level statement";
    }
    const topLevelInitializer=(node:ts49.Node):void=>{
        if(ts49.isCallExpression(node)||ts49.isNewExpression(node)||ts49.isAwaitExpression(node)
            ||ts49.isTaggedTemplateExpression(node)||ts49.isDeleteExpression(node))forbidden="top-level execution";
        if(ts49.isBinaryExpression(node)&&node.operatorToken.kind>=ts49.SyntaxKind.FirstAssignment
            &&node.operatorToken.kind<=ts49.SyntaxKind.LastAssignment)forbidden="top-level write";
        ts49.forEachChild(node,topLevelInitializer);
    };
    for(const statement of parsed.statements)if(ts49.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations)
        if(declaration.initializer)topLevelInitializer(declaration.initializer);
    if(stateDeclarations!==1||abiDeclarations!==1||forbidden)
        throw new CliError(`original-host facade import is not effect-free${forbidden?`: ${forbidden}`:""}`,4);
}

/** Emits a held one-file facade. It is deliberately not wired into the CLI or maintained output. */
export function emitOriginalHostRuntimeFacadeV2Candidate(runtime:EmittedBrowserEsmRuntime,
    pin:OriginalHostRuntimeFacadeV2Pin):EmittedOriginalHostRuntimeFacadeV2Candidate {
    if(!runtime||runtime.root!=="achievement-primary-runtime"||runtime.files.length===0
        ||!exactKeys(pin,["bindings","compilerProvider","runtimeClosureSha256","schema","typeAuthoritySha256"])
        ||pin.schema!=="as3-original-host-runtime-facade-pin@2"||!SHA256.test(pin.typeAuthoritySha256)
        ||!SHA256.test(pin.runtimeClosureSha256))throw new CliError("original-host facade pin is invalid",6);
    validateCompilerProvider(pin.compilerProvider);
    const owned=new Set<string>();
    for(const file of runtime.files) {
        if(!safePath(file.path)||owned.has(file.path)||file.identity.path!==file.path
            ||file.identity.bytes!==Buffer.byteLength(file.body,"utf8")||file.identity.sha256!==sha256(file.body))
            throw new CliError(`original-host facade runtime identity differs: ${file.path}`,6);
        owned.add(file.path);
    }
    validateBindings(pin.bindings,owned);
    for(const file of runtime.files) {
        const parsed=ts49.createSourceFile(file.path,file.body,ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.JS),imports:string[]=[];
        for(const statement of parsed.statements) {
            if(ts49.isImportDeclaration(statement)&&ts49.isStringLiteral(statement.moduleSpecifier))imports.push(statement.moduleSpecifier.text);
            if(ts49.isExportDeclaration(statement)&&statement.moduleSpecifier&&ts49.isStringLiteral(statement.moduleSpecifier))imports.push(statement.moduleSpecifier.text);
        }
        if(canonicalJson(imports)!==canonicalJson(file.imports.map(item=>item.specifier))
            ||file.imports.some(item=>resolveOwned(file.path,item.specifier,owned)!==item.path))
            throw new CliError(`original-host facade dependency edge differs: ${file.path}`,6);
    }
    const closure=runtimeEvidence(runtime,pin.bindings),closureHash=sha256(canonicalJson(closure));
    if(closureHash!==pin.runtimeClosureSha256)throw new CliError("original-host facade runtime closure differs from the independent pin",6);
    const factories=runtime.files.map(file=>commonJsFactory(file.path,file.body)).sort((left,right)=>compare(left.id,right.id));
    for(const factory of factories)for(const requested of factory.requests)if(resolveOwned(factory.id,requested,owned)===null)
        throw new CliError(`original-host facade has an unowned dependency: ${factory.id} -> ${requested}`,6);
    const reachable=new Set<string>(),pending=[pin.bindings.application.path,pin.bindings.authority.path,pin.bindings.registry.path,
        pin.bindings.embeddedHost.path,pin.bindings.timerCapture.path],byId=new Map(factories.map(item=>[item.id,item]));
    while(pending.length) {const id=pending.shift()!;if(reachable.has(id))continue;reachable.add(id);
        const factory=byId.get(id);if(!factory)throw new CliError("original-host facade bound module is absent",6);
        factory.requests.forEach(requested=>pending.push(resolveOwned(id,requested,owned)!));}
    if(reachable.size!==factories.length)throw new CliError("original-host facade closure contains unreachable modules",6);
    const moduleBody=runtimeSource(runtime,pin,factories);auditEffectFreeImport(moduleBody);
    const module=artifact(OUTPUT_PATH,moduleBody),receiptBody=`${canonicalJson({schema:RECEIPT_SCHEMA,status:"held",holds:[
        {code:"AP_ORIGINAL_HOST_RUNTIME_V2_SYNTHETIC_AUTHORITY_ONLY",reason:"the v2 facade has not been emitted from an AP-qualified production authority closure"},
        {code:"AP_ORIGINAL_HOST_RUNTIME_V2_DEFINITION_EFFECTS_UNQUALIFIED",reason:"definition-factory evaluation is constrained to private module state but the production definition closure is not yet qualified"},
        {code:"AP_ORIGINAL_HOST_RUNTIME_V2_COMPILER_BUILD_PROVENANCE_UNQUALIFIED",reason:"the v2 facade binds a compiler provider authority but its working-tree build provenance is not independently qualified"},
        {code:"AP_ORIGINAL_HOST_RUNTIME_V2_LAUNCH_AUTHORITY_UNBOUND",reason:"the v2 facade receipt does not yet bind the maintained profile v2 start contract to its bundled application export"},
        {code:"AP_ORIGINAL_HOST_RUNTIME_V2_NOT_PRODUCTION_WIRED",reason:"the held v2 facade is not selected by the compiler CLI or AP manifests"}],
        compilerProvider:pin.compilerProvider,abi:{schema:ABI_SCHEMA,exportName:ABI_EXPORT,operations:OPERATIONS,typeAuthoritySha256:pin.typeAuthoritySha256,
            runtimeClosureSha256:pin.runtimeClosureSha256},artifactInventory:[module],inputClosure:closure,
        factoryInventory:factories.map(item=>item.identity),effects:{format:"browser-esm-single-file-effect-free-runtime@2",
            imports:0,topLevelCalls:0,ambientWrites:0,lazyFactoryInitialization:true,
            applicationEntryEvaluation:"post-commit-start",definitionCinit:"deferred"},
        lifecycle:{phases:["virgin","preflighted","bitmap-installed","timer-installed","committed","starting-application","application-started","aborted","poisoned"],
            order:OPERATIONS.slice(0,4),abortCleanup:"timer-then-bitmap-then-registry",applicationStart:"capability-after-commit-async-one-shot",poisonTerminal:true,receiptReplayAccepted:false},
        output:module})}\n`,receipt=artifact(RECEIPT_PATH,receiptBody);
    return Object.freeze({root:"original-host-runtime-facade-v2-candidate",module,receipt,files:Object.freeze([
        Object.freeze({path:module.path,body:moduleBody,identity:module}),
        Object.freeze({path:receipt.path,body:receiptBody,identity:receipt}),
    ])});
}

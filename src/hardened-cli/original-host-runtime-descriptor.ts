import {Buffer} from "node:buffer";
import {createHash} from "node:crypto";
import ts49 = require("typescript-4-9");
import {CliError} from "./errors";

const AUTHORITY_SCHEMA="as3-original-host-runtime-package-authority@1";
const DESCRIPTOR_SCHEMA="as3-original-host-runtime-descriptor-candidate@1";
const RECEIPT_SCHEMA="ap-original-host-runtime-descriptor-candidate-receipt@1";
const DESCRIPTOR_EXPORT="AS3_ORIGINAL_HOST_RUNTIME_DESCRIPTOR_JSON";
const ABI_EXPORT="AS3_ORIGINAL_HOST_RUNTIME_ABI";
const ABI_SCHEMA="as3-original-host-runtime-abi@1";
const COMMIT_OPERATION="commitAS3TypeAuthority";
const POISON_OPERATION="poisonAS3TypeAuthority";
const COMMIT_RECEIPT_SCHEMA="as3-type-authority-commit-receipt@1";
const INSTALLER_EXPORTS=Object.freeze(["installAS3EmbeddedBitmapDataHost","installAS3TimerExecutionCapture"] as const);
const SHA256=/^[0-9a-f]{64}$/;
const IDENTIFIER=/^[A-Za-z_$][A-Za-z0-9_$]*$/;

export interface OriginalHostArtifactIdentity {
    readonly path:string;readonly bytes:number;readonly sha256:string;
    readonly format:"browser-esm@1"|"browser-esm-single-file-import-free@1"
        |"browser-esm-single-file-effect-free-runtime@1"|"commonjs@1";
}
export interface OriginalHostModuleIdentity {
    readonly specifier:string;readonly artifactPath:string;readonly exports:readonly string[];
}
export interface OriginalHostRuntimePackageAuthority {
    readonly schema:typeof AUTHORITY_SCHEMA;
    readonly provider:Readonly<{repository:string;commit:string;packageLockSha256:string}>;
    readonly runtimePackage:string;readonly typeAuthoritySha256:string;
    readonly artifacts:readonly OriginalHostArtifactIdentity[];
    readonly modules:readonly OriginalHostModuleIdentity[];
    readonly hostRuntime:Readonly<{moduleSpecifier:string;artifactPath:string;exportName:typeof ABI_EXPORT;
        schema:typeof ABI_SCHEMA;installerExports:typeof INSTALLER_EXPORTS}>;
    readonly authorityInstaller:Readonly<{moduleSpecifier:string;artifactPath:string;operation:typeof COMMIT_OPERATION;
        poisonOperation:typeof POISON_OPERATION;commitReceiptSchema:typeof COMMIT_RECEIPT_SCHEMA;
        typeAuthoritySha256:string}>;
}
export interface OriginalHostRuntimePackagePin extends Omit<OriginalHostRuntimePackageAuthority,"schema"> {
    readonly sourcePackageAuthority:Readonly<{path:string;bytes:number;sha256:string}>;
}
export interface OriginalHostArtifactBytes {readonly path:string;readonly bytes:Uint8Array;}
export interface EmittedOriginalHostRuntimeDescriptorCandidate {
    readonly root:"original-host-runtime-descriptor-candidate";
    readonly module:Readonly<{path:string;bytes:number;sha256:string}>;
    readonly receipt:Readonly<{path:string;bytes:number;sha256:string}>;
    readonly files:readonly Readonly<{path:string;body:string;identity:Readonly<{path:string;bytes:number;sha256:string}>}>[];
}
export interface EmittedOriginalHostRuntimeAbiCandidate {
    readonly path:"AS3OriginalHostRuntime.candidate.mjs";
    readonly body:string;
    readonly identity:OriginalHostArtifactIdentity;
}

function canonicalJson(value:unknown):string {
    if(value===null||typeof value==="boolean"||typeof value==="string")return JSON.stringify(value);
    if(typeof value==="number"&&Number.isFinite(value))return JSON.stringify(value);
    if(Array.isArray(value))return `[${value.map(canonicalJson).join(",")}]`;
    if(value&&typeof value==="object"&&Object.getPrototypeOf(value)===Object.prototype) {
        const record=value as Record<string,unknown>;
        return `{${Object.keys(record).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
    }
    throw new CliError("original-host runtime authority contains a non-JSON value",6);
}
function compare(left:string,right:string):number{return Buffer.compare(Buffer.from(left,"utf8"),Buffer.from(right,"utf8"));}
function hash(bytes:Uint8Array|string):string{return createHash("sha256").update(bytes).digest("hex");}
function exactKeys(value:unknown,keys:readonly string[]):value is Record<string,unknown> {
    if(!value||typeof value!=="object"||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)return false;
    const descriptors=Object.getOwnPropertyDescriptors(value),actual=Object.keys(descriptors).sort();
    return actual.length===keys.length&&actual.every((key,index)=>key===[...keys].sort()[index]
        &&Object.prototype.hasOwnProperty.call(descriptors[key],"value"));
}
function safePath(path:string):boolean{return typeof path==="string"&&path.length>0&&path===path.normalize("NFC")
    &&!path.startsWith("/")&&!/[\\%?#:\s\x00-\x1f\x7f-\x9f]/.test(path)
    &&path.split("/").every(part=>part!==""&&part!=="."&&part!=="..");}
function safeArtifact(value:unknown):value is OriginalHostArtifactIdentity {
    return exactKeys(value,["bytes","format","path","sha256"])&&safePath(value.path as string)
        &&Number.isSafeInteger(value.bytes)&&Number(value.bytes)>0&&typeof value.sha256==="string"&&SHA256.test(value.sha256)
        &&["browser-esm@1","browser-esm-single-file-import-free@1",
            "browser-esm-single-file-effect-free-runtime@1","commonjs@1"].includes(value.format as string);
}
function safeProvider(value:unknown):value is OriginalHostRuntimePackageAuthority["provider"] {
    return exactKeys(value,["commit","packageLockSha256","repository"])
        &&typeof value.repository==="string"&&/^https:\/\/[^\s]+$/.test(value.repository)
        &&typeof value.commit==="string"&&/^[0-9a-f]{40}$/.test(value.commit)
        &&typeof value.packageLockSha256==="string"&&SHA256.test(value.packageLockSha256);
}
function validSpecifier(value:string,runtimePackage:string):boolean {
    return value.startsWith(`${runtimePackage}/`)&&value.length>runtimePackage.length+1
        &&value===value.normalize("NFC")&&!/[\\%?#:\s\x00-\x1f\x7f-\x9f]/.test(value.slice(runtimePackage.length+1))
        &&value.slice(runtimePackage.length+1).split("/").every(part=>part!==""&&part!=="."&&part!=="..");
}
function identity(path:string,body:string):Readonly<{path:string;bytes:number;sha256:string}> {
    return Object.freeze({path,bytes:Buffer.byteLength(body,"utf8"),sha256:hash(body)});
}

/**
 * Emits the exact zero-import, zero-top-level-effect ABI grammar consumed by
 * AP's held syntax observer. Its methods deliberately fail closed: connecting
 * them to the separately tested registry transaction requires a future
 * authenticated bundle and must not be inferred from this artifact.
 */
export function emitOriginalHostRuntimeAbiCandidate(typeAuthoritySha256:string):EmittedOriginalHostRuntimeAbiCandidate {
    if(typeof typeAuthoritySha256!=="string"||!SHA256.test(typeAuthoritySha256))
        throw new CliError("original-host runtime ABI requires an exact type authority identity",6);
    const unavailable="throw new Error(\"AS3 original-host runtime ABI is held and not connected to the registry transaction\");";
    const body=[
        `function installAS3EmbeddedBitmapDataHost(value) { void value; ${unavailable} }`,
        `function installAS3TimerExecutionCapture(value) { void value; ${unavailable} }`,
        `function commitAS3TypeAuthority(value) { void value; ${unavailable} }`,
        `function poisonAS3TypeAuthority(value) { void value; ${unavailable} }`,
        `export const ${ABI_EXPORT} = { __proto__: null, schema: ${JSON.stringify(ABI_SCHEMA)}, typeAuthoritySha256: ${JSON.stringify(typeAuthoritySha256)}, installAS3EmbeddedBitmapDataHost, installAS3TimerExecutionCapture, commitAS3TypeAuthority, poisonAS3TypeAuthority };`,
        "",
    ].join("\n");
    const base=identity("AS3OriginalHostRuntime.candidate.mjs",body),identityWithFormat=Object.freeze({...base,
        format:"browser-esm-single-file-effect-free-runtime@1" as const});
    auditImportFreeHostRuntimeModule(Buffer.from(body,"utf8"),ABI_EXPORT);
    return Object.freeze({path:base.path as "AS3OriginalHostRuntime.candidate.mjs",body,identity:identityWithFormat});
}
function assertOrderedUnique(values:readonly string[],label:string):void {
    if(values.some((value,index)=>index>0&&compare(values[index-1]!,value)>=0))
        throw new CliError(`${label} must be strictly UTF-8 sorted and unique`,6);
}
function auditDescriptorModule(source:string,payload:string):void {
    const parsed=ts49.createSourceFile("AS3OriginalHostRuntimeDescriptor.candidate.mjs",source,
        ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.JS);
    if((parsed as any).parseDiagnostics.length||parsed.statements.length!==1)throw new CliError("original-host descriptor module is not a single JavaScript statement",4);
    const statement=parsed.statements[0];
    if(!statement||!ts49.isVariableStatement(statement)||statement.declarationList.declarations.length!==1
        ||(statement.declarationList.flags&ts49.NodeFlags.Const)===0
        ||!statement.modifiers?.some(item=>item.kind===ts49.SyntaxKind.ExportKeyword))
        throw new CliError("original-host descriptor module does not have one const export",4);
    const declaration=statement.declarationList.declarations[0];
    if(!declaration||!ts49.isIdentifier(declaration.name)||declaration.name.text!==DESCRIPTOR_EXPORT
        ||!declaration.initializer||!ts49.isStringLiteral(declaration.initializer)||declaration.initializer.text!==payload)
        throw new CliError("original-host descriptor module payload differs",4);
    let forbidden=false;
    const visit=(node:ts49.Node):void=>{if(ts49.isCallExpression(node)||ts49.isImportDeclaration(node)
        ||ts49.isExportDeclaration(node)||node.kind===ts49.SyntaxKind.ImportKeyword)forbidden=true;ts49.forEachChild(node,visit);};
    visit(parsed);if(forbidden)throw new CliError("original-host descriptor module is not import-free and call-free",4);
}
// This proves only the exact import-free namespace declaration recorded by the
// independently pinned authority. It deliberately does not evaluate the bytes
// or claim that the exported ABI value has been observed or is effect-free.
function auditImportFreeHostRuntimeModule(bytes:Buffer,exportName:string):void {
    const source=bytes.toString("utf8");
    if(Buffer.from(source,"utf8").compare(bytes)!==0)throw new CliError("original-host runtime ABI is not canonical UTF-8",6);
    const parsed=ts49.createSourceFile("AS3OriginalHostRuntime.mjs",source,ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.JS);
    if((parsed as any).parseDiagnostics.length)throw new CliError("original-host runtime ABI JavaScript did not parse",4);
    const exports:string[]=[];let forbidden:string|null=null;
    for(const statement of parsed.statements) {
        if(ts49.isImportDeclaration(statement))forbidden="static import";
        if(statement.modifiers?.some(item=>item.kind===ts49.SyntaxKind.ExportKeyword)) {
            if(ts49.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations) {
                if((statement.declarationList.flags&ts49.NodeFlags.Const)===0||!ts49.isIdentifier(declaration.name)
                    ||!declaration.initializer)forbidden="non-const or non-identifier export";
                else exports.push(declaration.name.text);
            } else if((ts49.isFunctionDeclaration(statement)||ts49.isClassDeclaration(statement))&&statement.name)exports.push(statement.name.text);
            else forbidden="unsupported export";
        }
        if(ts49.isExportDeclaration(statement)||ts49.isExportAssignment(statement))forbidden="re-export";
    }
    const visit=(node:ts49.Node):void=>{if(ts49.isCallExpression(node)&&node.expression.kind===ts49.SyntaxKind.ImportKeyword)
        forbidden="dynamic import";ts49.forEachChild(node,visit);};visit(parsed);
    if(forbidden||exports.length!==1||exports[0]!==exportName)
        throw new CliError(`original-host runtime ABI is not a single import-free ${exportName} namespace${forbidden?`: ${forbidden}`:""}`,6);
}

/**
 * Emits held, data-only evidence. `pin` must come from a trust root independent
 * of `sourceAuthorityBytes`; passing an attacker-created matching pin proves
 * nothing and is intentionally not treated as production qualification.
 */
export function emitOriginalHostRuntimeDescriptorCandidate(sourceAuthorityBytes:Uint8Array,
    pin:OriginalHostRuntimePackagePin,artifactInputs:readonly OriginalHostArtifactBytes[]):EmittedOriginalHostRuntimeDescriptorCandidate {
    if(!(sourceAuthorityBytes instanceof Uint8Array)||!Array.isArray(artifactInputs))
        throw new CliError("original-host runtime package authority byte input is invalid",6);
    const authorityBuffer=Buffer.from(sourceAuthorityBytes),inputSnapshots=artifactInputs.map(item=>{
        if(!exactKeys(item,["bytes","path"])||typeof item.path!=="string"||!safePath(item.path)
            ||!(item.bytes instanceof Uint8Array))
            throw new CliError("original-host runtime artifact byte input is invalid",6);
        return Object.freeze({path:item.path as string,bytes:Buffer.from(item.bytes)});
    });
    if(!exactKeys(pin,["artifacts","authorityInstaller","hostRuntime","modules","provider","runtimePackage",
        "sourcePackageAuthority","typeAuthoritySha256"])||!exactKeys(pin.sourcePackageAuthority,["bytes","path","sha256"])
        ||!safePath(pin.sourcePackageAuthority.path)||!Number.isSafeInteger(pin.sourcePackageAuthority.bytes)
        ||pin.sourcePackageAuthority.bytes<=0||typeof pin.sourcePackageAuthority.sha256!=="string"
        ||!SHA256.test(pin.sourcePackageAuthority.sha256))throw new CliError("original-host runtime package pin is invalid",6);
    if(authorityBuffer.length!==pin.sourcePackageAuthority.bytes||hash(authorityBuffer)!==pin.sourcePackageAuthority.sha256)
        throw new CliError("original-host runtime package authority differs from the independent pin",6);
    const authorityText=authorityBuffer.toString("utf8");
    if(Buffer.from(authorityText,"utf8").compare(authorityBuffer)!==0)throw new CliError("original-host runtime package authority is not UTF-8",6);
    let raw:unknown;try{raw=JSON.parse(authorityText);}catch{throw new CliError("original-host runtime package authority is not JSON",6);}
    if(`${canonicalJson(raw)}\n`!==authorityText||!exactKeys(raw,["artifacts","authorityInstaller","hostRuntime","modules",
        "provider","runtimePackage","schema","typeAuthoritySha256"]))throw new CliError("original-host runtime package authority is not canonical and closed",6);
    const authority=raw as unknown as OriginalHostRuntimePackageAuthority;
    if(authority.schema!==AUTHORITY_SCHEMA)throw new CliError("original-host runtime package authority schema differs",6);
    const expectedAuthority={schema:AUTHORITY_SCHEMA,provider:pin.provider,runtimePackage:pin.runtimePackage,
        typeAuthoritySha256:pin.typeAuthoritySha256,artifacts:pin.artifacts,modules:pin.modules,
        hostRuntime:pin.hostRuntime,authorityInstaller:pin.authorityInstaller};
    if(canonicalJson(authority)!==canonicalJson(expectedAuthority))
        throw new CliError("original-host runtime package authority claims differ from the independent pin",6);
    if(!safeProvider(authority.provider)||typeof authority.runtimePackage!=="string"
        ||!/^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/.test(authority.runtimePackage)
        ||typeof authority.typeAuthoritySha256!=="string"||!SHA256.test(authority.typeAuthoritySha256)
        ||!Array.isArray(authority.artifacts)||authority.artifacts.length===0||!authority.artifacts.every(safeArtifact))
        throw new CliError("original-host runtime package authority identity is invalid",6);
    assertOrderedUnique(authority.artifacts.map(item=>item.path),"original-host runtime artifacts");
    const collisionKeys=authority.artifacts.map(item=>item.path.normalize("NFD").toLowerCase());
    if(new Set(collisionKeys).size!==collisionKeys.length)throw new CliError("original-host runtime artifacts have a portable path collision",6);
    const artifacts=new Map(authority.artifacts.map(item=>[item.path,item]));
    assertOrderedUnique(inputSnapshots.map(item=>item.path),"original-host runtime artifact byte inputs");
    if(inputSnapshots.length!==authority.artifacts.length)throw new CliError("original-host runtime artifact byte inventory is incomplete",6);
    const bytesByPath=new Map(inputSnapshots.map(item=>[item.path,item.bytes]));
    for(const artifact of authority.artifacts) {
        const bytes=bytesByPath.get(artifact.path);
        if(!bytes||bytes.length!==artifact.bytes||hash(bytes)!==artifact.sha256)
            throw new CliError(`original-host runtime artifact bytes differ: ${artifact.path}`,6);
    }
    if(!Array.isArray(authority.modules)||authority.modules.length===0)throw new CliError("original-host runtime module inventory is empty",6);
    for(const module of authority.modules) {
        if(!exactKeys(module,["artifactPath","exports","specifier"])||typeof module.specifier!=="string"
            ||!validSpecifier(module.specifier,authority.runtimePackage)||typeof module.artifactPath!=="string"
            ||!artifacts.has(module.artifactPath)||!Array.isArray(module.exports)||module.exports.length===0
            ||module.exports.some(name=>typeof name!=="string"||!IDENTIFIER.test(name)))
            throw new CliError("original-host runtime module inventory is invalid",6);
        assertOrderedUnique(module.exports,`original-host runtime exports for ${module.specifier}`);
    }
    assertOrderedUnique(authority.modules.map(item=>item.specifier),"original-host runtime module specifiers");
    const referenced=new Set(authority.modules.map(item=>item.artifactPath));
    if(authority.artifacts.some(item=>!referenced.has(item.path)))throw new CliError("original-host runtime artifact is not referenced by a module",6);
    if(!exactKeys(authority.hostRuntime,["artifactPath","exportName","installerExports","moduleSpecifier","schema"])
        ||authority.hostRuntime.exportName!==ABI_EXPORT||authority.hostRuntime.schema!==ABI_SCHEMA
        ||canonicalJson(authority.hostRuntime.installerExports)!==canonicalJson(INSTALLER_EXPORTS)
        ||!exactKeys(authority.authorityInstaller,["artifactPath","commitReceiptSchema","moduleSpecifier","operation",
            "poisonOperation","typeAuthoritySha256"])
        ||authority.authorityInstaller.operation!==COMMIT_OPERATION||authority.authorityInstaller.poisonOperation!==POISON_OPERATION
        ||authority.authorityInstaller.commitReceiptSchema!==COMMIT_RECEIPT_SCHEMA
        ||authority.authorityInstaller.typeAuthoritySha256!==authority.typeAuthoritySha256
        ||authority.authorityInstaller.moduleSpecifier!==authority.hostRuntime.moduleSpecifier
        ||authority.authorityInstaller.artifactPath!==authority.hostRuntime.artifactPath)
        throw new CliError("original-host runtime ABI or installer identity is invalid",6);
    const hostModule=authority.modules.find(item=>item.specifier===authority.hostRuntime.moduleSpecifier);
    const hostArtifact=artifacts.get(authority.hostRuntime.artifactPath);
    if(!hostModule||hostModule.artifactPath!==authority.hostRuntime.artifactPath
        ||canonicalJson(hostModule.exports)!==canonicalJson([ABI_EXPORT])
        ||hostArtifact?.format!=="browser-esm-single-file-effect-free-runtime@1")
        throw new CliError("original-host runtime ABI module is not an exact single-export browser ESM artifact",6);
    auditImportFreeHostRuntimeModule(bytesByPath.get(hostArtifact.path)!,ABI_EXPORT);

    const descriptor={schema:DESCRIPTOR_SCHEMA,sourcePackageAuthority:pin.sourcePackageAuthority,
        provider:authority.provider,runtimePackage:authority.runtimePackage,typeAuthoritySha256:authority.typeAuthoritySha256,
        artifacts:authority.artifacts,modules:authority.modules,hostRuntime:authority.hostRuntime,
        authorityInstaller:authority.authorityInstaller};
    const descriptorPayload=`${canonicalJson(descriptor)}\n`;
    const moduleBody=`export const ${DESCRIPTOR_EXPORT} = ${JSON.stringify(descriptorPayload)};\n`;
    auditDescriptorModule(moduleBody,descriptorPayload);
    const module=identity("AS3OriginalHostRuntimeDescriptor.candidate.mjs",moduleBody);
    const descriptorPayloadIdentity=Object.freeze({bytes:Buffer.byteLength(descriptorPayload,"utf8"),sha256:hash(descriptorPayload)});
    const receiptBody=`${canonicalJson({schema:RECEIPT_SCHEMA,status:"held",holds:[{
        code:"AP_ORIGINAL_HOST_RUNTIME_DESCRIPTOR_NOT_QUALIFIED",
        reason:"the descriptor and its source package authority still require independent AP pins and byte-only preflight before the runtime ABI can be observed"},{
        code:"AP_ORIGINAL_HOST_RUNTIME_ABI_EFFECTS_UNAUDITED",
        reason:"an import-free format label and post-import namespace checks do not prove the exact host runtime bytes lack top-level effects"},{
        code:"AP_ORIGINAL_HOST_RUNTIME_ABI_PROTOCOL_UNPROVEN",
        reason:"installer names do not prove host-before-secondary one-shot ordering, revocation after commit, or terminal poison behavior"}],
        sourcePackageAuthority:pin.sourcePackageAuthority,descriptorPayload:descriptorPayloadIdentity,module,
        exportName:DESCRIPTOR_EXPORT,namespaceExports:[DESCRIPTOR_EXPORT]})}\n`;
    const receipt=identity("AS3OriginalHostRuntimeDescriptor.candidate-receipt.json",receiptBody);
    return Object.freeze({root:"original-host-runtime-descriptor-candidate",module,receipt,files:Object.freeze([
        Object.freeze({path:module.path,body:moduleBody,identity:module}),
        Object.freeze({path:receipt.path,body:receiptBody,identity:receipt}),
    ])});
}

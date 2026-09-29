import {createHash} from "node:crypto";
import {Buffer} from "node:buffer";
import ts49 = require("typescript-4-9");
import {CliError} from "./errors";
import {canonicalJson,type CompilerProviderAuthority,type SecondaryArtifactIdentity} from "./secondary-authority";
import type {EmittedBrowserLinkerPackage} from "./secondary-browser-linker";
import type {RuntimeAuthorityClassSource} from "../hardened/type-authority";
import type {BrowserEsmFile,EmittedBrowserEsmRuntime} from "./browser-esm-runtime";

const FACTORY_EXPORT="createAchievementPrimarySecondaryLinkage";
const ADAPTER_EXPORT="__as3CreatePrimarySecondaryLinkage";

export interface EmittedPrimarySecondaryHostPackage {
    readonly root:"achievement-primary-host";
    readonly files:readonly Readonly<{path:string;body:string;identity:SecondaryArtifactIdentity}>[];
    readonly module:SecondaryArtifactIdentity;readonly receipt:SecondaryArtifactIdentity;
}

function sha256(value:string|Buffer):string{return createHash("sha256").update(value).digest("hex");}
function artifact(path:string,body:string):SecondaryArtifactIdentity {
    return Object.freeze({path,bytes:Buffer.byteLength(body,"utf8"),sha256:sha256(body)});
}
function compare(left:string,right:string):number{return Buffer.compare(Buffer.from(left,"utf8"),Buffer.from(right,"utf8"));}
function quote(value:string):string{return JSON.stringify(value);}
function browserModulePath(source:RuntimeAuthorityClassSource):string {
    if(!source.module.startsWith("./application/")||!/^\.[/][A-Za-z0-9_./-]+$/.test(source.module)
        ||source.module.includes(".."))throw new CliError("primary host bootstrap definition lacks a literal application module",6);
    return `${source.module.slice(2)}.mjs`;
}
function hostSpecifier(path:string):string{return `../achievement-primary-runtime/${path}`;}
function globalIdentity(runtime:EmittedBrowserEsmRuntime,file:BrowserEsmFile):SecondaryArtifactIdentity {
    return Object.freeze({path:`${runtime.root}/${file.path}`,bytes:file.identity.bytes,sha256:file.identity.sha256});
}

type HostImportShape=Readonly<{specifier:string;kind:"named"|"namespace";
    bindings:readonly Readonly<{imported:string;local:string}>[]}>;
function auditHostModule(source:string,imports:readonly HostImportShape[],requiredLiterals:readonly string[]):void {
    const parsed=ts49.createSourceFile("AchievementModule.primary-host.mjs",source,ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.JS);
    if((parsed as any).parseDiagnostics.length)throw new CliError("primary host ESM did not parse",4);
    const importShapes:HostImportShape[]=[];let exportedFactory=0,forbidden:string|null=null;
    for(const statement of parsed.statements) {
        if(ts49.isImportDeclaration(statement)) {
            if(!ts49.isStringLiteral(statement.moduleSpecifier)||!statement.importClause||statement.importClause.isTypeOnly
                ||statement.importClause.name||!statement.importClause.namedBindings)
                throw new CliError("primary host ESM contains a non-literal or widened import",4);
            const bindings=statement.importClause.namedBindings;
            if(ts49.isNamespaceImport(bindings))importShapes.push(Object.freeze({specifier:statement.moduleSpecifier.text,
                kind:"namespace",bindings:Object.freeze([{imported:"*",local:bindings.name.text}])}));
            else if(ts49.isNamedImports(bindings))importShapes.push(Object.freeze({specifier:statement.moduleSpecifier.text,
                kind:"named",bindings:Object.freeze(bindings.elements.map(item=>Object.freeze({
                    imported:item.propertyName?.text??item.name.text,local:item.name.text})))}));
            else throw new CliError("primary host ESM contains an unsupported import binding",4);
            continue;
        }
        if(ts49.isFunctionDeclaration(statement)&&statement.name?.text===FACTORY_EXPORT
            &&statement.modifiers?.some(item=>item.kind===ts49.SyntaxKind.ExportKeyword)) { exportedFactory++;continue; }
        if(ts49.isExportDeclaration(statement)||ts49.isExportAssignment(statement)
            ||statement.modifiers?.some(item=>item.kind===ts49.SyntaxKind.ExportKeyword))
            throw new CliError("primary host ESM exposes more than its narrow linkage factory",4);
    }
    const visit=(node:ts49.Node):void=>{
        if(ts49.isCallExpression(node)&&node.expression.kind===ts49.SyntaxKind.ImportKeyword)forbidden="dynamic import";
        if(ts49.isIdentifier(node)&&["require","module","exports","eval","Function","globalThis","window","self","process"].includes(node.text)) {
            const propertyName=ts49.isPropertyAssignment(node.parent)&&node.parent.name===node
                ||ts49.isPropertyAccessExpression(node.parent)&&node.parent.name===node;
            if(!propertyName)forbidden=`forbidden identifier ${node.text}`;
        }
        ts49.forEachChild(node,visit);
    };visit(parsed);
    if(exportedFactory!==1||forbidden)throw new CliError(forbidden?`primary host ESM contains ${forbidden}`:
        "primary host ESM does not expose exactly one linkage factory",4);
    if(canonicalJson(importShapes)!==canonicalJson(imports))throw new CliError("primary host ESM literal import inventory differs",4);
    const missingLiteral=requiredLiterals.find(value=>!source.includes(quote(value)));
    if(missingLiteral!==undefined)throw new CliError(`primary host ESM omits an authenticated identity literal: ${missingLiteral}`,4);
    if(/AchievementModule\.(?:secondary-linker|secondary-type-authority|source-closure|authority-receipt)/.test(source))
        throw new CliError("primary host ESM imports or bundles secondary package content",4);
}

/** Adds only the package-internal adapter factory to the primary authority bundle. */
export function exposePrimarySecondaryHostAdapter(code:string):string {
    if(typeof code!=="string"||!code.includes('import { installAS3TypeAuthority } from "./internal/AS3TypeRegistry";'))
        throw new CliError("primary runtime authority source cannot host the secondary adapter",6);
    return code.replace('import { installAS3TypeAuthority } from "./internal/AS3TypeRegistry";',
        'import { installAS3TypeAuthority } from "./internal/AS3TypeRegistry";\nimport { createAS3PrimarySecondaryLinkage as __as3CreatePrimarySecondaryLinkage } from "./internal/AS3PrimarySecondaryHost";')
        + `export { __as3CreatePrimarySecondaryLinkage };\n`;
}

export function emitPrimarySecondaryHostPackage(linker:EmittedBrowserLinkerPackage,provider:CompilerProviderAuthority,
    runtime:EmittedBrowserEsmRuntime,runtimePackage:string,
    primarySources:readonly RuntimeAuthorityClassSource[]):EmittedPrimarySecondaryHostPackage {
    const inventory=linker.primaryHostInventory,sourceByQName=new Map(primarySources.map(source=>[source.qname,source]));
    const bootstrapDefinitions=inventory.bootstrapQNames.map(qname=>{
        const source=sourceByQName.get(qname);
        if(!source||source.fileLocalScope||source.constructionTargetExport!=="as3ConstructionTarget"
            ||source.constructionProofExport!=="isAS3ConstructionProof")
            throw new CliError(`primary host bootstrap definition is absent from the sealed primary authority: ${qname}`,6);
        const modulePath=browserModulePath(source),file=runtime.file(modulePath),moduleSpecifier=hostSpecifier(modulePath);
        return Object.freeze({qname,moduleSpecifier,exportName:source.constructorExport,file});
    }).sort((left,right)=>compare(left.qname,right.qname));
    const runtimeModules=inventory.runtimeImports.map(specifier=>{
        if(!specifier.startsWith(`${runtimePackage}/`)||specifier.slice(runtimePackage.length+1).includes("/"))
            throw new CliError(`primary host runtime dependency has no compiler-owned exact artifact: ${specifier}`,6);
        const modulePath=`${specifier.slice(runtimePackage.length+1)}.mjs`,file=runtime.file(modulePath);
        return Object.freeze({specifier,moduleSpecifier:hostSpecifier(modulePath),file});
    })
        .sort((left,right)=>compare(left.specifier,right.specifier));
    if(new Set(bootstrapDefinitions.map(row=>row.qname)).size!==bootstrapDefinitions.length
        ||new Set(runtimeModules.map(row=>row.specifier)).size!==runtimeModules.length)
        throw new CliError("primary host literal import inventory is duplicated",6);
    const primaryRuntime=globalIdentity(runtime,runtime.primaryRuntime),primarySpecifier=hostSpecifier(runtime.primaryRuntime.path);
    const importShapes:HostImportShape[]=[Object.freeze({specifier:primarySpecifier,kind:"named",bindings:Object.freeze([
        Object.freeze({imported:"AS3_TYPE_AUTHORITY_SHA256",local:"__as3PrimaryTypeSha256"}),
        Object.freeze({imported:ADAPTER_EXPORT,local:"__as3CreatePrimarySecondaryLinkage"})])}),
        ...bootstrapDefinitions.map((row,index)=>Object.freeze({specifier:row.moduleSpecifier,kind:"named" as const,
            bindings:Object.freeze([Object.freeze({imported:row.exportName,local:`__as3BootstrapDefinition${index}`})])})),
        ...runtimeModules.map((row,index)=>Object.freeze({specifier:row.moduleSpecifier,kind:"namespace" as const,
            bindings:Object.freeze([Object.freeze({imported:"*",local:`__as3RuntimeModule${index}`})])}))];
    const direct=new Map<string,{role:string;specifier:string;file:BrowserEsmFile}>();
    direct.set(runtime.primaryRuntime.path,{role:"primary-runtime",specifier:primarySpecifier,file:runtime.primaryRuntime});
    bootstrapDefinitions.forEach(row=>direct.set(row.file.path,{role:"bootstrap-definition",specifier:row.moduleSpecifier,file:row.file}));
    runtimeModules.forEach(row=>{if(!direct.has(row.file.path))direct.set(row.file.path,{role:"runtime-module",specifier:row.moduleSpecifier,file:row.file});});
    const dependency=(role:string,specifier:string,file:BrowserEsmFile)=>Object.freeze({role,specifier,
        path:`${runtime.root}/${file.path}`,bytes:file.identity.bytes,sha256:file.identity.sha256,format:"browser-esm@1",
        imports:Object.freeze(file.imports.map(item=>Object.freeze({specifier:item.specifier,path:`${runtime.root}/${item.path}`})))});
    const dependencies=Object.freeze([...direct.values()].map(row=>dependency(row.role,row.specifier,row.file)).concat(
        runtime.files.filter(file=>!direct.has(file.path)).sort((left,right)=>compare(left.path,right.path))
            .map(file=>dependency("transitive-module",hostSpecifier(file.path),file))));
    const plan=inventory.expectedPlan;
    const lines=[`import { AS3_TYPE_AUTHORITY_SHA256 as __as3PrimaryTypeSha256, ${ADAPTER_EXPORT} as __as3CreatePrimarySecondaryLinkage } from ${quote(primarySpecifier)};`,
        ...bootstrapDefinitions.map((row,index)=>`import { ${row.exportName} as __as3BootstrapDefinition${index} } from ${quote(row.moduleSpecifier)};`),
        ...runtimeModules.map((row,index)=>`import * as __as3RuntimeModule${index} from ${quote(row.moduleSpecifier)};`),"",
        `const __as3PrimaryRuntimeArtifactSha256 = ${quote(primaryRuntime.sha256)};`,
        `const __as3DependencyIdentities = Object.freeze(${canonicalJson(dependencies)});`,
        `const __as3ExpectedPlan = Object.freeze(${canonicalJson(plan)});`,
        `const __as3BootstrapDefinitions = Object.freeze([`,
        ...bootstrapDefinitions.map((row,index)=>`  Object.freeze({qname:${quote(row.qname)},definition:__as3BootstrapDefinition${index}}),`),
        "]);",`const __as3RuntimeModules = Object.freeze([`,
        ...runtimeModules.map((row,index)=>`  Object.freeze({specifier:${quote(row.specifier)},module:__as3RuntimeModule${index}}),`),
        "]);","let __as3FactoryConsumed = false;","",
        `export function ${FACTORY_EXPORT}() {`,
        "  if (__as3FactoryConsumed) throw new Error(\"Achievement primary-secondary linkage factory was already consumed\");",
        `  if (__as3PrimaryRuntimeArtifactSha256.length !== 64 || __as3DependencyIdentities.length !== ${dependencies.length} || __as3PrimaryTypeSha256 !== ${quote(plan.primaryAuthority.typeAuthoritySha256)}) throw new Error("Achievement primary runtime identity differs");`,
        "  if (typeof __as3CreatePrimarySecondaryLinkage !== \"function\" || __as3BootstrapDefinitions.some(row => typeof row.definition !== \"function\") || __as3RuntimeModules.some(row => row.module === null || typeof row.module !== \"object\")) throw new Error(\"Achievement primary host imports differ from the authenticated inventory\");",
        "  __as3FactoryConsumed = true;",
        `  return __as3CreatePrimarySecondaryLinkage(Object.freeze({schema:"as3-primary-secondary-host-authority@1",runtimeAuthoritySha256:${quote(plan.primaryAuthority.runtimeAuthoritySha256)},typeAuthoritySha256:${quote(plan.primaryAuthority.typeAuthoritySha256)},expectedPlan:__as3ExpectedPlan,definitions:__as3BootstrapDefinitions,runtimeModules:__as3RuntimeModules}));`,
        "}",""];
    const moduleBody=lines.join("\n");
    auditHostModule(moduleBody,importShapes,[primaryRuntime.sha256,plan.sourceClosureSha256,
        plan.primaryAuthority.runtimeAuthoritySha256,plan.primaryAuthority.typeAuthoritySha256,
        plan.secondaryTypeAuthoritySha256,provider.repository,provider.commit,provider.packageLockSha256,
        ...bootstrapDefinitions.flatMap(row=>[row.qname,row.moduleSpecifier,row.file.identity.sha256]),
        ...runtimeModules.flatMap(row=>[row.specifier,row.moduleSpecifier,row.file.identity.sha256]),
        ...dependencies.flatMap(row=>[row.role,row.specifier,row.path,row.sha256])]);
    const module=artifact("AchievementModule.primary-host.mjs",moduleBody);
    const receiptBody=`${canonicalJson({schema:"ap-original-achievement-primary-host-candidate-receipt@1",status:"held",
        holds:[{code:"AP_ACHIEVEMENT_PRIMARY_HOST_BROWSER_ESM_CLOSURE_UNQUALIFIED",
            reason:"multi-file browser ESM cannot bind native URL resolution to the authenticated dependency bytes"}],
        provider:{repository:provider.repository,commit:provider.commit,packageLockSha256:provider.packageLockSha256},
        primaryAuthority:plan.primaryAuthority,expectedPlan:plan,primaryRuntime,
        bootstrapDefinitions:bootstrapDefinitions.map(({qname,moduleSpecifier,exportName})=>({qname,moduleSpecifier,exportName})),
        runtimeModules:runtimeModules.map(({specifier,moduleSpecifier})=>({specifier,moduleSpecifier})),dependencies,
        exportName:FACTORY_EXPORT,output:module})}\n`,receipt=artifact("AchievementModule.primary-host-candidate-receipt.json",receiptBody);
    return Object.freeze({root:"achievement-primary-host",module,receipt,files:Object.freeze([
        Object.freeze({path:module.path,body:moduleBody,identity:module}),
        Object.freeze({path:receipt.path,body:receiptBody,identity:receipt}),
    ].sort((left,right)=>compare(left.path,right.path)))});
}

import {createHash} from "node:crypto";
import {Buffer} from "node:buffer";
import ts49 = require("typescript-4-9");
import {CliError} from "./errors";
import {canonicalJson,type BrowserSecondaryAuthorityRequest,type CompilerProviderAuthority,
    type SecondaryArtifactIdentity} from "./secondary-authority";
import type {SemanticProgram} from "../hardened/contracts";
import type {RuntimeAuthorityClassSource} from "../hardened/type-authority";

const QNAMES=Object.freeze(["AchievementModule",
    "achievement.commands.CmdGetKeepOnlineAchievements",
    "achievement.commands.CmdGetLastOnlineAchievements",
    "achievement.mediator.AchievementPresentionMediator",
    "achievement.proxy.AchievementPresentionProxy",
    "achievement.ui.AchievementPresentationPart"]);
const ACTIVATION_ORDER=Object.freeze(["link-secondary-authority","initialize-application-classes",
    "register-authority-pair","create-document","init-module","resolve-part"]);

export interface BrowserLinkerProgram {
    readonly qname:string;readonly program:SemanticProgram;readonly code:string;
    readonly sourcePath:string;readonly sourceBytes:number;readonly sourceSha256:string;
}
export interface EmittedBrowserLinkerPackage {
    readonly root:"achievement-secondary-linker";
    readonly files:readonly Readonly<{path:string;body:string|Buffer;identity:SecondaryArtifactIdentity}>[];
    readonly module:SecondaryArtifactIdentity;readonly receipt:SecondaryArtifactIdentity;
    readonly sourceClosure:SecondaryArtifactIdentity;readonly typeAuthority:SecondaryArtifactIdentity;
    readonly primaryHostInventory:Readonly<{
        bootstrapQNames:readonly string[];runtimeImports:readonly string[];
        expectedPlan:Readonly<{schema:"as3-secondary-type-authority-plan@1";sourceClosureSha256:string;
            provider:Readonly<{repository:string;commit:string;packageLockSha256:string}>;
            primaryAuthority:Readonly<{runtimeAuthoritySha256:string;typeAuthoritySha256:string}>;
            secondaryTypeAuthoritySha256:string;qnames:readonly string[]}>;
    }>;
}

type ImportBinding={imported:string;local:string};
type ParsedUnit={body:string;imports:readonly Readonly<{specifier:string;bindings:readonly ImportBinding[]}>[]};

function sha256(value:string|Buffer):string{return createHash("sha256").update(value).digest("hex");}
function artifact(path:string,body:string|Buffer):SecondaryArtifactIdentity {
    return Object.freeze({path,bytes:Buffer.byteLength(body),sha256:sha256(body)});
}
function quote(value:string):string{return JSON.stringify(value);}
function compare(left:string,right:string):number{return Buffer.compare(Buffer.from(left,"utf8"),Buffer.from(right,"utf8"));}
function runtimeEntryLiteral(source:RuntimeAuthorityClassSource,index:number):string {
    const fields=[`kind:"class"`,`qname:${quote(source.qname)}`,`base:${JSON.stringify(source.base)}`,
        `interfaces:${JSON.stringify(source.interfaces)}`,`sourceSha256:${quote(source.sourceSha256)}`,`fields:${JSON.stringify(source.fields)}`];
    if(source.objectTraits)fields.push(`objectTraits:${JSON.stringify(source.objectTraits)}`);
    if(source.nativeObjectTraits)fields.push(`nativeObjectTraits:${JSON.stringify(source.nativeObjectTraits)}`);
    if(source.fileLocalScope)fields.push(`fileLocalScope:${JSON.stringify(source.fileLocalScope)}`);
    if(source.staticReflection!==undefined)fields.push(`staticReflection:${JSON.stringify(source.staticReflection)}`);
    if(source.staticCallTraits!==undefined)fields.push(`staticCallTraits:${JSON.stringify(source.staticCallTraits)}`);
    fields.push(`constructor:__as3Application${index}.definition`,`predicate:__as3Application${index}.predicate`,
        `constructionTarget:__as3Application${index}.constructionTarget`,`constructionProof:__as3Application${index}.constructionProof`);
    return `{${fields.join(",")}}`;
}

function withoutExport(modifiers:readonly ts49.ModifierLike[]|undefined):readonly ts49.Modifier[]|undefined {
    const result=modifiers?.filter(item=>item.kind!==ts49.SyntaxKind.ExportKeyword&&item.kind!==ts49.SyntaxKind.DefaultKeyword);
    return result&&result.length?result as readonly ts49.Modifier[]:undefined;
}

function stripTopLevelExport(statement:ts49.Statement):ts49.Statement {
    if(ts49.isClassDeclaration(statement))return ts49.factory.updateClassDeclaration(statement,withoutExport(statement.modifiers),
        statement.name,statement.typeParameters,statement.heritageClauses,statement.members);
    if(ts49.isFunctionDeclaration(statement))return ts49.factory.updateFunctionDeclaration(statement,withoutExport(statement.modifiers),
        statement.asteriskToken,statement.name,statement.typeParameters,statement.parameters,statement.type,statement.body);
    if(ts49.isVariableStatement(statement))return ts49.factory.updateVariableStatement(statement,withoutExport(statement.modifiers),statement.declarationList);
    if(ts49.isInterfaceDeclaration(statement))return ts49.factory.updateInterfaceDeclaration(statement,withoutExport(statement.modifiers),
        statement.name,statement.typeParameters,statement.heritageClauses,statement.members);
    if(ts49.isTypeAliasDeclaration(statement))return ts49.factory.updateTypeAliasDeclaration(statement,withoutExport(statement.modifiers),
        statement.name,statement.typeParameters,statement.type);
    if(ts49.isEnumDeclaration(statement))return ts49.factory.updateEnumDeclaration(statement,withoutExport(statement.modifiers),statement.name,statement.members);
    if(statement.modifiers?.some(item=>item.kind===ts49.SyntaxKind.ExportKeyword||item.kind===ts49.SyntaxKind.DefaultKeyword))
        throw new CliError("browser secondary unit contains an unsupported exported declaration",4);
    return statement;
}

function parseUnit(unit:BrowserLinkerProgram):ParsedUnit {
    const source=ts49.createSourceFile(unit.program.outputModulePath,unit.code,ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.TS);
    if((source as any).parseDiagnostics.length)throw new CliError(`browser secondary TypeScript did not parse: ${unit.qname}`,4);
    const imports:Array<{specifier:string;bindings:ImportBinding[]}>=[],statements:ts49.Statement[]=[];
    for(const statement of source.statements) {
        if(ts49.isImportDeclaration(statement)) {
            if(!ts49.isStringLiteral(statement.moduleSpecifier)||!statement.importClause||statement.importClause.isTypeOnly
                ||statement.importClause.name||!statement.importClause.namedBindings||!ts49.isNamedImports(statement.importClause.namedBindings))
                throw new CliError("browser secondary unit contains a non-closed import form",4);
            const bindings=statement.importClause.namedBindings.elements.map(element=>{
                if(element.isTypeOnly)throw new CliError("browser secondary unit contains a type-only runtime import",4);
                return {imported:element.propertyName?.text??element.name.text,local:element.name.text};
            });
            if(bindings.length===0)throw new CliError("browser secondary unit contains an empty import",4);
            imports.push({specifier:statement.moduleSpecifier.text,bindings});continue;
        }
        if(ts49.isExportDeclaration(statement)||ts49.isExportAssignment(statement))
            throw new CliError("browser secondary unit contains export forwarding",4);
        statements.push(stripTopLevelExport(statement));
    }
    const clean=ts49.factory.updateSourceFile(source,statements),printed=ts49.createPrinter({newLine:ts49.NewLineKind.LineFeed})
        .printFile(clean).replace(/\r\n?/g,"\n").replace(/\n*$/,"\n");
    const reparsed=ts49.createSourceFile(unit.program.outputModulePath,printed,ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.TS);
    if((reparsed as any).parseDiagnostics.length||reparsed.statements.some(item=>ts49.isImportDeclaration(item)||ts49.isExportDeclaration(item)
        ||ts49.isExportAssignment(item)||item.modifiers?.some(modifier=>modifier.kind===ts49.SyntaxKind.ExportKeyword)))
        throw new CliError("browser secondary unit retained module syntax",4);
    const transpiled=ts49.transpileModule(printed,{fileName:unit.program.outputModulePath,reportDiagnostics:true,
        compilerOptions:{target:ts49.ScriptTarget.ES2020,module:ts49.ModuleKind.None,importsNotUsedAsValues:ts49.ImportsNotUsedAsValues.Remove}});
    if((transpiled.diagnostics||[]).some(item=>item.category===ts49.DiagnosticCategory.Error))
        throw new CliError(`browser secondary JavaScript transpilation failed: ${unit.qname}`,4);
    const body=transpiled.outputText.replace(/\r\n?/g,"\n").replace(/^"use strict";\n/,"").replace(/\n*$/,"\n");
    if(/\b(?:require|module|exports)\b/.test(body))throw new CliError("browser secondary unit widened into CommonJS",4);
    return Object.freeze({body,imports:Object.freeze(imports.map(item=>Object.freeze({specifier:item.specifier,
        bindings:Object.freeze(item.bindings.map(binding=>Object.freeze(binding)))})))});
}

function isBindingDeclarationName(node:ts49.Identifier):boolean {
    const parent=node.parent;
    return ts49.isVariableDeclaration(parent)&&parent.name===node
        ||ts49.isParameter(parent)&&parent.name===node
        ||ts49.isFunctionDeclaration(parent)&&parent.name===node
        ||ts49.isFunctionExpression(parent)&&parent.name===node
        ||ts49.isClassDeclaration(parent)&&parent.name===node
        ||ts49.isClassExpression(parent)&&parent.name===node
        ||ts49.isBindingElement(parent)&&parent.name===node
        ||ts49.isCatchClause(parent)&&parent.variableDeclaration?.name===node;
}

function isNonValueIdentifier(node:ts49.Identifier):boolean {
    const parent=node.parent;
    return ts49.isPropertyAccessExpression(parent)&&parent.name===node
        ||ts49.isPropertyAssignment(parent)&&parent.name===node
        ||ts49.isMethodDeclaration(parent)&&parent.name===node
        ||ts49.isPropertyDeclaration(parent)&&parent.name===node
        ||ts49.isGetAccessorDeclaration(parent)&&parent.name===node
        ||ts49.isSetAccessorDeclaration(parent)&&parent.name===node
        ||ts49.isLabeledStatement(parent)&&parent.label===node
        ||ts49.isBreakOrContinueStatement(parent)&&parent.label===node;
}

/**
 * Application modules retain ESM-like live import bindings even though the closed linker is
 * import-free.  Rewriting happens after type erasure, and fails closed on lexical shadowing,
 * so only value references to the original imported class name can become live-cell reads.
 */
function rewriteLiveApplicationBindings(body:string,bindings:ReadonlyMap<string,number>,qname:string):string {
    if(bindings.size===0)return body;
    const source=ts49.createSourceFile(`${qname}.js`,body,ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.JS);
    if((source as any).parseDiagnostics.length)throw new CliError(`browser secondary JavaScript did not parse: ${qname}`,4);
    let shadowed:string|null=null;
    const scan=(node:ts49.Node):void=>{
        if(ts49.isIdentifier(node)&&bindings.has(node.text)&&isBindingDeclarationName(node))shadowed=node.text;
        ts49.forEachChild(node,scan);
    };scan(source);
    if(shadowed!==null)throw new CliError(`browser secondary application import is lexically shadowed: ${shadowed}`,4);
    const result=ts49.transform(source,[context=>root=>{
        const visit=(node:ts49.Node):ts49.VisitResult<ts49.Node>=>{
            if(ts49.isShorthandPropertyAssignment(node)&&bindings.has(node.name.text)) {
                if(node.objectAssignmentInitializer)throw new CliError("browser secondary application import uses an unsupported shorthand initializer",4);
                return ts49.factory.createPropertyAssignment(node.name,ts49.factory.createCallExpression(
                    ts49.factory.createIdentifier("__as3ResolveApplicationDefinition"),undefined,
                    [ts49.factory.createNumericLiteral(bindings.get(node.name.text)!)]));
            }
            if(ts49.isIdentifier(node)&&bindings.has(node.text)&&!isNonValueIdentifier(node)&&!isBindingDeclarationName(node))
                return ts49.factory.createCallExpression(ts49.factory.createIdentifier("__as3ResolveApplicationDefinition"),undefined,
                    [ts49.factory.createNumericLiteral(bindings.get(node.text)!)]);
            return ts49.visitEachChild(node,visit,context);
        };
        return ts49.visitNode(root,visit) as ts49.SourceFile;
    }]);
    try {
        return ts49.createPrinter({newLine:ts49.NewLineKind.LineFeed}).printFile(result.transformed[0] as ts49.SourceFile)
            .replace(/\r\n?/g,"\n").replace(/\n*$/,"\n");
    } finally { result.dispose(); }
}

function auditModule(source:string):void {
    const parsed=ts49.createSourceFile("AchievementModule.secondary-linker.mjs",source,ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.JS);
    const sole=parsed.statements[0];
    if((parsed as any).parseDiagnostics.length||parsed.statements.length!==1||!sole||!ts49.isFunctionDeclaration(sole)
        ||sole.name?.text!=="linkAS3SecondaryAuthority"
        ||!sole.modifiers?.some(item=>item.kind===ts49.SyntaxKind.ExportKeyword))
        throw new CliError("browser secondary linker is not a sole exported function",4);
    let forbidden:string|null=null;
    const visit=(node:ts49.Node):void=>{
        if(ts49.isImportDeclaration(node)||ts49.isImportEqualsDeclaration(node)||ts49.isExportDeclaration(node)
            ||ts49.isCallExpression(node)&&node.expression.kind===ts49.SyntaxKind.ImportKeyword)forbidden="module loading syntax";
        if(ts49.isIdentifier(node)&&["require","module","exports","eval","Function","globalThis","window","self","process"].includes(node.text))
            forbidden=`forbidden identifier ${node.text}`;
        if(ts49.isTemplateExpression(node)||ts49.isNoSubstitutionTemplateLiteral(node))forbidden="template literal";
        if(ts49.isIdentifier(node)&&node.text==="primary"&&node.parent!==sole.parameters[0]) {
            const access=ts49.isPropertyAccessExpression(node.parent)&&node.parent.expression===node?node.parent:null;
            if(!access||!["runtimeAuthoritySha256","typeAuthoritySha256","resolveDefinition","resolveRuntimeModule","beginSecondaryAuthority"].includes(access.name.text))
                forbidden="dynamic primary capability access";
            if(access&&["resolveDefinition","resolveRuntimeModule"].includes(access.name.text)) {
                const call=ts49.isCallExpression(access.parent)&&access.parent.expression===access?access.parent:null;
                if(!call||call.arguments.length!==1||!ts49.isStringLiteral(call.arguments[0]!))forbidden="dynamic primary capability resolution";
            }
        }
        ts49.forEachChild(node,visit);
    };visit(parsed);
    if(forbidden)throw new CliError(`browser secondary linker contains ${forbidden}`,4);
}

export function emitBrowserSecondaryLinkerPackage(request:BrowserSecondaryAuthorityRequest,
    provider:CompilerProviderAuthority,sourceClosureBytes:Buffer,sourceClosureDocument:any,
    programs:readonly BrowserLinkerProgram[],authoritySources:readonly RuntimeAuthorityClassSource[]):EmittedBrowserLinkerPackage {
    if(request.compilerProviderSha256!==provider.authoritySha256||request.sourceClosureSha256!==sha256(sourceClosureBytes)
        ||sourceClosureDocument?.schema!=="as3-authenticated-source-closure@2"||!Array.isArray(sourceClosureDocument.roots)
        ||sourceClosureDocument.roots.length!==2||sourceClosureDocument.roots[0]?.module!=="application"
        ||sourceClosureDocument.roots[0]?.path!=="application"||sourceClosureDocument.roots[1]?.module!=="bootstrap"
        ||sourceClosureDocument.roots[1]?.path!=="bootstrap")
        throw new CliError("browser secondary linker requires its exact authenticated v2 source closure",6);
    const applicationFiles=sourceClosureDocument.roots[0].files as any[],bootstrapFiles=sourceClosureDocument.roots[1].files as any[];
    if(!Array.isArray(applicationFiles)||applicationFiles.length!==QNAMES.length||!Array.isArray(bootstrapFiles)||bootstrapFiles.length===0
        ||programs.length!==QNAMES.length||authoritySources.length!==QNAMES.length||programs.some((unit,index)=>unit.qname!==QNAMES[index]
            ||unit.program.declaration.declarationKind!=="class"||unit.program.fileLocalScope!=null))
        throw new CliError("browser secondary linker requires the exact six ordered application classes",6);
    if(authoritySources.some((source,index)=>source.kind!=="class"||source.qname!==QNAMES[index]||source.fileLocalScope
        ||source.constructionTargetExport!=="as3ConstructionTarget"||source.constructionProofExport!=="isAS3ConstructionProof"
        ||source.predicateExport!=="isAS3ClassInstance"||source.constructorExport!==programs[index]!.program.declaration.name))
        throw new CliError("browser secondary linker type-authority sources differ from the six application classes",6);
    const applicationByQName=new Map<string,number>(),bootstrapByQName=new Map<string,number>();
    applicationFiles.forEach((file,index)=>{
        if(!Array.isArray(file.qnames)||file.qnames.length!==1||file.qnames[0]!==QNAMES[index])
            throw new CliError("browser secondary application order differs from the authenticated closure",6);
        applicationByQName.set(file.qnames[0],index);
        const unit=programs[index]!,source=request.executable.sources[index]!,sourcePath=sourceClosureDocument.roots[0].sourcePrefix+file.path;
        if(unit.sourcePath!==file.path||unit.sourceBytes!==file.bytes||unit.sourceSha256!==file.sha256
            ||source.qname!==file.qnames[0]||source.path!==sourcePath||source.bytes!==file.bytes||source.sha256!==file.sha256)
            throw new CliError("browser secondary executable sources differ from the authenticated closure",6);
    });
    const bootstrapQNames=bootstrapFiles.map((file:any)=>{
        if(!Array.isArray(file.qnames)||file.qnames.length!==1||typeof file.qnames[0]!=="string")
            throw new CliError("browser secondary bootstrap QName inventory is invalid",6);
        return file.qnames[0] as string;
    }).sort(compare);
    if(new Set(bootstrapQNames).size!==bootstrapQNames.length)throw new CliError("browser secondary bootstrap QName inventory is duplicated",6);
    bootstrapQNames.forEach((qname,index)=>bootstrapByQName.set(qname,index));
    const units=programs.map(parseUnit),externalSpecifiers=[...new Set(units.flatMap(unit=>unit.imports.map(item=>item.specifier)).filter(specifier=>{
        return !programs.some(program=>program.program.imports.some(item=>item.authorityKind==="local"&&item.targetModule===specifier));
    }))].sort(compare),runtimeIndex=new Map(externalSpecifiers.map((value,index)=>[value,index]));
    const registryMetadataEntries=authoritySources.map(source=>({kind:"class" as const,qname:source.qname,base:source.base,
        interfaces:source.interfaces,sourceSha256:source.sourceSha256,fields:source.fields,
        ...(source.objectTraits?{objectTraits:source.objectTraits}:{}),...(source.nativeObjectTraits?{nativeObjectTraits:source.nativeObjectTraits}:{}),
        ...(source.staticReflection!==undefined?{staticReflection:source.staticReflection}:{}),
        ...(source.staticCallTraits!==undefined?{staticCallTraits:source.staticCallTraits}:{})}));
    const registryMetadata={schema:"as3-runtime-secondary-type-authority@1",primarySha256:request.primaryAuthority.typeAuthoritySha256,
        qnames:[...QNAMES],entries:registryMetadataEntries};
    const registryDigest=sha256(JSON.stringify(registryMetadata));
    const lines=["export function linkAS3SecondaryAuthority(primary) {",
        `  if (primary.runtimeAuthoritySha256 !== ${quote(request.primaryAuthority.runtimeAuthoritySha256)}) throw new Error("primary runtime authority differs");`,
        `  if (primary.typeAuthoritySha256 !== ${quote(request.primaryAuthority.typeAuthoritySha256)}) throw new Error("primary type authority differs");`,
        `  const __as3Provider = Object.freeze(${canonicalJson({repository:provider.repository,commit:provider.commit,packageLockSha256:provider.packageLockSha256})});`,
        `  const __as3PrimaryAuthority = Object.freeze(${canonicalJson(request.primaryAuthority)});`,
        `  const __as3QNames = Object.freeze(${JSON.stringify(QNAMES)});`,
        "  let __as3Transaction = null;",
        "  let __as3TypeReservation = null;",
        "  let __as3Linked = false;",
        "  try {",
        `    __as3Transaction = primary.beginSecondaryAuthority(Object.freeze({schema:"as3-secondary-type-authority-plan@1",sourceClosureSha256:${quote(request.sourceClosureSha256)},provider:__as3Provider,primaryAuthority:__as3PrimaryAuthority,secondaryTypeAuthoritySha256:${quote(registryDigest)},qnames:__as3QNames}));`,
        `    if (__as3Transaction === null || __as3Transaction.schema !== "as3-secondary-type-authority-transaction@1" || __as3Transaction.primaryAuthoritySha256 !== ${quote(request.primaryAuthority.typeAuthoritySha256)} || __as3Transaction.secondaryTypeAuthoritySha256 !== ${quote(registryDigest)} || __as3Transaction.active !== true || !Array.isArray(__as3Transaction.qnames) || __as3Transaction.qnames.length !== __as3QNames.length || __as3Transaction.qnames.some((qname, index) => qname !== __as3QNames[index]) || typeof __as3Transaction.preflight !== "function" || typeof __as3Transaction.abort !== "function") throw new Error("secondary type transaction identity differs");`,
        ...bootstrapQNames.map((qname,index)=>`    const __as3Bootstrap${index} = primary.resolveDefinition(${quote(qname)});`),
        ...externalSpecifiers.map((specifier,index)=>`    const __as3Runtime${index} = primary.resolveRuntimeModule(${quote(specifier)});`),
        "    const __as3ApplicationDefinitions = [];",
        "    const __as3ResolveApplicationDefinition = index => {",
        "      const definition = __as3ApplicationDefinitions[index];",
        "      if (definition === undefined) throw new Error(\"secondary application definition was consumed before evaluation\");",
        "      return definition;",
        "    };"];
    units.forEach((unit,index)=>{
        const program=programs[index]!,semanticByLocal=new Map(program.program.imports.filter(item=>!item.compileTimeNamespace)
            .map(item=>[item.sourceLocalName,item])),applicationBindings=new Map<string,number>();
        lines.push(`    const __as3Application${index} = (() => {`);
        for(const imported of unit.imports)for(const binding of imported.bindings) {
            const semantic=semanticByLocal.get(binding.local);
            if(semantic?.authorityKind==="local") {
                const appIndex=applicationByQName.get(semantic.sourceQualifiedName),bootIndex=bootstrapByQName.get(semantic.sourceQualifiedName);
                if(appIndex!==undefined) {
                    const previous=applicationBindings.get(binding.local);
                    if(previous!==undefined&&previous!==appIndex)
                        throw new CliError(`browser secondary application import is ambiguous: ${binding.local}`,4);
                    applicationBindings.set(binding.local,appIndex);
                } else if(bootIndex!==undefined)lines.push(`      const ${binding.local} = __as3Bootstrap${bootIndex};`);
                else throw new CliError(`browser secondary local import is outside the authenticated closure: ${semantic.sourceQualifiedName}`,4);
            } else {
                const sourceIndex=runtimeIndex.get(imported.specifier);
                if(sourceIndex===undefined)throw new CliError("browser secondary runtime import inventory is incomplete",4);
                lines.push(`      const ${binding.local} = __as3Runtime${sourceIndex}[${quote(binding.imported)}];`);
            }
        }
        const body=rewriteLiveApplicationBindings(unit.body,applicationBindings,program.qname);
        lines.push(...body.split("\n").filter((_,lineIndex,array)=>lineIndex<array.length-1).map(row=>`      ${row}`));
        lines.push(`      return Object.freeze({definition:${program.program.declaration.name},predicate:isAS3ClassInstance,constructionTarget:as3ConstructionTarget,constructionProof:isAS3ConstructionProof,initialize:()=>{__as3InitializeClass(${program.program.declaration.name});}});`,
            "    })();",`    __as3ApplicationDefinitions[${index}] = __as3Application${index}.definition;`);
    });
    lines.push("    Object.freeze(__as3ApplicationDefinitions);","    const __as3RuntimeEntries = Object.freeze([",
        ...authoritySources.map((source,index)=>`      Object.freeze(${runtimeEntryLiteral(source,index)}),`),
        "    ]);",
        `    const __as3RuntimeDocument = Object.freeze({schema:"as3-runtime-secondary-type-authority@1",primarySha256:${quote(request.primaryAuthority.typeAuthoritySha256)},sha256:${quote(registryDigest)},qnames:__as3QNames,entries:__as3RuntimeEntries});`,
        "    __as3TypeReservation = __as3Transaction.preflight(__as3RuntimeDocument);",
        `    if (__as3TypeReservation === null || __as3TypeReservation.schema !== "as3-secondary-type-authority-reservation@1" || __as3TypeReservation.primaryAuthoritySha256 !== ${quote(request.primaryAuthority.typeAuthoritySha256)} || __as3TypeReservation.secondaryTypeAuthoritySha256 !== ${quote(registryDigest)} || __as3TypeReservation.active !== true || !Array.isArray(__as3TypeReservation.qnames) || __as3TypeReservation.qnames.length !== __as3QNames.length || __as3TypeReservation.qnames.some((qname, index) => qname !== __as3QNames[index]) || typeof __as3TypeReservation.commit !== "function" || typeof __as3TypeReservation.abort !== "function") throw new Error("secondary type reservation identity differs");`);
    lines.push("    const __as3Definitions = Object.freeze([",
        ...QNAMES.map((qname,index)=>`      Object.freeze({qname:${quote(qname)},definition:__as3Application${index}.definition,initialize:__as3Application${index}.initialize}),`),
        "    ]);",
        `    const __as3Result = Object.freeze({schema:"ap-original-achievement-linked-authority@1",sourceClosureSha256:${quote(request.sourceClosureSha256)},provider:__as3Provider,primaryAuthority:__as3PrimaryAuthority,secondaryTypeAuthoritySha256:${quote(registryDigest)},definitions:__as3Definitions,publicDefinitions:Object.freeze([__as3Definitions[0],__as3Definitions[5]]),typeReservation:__as3TypeReservation});`,
        "    __as3Linked = true;",
        "    return __as3Result;",
        "  } finally {",
        "    if (!__as3Linked) {",
        "      if (__as3TypeReservation !== null) __as3TypeReservation.abort();",
        "      else if (__as3Transaction !== null) __as3Transaction.abort();",
        "    }",
        "  }",
        "}","");
    const sourceClosure=artifact("AchievementModule.source-closure.json",sourceClosureBytes);
    const evidence={schema:"ap-original-achievement-secondary-type-authority-evidence@3",sourceClosureSha256:sourceClosure.sha256,
        secondaryTypeAuthoritySha256:registryDigest,
        primaryAuthority:request.primaryAuthority,applicationDefinitions:request.executable.sources.map((source,index)=>({qname:source.qname,
            sourcePath:source.path,sourceBytes:source.bytes,sourceSha256:source.sha256,evaluation:"evaluated-in-link-order",evaluationOrder:index,
            initializer:"initialized-after-link-in-order",initializerOrder:index})),evaluationOrder:[...QNAMES],initializerOrder:[...QNAMES],
        externalBootstrapQNames:bootstrapQNames,externalRuntimeImports:externalSpecifiers,runtimeTypeAuthority:Object.freeze({...registryMetadata,sha256:registryDigest})};
    const evidenceBody=`${canonicalJson(evidence)}\n`,typeAuthority=artifact("AchievementModule.secondary-type-authority.json",evidenceBody);
    lines.splice(6,0,`  const __as3EvidenceSha256 = ${quote(typeAuthority.sha256)};`,`  if (__as3EvidenceSha256.length !== 64) throw new Error("secondary evidence identity differs");`);
    const moduleBody=lines.join("\n");auditModule(moduleBody);
    const module=artifact("AchievementModule.secondary-linker.mjs",moduleBody);
    const receiptBody=`${canonicalJson({schema:"ap-original-achievement-secondary-linker-receipt@3",status:"qualified",
        logicalPath:request.executable.logicalPath,sourceSwf:request.executable.sourceSwf,documentBundleId:request.executable.documentBundleId,
        modulePartQName:request.executable.modulePartQName,provider:{repository:provider.repository,commit:provider.commit,
            packageLockSha256:provider.packageLockSha256},sources:request.executable.sources,sourceClosure,secondaryTypeAuthority:typeAuthority,
        primaryAuthority:request.primaryAuthority,secondaryTypeAuthoritySha256:registryDigest,output:module,
        activationOrder:ACTIVATION_ORDER})}\n`,receipt=artifact("AchievementModule.authority-receipt.json",receiptBody);
    const bodies=new Map([[receipt.path,receiptBody],[module.path,moduleBody],[typeAuthority.path,evidenceBody],
        [sourceClosure.path,sourceClosureBytes] as [string,string|Buffer]]);
    const identities=[receipt,module,typeAuthority,sourceClosure].sort((left,right)=>compare(left.path,right.path));
    const primaryHostInventory=Object.freeze({bootstrapQNames:Object.freeze([...bootstrapQNames]),
        runtimeImports:Object.freeze([...externalSpecifiers]),expectedPlan:Object.freeze({schema:"as3-secondary-type-authority-plan@1" as const,
            sourceClosureSha256:request.sourceClosureSha256,
            provider:Object.freeze({repository:provider.repository,commit:provider.commit,packageLockSha256:provider.packageLockSha256}),
            primaryAuthority:Object.freeze({...request.primaryAuthority}),secondaryTypeAuthoritySha256:registryDigest,
            qnames:Object.freeze([...QNAMES])})});
    return Object.freeze({root:"achievement-secondary-linker",module,receipt,sourceClosure,typeAuthority,primaryHostInventory,
        files:Object.freeze(identities.map(identity=>Object.freeze({path:identity.path,body:bodies.get(identity.path)!,identity})))});
}

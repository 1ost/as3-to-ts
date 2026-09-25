import {createHash} from "node:crypto";
import {Buffer} from "node:buffer";
import {posix} from "node:path";
import ts49 = require("typescript-4-9");
import {CliError} from "./errors";
import {canonicalJson,type CompilerProviderAuthority,type SecondaryArtifactIdentity} from "./secondary-authority";
import type {EmittedBrowserEsmRuntime} from "./browser-esm-runtime";
import type {EmittedPrimarySecondaryHostPackage} from "./primary-secondary-host";

const EXPORT_NAME="createAchievementPrimarySecondaryLinkage";
const FORBIDDEN_IDENTIFIERS=Object.freeze(["require","module","exports","eval","Function","globalThis","window","self","process"]);
const SECONDARY_QNAMES=Object.freeze(["AchievementModule","achievement.commands.CmdGetKeepOnlineAchievements",
    "achievement.commands.CmdGetLastOnlineAchievements","achievement.mediator.AchievementPresentionMediator",
    "achievement.proxy.AchievementPresentionProxy","achievement.ui.AchievementPresentationPart"]);
export interface EmittedPrimaryHostBundleCandidate {
    readonly root:"achievement-primary-host-bundle-candidate";
    readonly module:SecondaryArtifactIdentity;readonly receipt:SecondaryArtifactIdentity;
    readonly files:readonly Readonly<{path:string;body:string;identity:SecondaryArtifactIdentity}>[];
}

function sha256(value:string):string{return createHash("sha256").update(value,"utf8").digest("hex");}
function compare(left:string,right:string):number{return Buffer.compare(Buffer.from(left,"utf8"),Buffer.from(right,"utf8"));}
function artifact(path:string,body:string):SecondaryArtifactIdentity {
    return Object.freeze({path,bytes:Buffer.byteLength(body,"utf8"),sha256:sha256(body)});
}
function jsonStringLiterals(source:string):string {
    const parsed=ts49.createSourceFile("json-string-normalization.js",source,ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.JS),
        replacements:{start:number;end:number;body:string}[]=[];
    const visit=(node:ts49.Node):void=>{
        if(ts49.isStringLiteral(node))replacements.push({start:node.getStart(parsed),end:node.end,body:JSON.stringify(node.text)});
        ts49.forEachChild(node,visit);
    };visit(parsed);let cursor=0;const pieces:string[]=[];
    for(const replacement of replacements.sort((left,right)=>left.start-right.start)) {
        pieces.push(source.slice(cursor,replacement.start),replacement.body);cursor=replacement.end;
    }
    pieces.push(source.slice(cursor));return pieces.join("");
}
function exactKeys(value:unknown,keys:readonly string[]):value is Record<string,unknown> {
    if(value===null||typeof value!=="object"||Array.isArray(value))return false;
    const actual=Object.keys(value as object).sort(),expected=[...keys].sort();
    return actual.length===expected.length&&actual.every((key,index)=>key===expected[index]);
}
function validArtifact(value:unknown):value is SecondaryArtifactIdentity {
    return exactKeys(value,["path","bytes","sha256"])&&typeof value.path==="string"&&Number.isSafeInteger(value.bytes)
        &&(value.bytes as number)>=0&&typeof value.sha256==="string"&&/^[0-9a-f]{64}$/.test(value.sha256);
}
function resolveOwned(from:string,requested:string,owned:ReadonlySet<string>):string|null {
    if(!requested.startsWith("."))return null;
    const candidate=posix.normalize(posix.join(posix.dirname(from),requested));
    for(const path of [candidate,`${candidate}.mjs`,`${candidate}.js`])if(owned.has(path))return path;
    return null;
}
function factoryCycles(factories:readonly Readonly<{id:string;requests:readonly string[]}>[],owned:ReadonlySet<string>):readonly (readonly string[])[] {
    const byId=new Map(factories.map(factory=>[factory.id,factory])),indices=new Map<string,number>(),low=new Map<string,number>(),
        stack:string[]=[],onStack=new Set<string>(),components:string[][]=[];let next=0;
    const connect=(id:string):void=>{
        indices.set(id,next);low.set(id,next);next++;stack.push(id);onStack.add(id);
        for(const requested of byId.get(id)!.requests) {
            const dependency=resolveOwned(id,requested,owned)!;
            if(!indices.has(dependency)) {connect(dependency);low.set(id,Math.min(low.get(id)!,low.get(dependency)!));}
            else if(onStack.has(dependency))low.set(id,Math.min(low.get(id)!,indices.get(dependency)!));
        }
        if(low.get(id)!==indices.get(id))return;
        const component:string[]=[];let member:string;
        do {member=stack.pop()!;onStack.delete(member);component.push(member);} while(member!==id);
        component.sort(compare);
        if(component.length>1||byId.get(id)!.requests.some(requested=>resolveOwned(id,requested,owned)===id))components.push(component);
    };
    [...byId.keys()].sort(compare).forEach(id=>{if(!indices.has(id))connect(id);});
    return Object.freeze(components.sort((left,right)=>compare(left[0]!,right[0]!)).map(component=>Object.freeze(component)));
}

function sameArtifact(left:SecondaryArtifactIdentity,right:SecondaryArtifactIdentity):boolean {
    return left.path===right.path&&left.bytes===right.bytes&&left.sha256===right.sha256;
}
function validateSourceCandidate(body:string,host:EmittedPrimarySecondaryHostPackage,runtime:EmittedBrowserEsmRuntime,
    provider:CompilerProviderAuthority,hostSource:string):any {
    let value:any;try{value=JSON.parse(body);}catch{throw new CliError("primary host candidate receipt is malformed",70);}
    const receiptKeys=["schema","status","holds","provider","primaryAuthority","expectedPlan","primaryRuntime",
        "bootstrapDefinitions","runtimeModules","dependencies","exportName","output"];
    const holdReason="multi-file browser ESM cannot bind native URL resolution to the authenticated dependency bytes";
    if(!exactKeys(value,receiptKeys)||value.schema!=="ap-original-achievement-primary-host-candidate-receipt@1"
        ||value.status!=="held"||!Array.isArray(value.holds)||value.holds.length!==1
        ||!exactKeys(value.holds[0],["code","reason"])
        ||value.holds[0].code!=="AP_ACHIEVEMENT_PRIMARY_HOST_BROWSER_ESM_CLOSURE_UNQUALIFIED"
        ||value.holds[0].reason!==holdReason||value.exportName!==EXPORT_NAME||!validArtifact(value.output)
        ||!sameArtifact(value.output,host.module)||`${canonicalJson(value)}\n`!==body)
        throw new CliError("primary host candidate receipt is not canonical and closed",6);
    const selectedProvider={repository:provider.repository,commit:provider.commit,packageLockSha256:provider.packageLockSha256};
    if(!exactKeys(value.provider,["repository","commit","packageLockSha256"])
        ||canonicalJson(value.provider)!==canonicalJson(selectedProvider)
        ||!exactKeys(value.primaryAuthority,["runtimeAuthoritySha256","typeAuthoritySha256"])
        ||typeof value.primaryAuthority.runtimeAuthoritySha256!=="string"||typeof value.primaryAuthority.typeAuthoritySha256!=="string"
        ||!/^[0-9a-f]{64}$/.test(value.primaryAuthority.runtimeAuthoritySha256)
        ||!/^[0-9a-f]{64}$/.test(value.primaryAuthority.typeAuthoritySha256))
        throw new CliError("primary host candidate authority identity differs",6);
    if(!exactKeys(value.expectedPlan,["schema","sourceClosureSha256","provider","primaryAuthority",
        "secondaryTypeAuthoritySha256","qnames"])||value.expectedPlan.schema!=="as3-secondary-type-authority-plan@1"
        ||typeof value.expectedPlan.sourceClosureSha256!=="string"
        ||typeof value.expectedPlan.secondaryTypeAuthoritySha256!=="string"
        ||!/^[0-9a-f]{64}$/.test(value.expectedPlan.sourceClosureSha256)
        ||!/^[0-9a-f]{64}$/.test(value.expectedPlan.secondaryTypeAuthoritySha256)
        ||canonicalJson(value.expectedPlan.provider)!==canonicalJson(value.provider)
        ||canonicalJson(value.expectedPlan.primaryAuthority)!==canonicalJson(value.primaryAuthority)
        ||canonicalJson(value.expectedPlan.qnames)!==canonicalJson(SECONDARY_QNAMES))
        throw new CliError("primary host candidate expected plan differs",6);
    if(!validArtifact(value.primaryRuntime)||!sameArtifact(value.primaryRuntime,Object.freeze({
        path:`${runtime.root}/${runtime.primaryRuntime.path}`,bytes:runtime.primaryRuntime.identity.bytes,
        sha256:runtime.primaryRuntime.identity.sha256})))
        throw new CliError("primary host candidate primary runtime identity differs",6);
    if(!Array.isArray(value.bootstrapDefinitions)||!Array.isArray(value.runtimeModules)
        ||!Array.isArray(value.dependencies))throw new CliError("primary host candidate inventory is malformed",6);
    const bootstrap=value.bootstrapDefinitions as any[],runtimeModules=value.runtimeModules as any[];
    if(bootstrap.some(row=>!exactKeys(row,["qname","moduleSpecifier","exportName"])||typeof row.qname!=="string"
        ||typeof row.moduleSpecifier!=="string"||typeof row.exportName!=="string")
        ||runtimeModules.some(row=>!exactKeys(row,["specifier","moduleSpecifier"])||typeof row.specifier!=="string"
            ||typeof row.moduleSpecifier!=="string")
        ||bootstrap.some((row,index)=>index>0&&compare(bootstrap[index-1]!.qname,row.qname)>=0)
        ||runtimeModules.some((row,index)=>index>0&&compare(runtimeModules[index-1]!.specifier,row.specifier)>=0))
        throw new CliError("primary host candidate resolver inventory differs",6);
    const runtimePrefix=`../${runtime.root}/`,fileByPath=new Map(runtime.files.map(file=>[file.path,file]));
    const localPath=(specifier:string):string=>{
        if(!specifier.startsWith(runtimePrefix))throw new CliError("primary host candidate dependency leaves its runtime root",6);
        const path=specifier.slice(runtimePrefix.length);
        if(path.startsWith("/")||path.startsWith("../")||posix.normalize(path)!==path||!fileByPath.has(path))
            throw new CliError("primary host candidate dependency path differs",6);
        return path;
    };
    const primarySpecifier=`../${value.primaryRuntime.path}`,direct=new Map<string,{role:string;specifier:string}>();
    direct.set(localPath(primarySpecifier),{role:"primary-runtime",specifier:primarySpecifier});
    bootstrap.forEach(row=>direct.set(localPath(row.moduleSpecifier),{role:"bootstrap-definition",specifier:row.moduleSpecifier}));
    runtimeModules.forEach(row=>{const path=localPath(row.moduleSpecifier);
        if(!direct.has(path))direct.set(path,{role:"runtime-module",specifier:row.moduleSpecifier});});
    const dependency=(path:string,row:{role:string;specifier:string})=>{
        const file=fileByPath.get(path)!;return {role:row.role,specifier:row.specifier,path:`${runtime.root}/${path}`,
            bytes:file.identity.bytes,sha256:file.identity.sha256,format:"browser-esm@1",
            imports:file.imports.map(item=>({specifier:item.specifier,path:`${runtime.root}/${item.path}`}))};
    };
    const expectedDependencies=[...direct].map(([path,row])=>dependency(path,row)).concat(runtime.files
        .filter(file=>!direct.has(file.path)).sort((left,right)=>compare(left.path,right.path))
        .map(file=>dependency(file.path,{role:"transitive-module",specifier:`../${runtime.root}/${file.path}`})));
    if(canonicalJson(value.dependencies)!==canonicalJson(expectedDependencies))
        throw new CliError("primary host candidate dependency edge inventory differs",6);
    const parsed=ts49.createSourceFile(host.module.path,hostSource,ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.JS);
    const imports=parsed.statements.filter(ts49.isImportDeclaration),importSpecifiers=imports.map(statement=>
        ts49.isStringLiteral(statement.moduleSpecifier)?statement.moduleSpecifier.text:null);
    if(importSpecifiers.includes(null)||canonicalJson(importSpecifiers)!==canonicalJson([primarySpecifier,
        ...bootstrap.map(row=>row.moduleSpecifier),...runtimeModules.map(row=>row.moduleSpecifier)]))
        throw new CliError("primary host candidate literal import inventory differs",6);
    const namedImports=(statement:ts49.ImportDeclaration):readonly string[]|null=>{
        const bindings=statement.importClause?.namedBindings;
        return bindings&&ts49.isNamedImports(bindings)?bindings.elements.map(item=>item.propertyName?.text??item.name.text):null;
    };
    if(canonicalJson(namedImports(imports[0]!))!==canonicalJson(["AS3_TYPE_AUTHORITY_SHA256","__as3CreatePrimarySecondaryLinkage"])
        ||bootstrap.some((row,index)=>canonicalJson(namedImports(imports[index+1]!))!==canonicalJson([row.exportName]))
        ||runtimeModules.some((_row,index)=>{const bindings=imports[index+1+bootstrap.length]!.importClause?.namedBindings;
            return !bindings||!ts49.isNamespaceImport(bindings);}))
        throw new CliError("primary host candidate definition import inventory differs",6);
    for(const qname of SECONDARY_QNAMES)if(fileByPath.has(`application/${qname.replace(/\./g,"/")}.mjs`))
        throw new CliError("primary host candidate runtime embeds a secondary definition",6);
    return value;
}
function isPropertyName(node:ts49.Identifier):boolean {
    const parent=node.parent;
    return ts49.isPropertyAccessExpression(parent)&&parent.name===node
        ||ts49.isPropertyAssignment(parent)&&parent.name===node
        ||ts49.isMethodDeclaration(parent)&&parent.name===node
        ||ts49.isGetAccessorDeclaration(parent)&&parent.name===node
        ||ts49.isSetAccessorDeclaration(parent)&&parent.name===node;
}
function isForbiddenIdentifier(value:string):boolean{return FORBIDDEN_IDENTIFIERS.includes(value);}
function bindingNames(name:ts49.BindingName):readonly ts49.Identifier[] {
    if(ts49.isIdentifier(name))return [name];
    return name.elements.flatMap(element=>ts49.isOmittedExpression(element)?[]:bindingNames(element.name));
}
function assertNoCommonJsShadowing(id:string,source:string):void {
    const parsed=ts49.createSourceFile(id,source,ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.JS);
    if((parsed as any).parseDiagnostics.length)throw new CliError(`primary host bundle input did not parse: ${id}`,4);
    let shadowed:string|null=null,escaped:string|null=null;
    const check=(identifier:ts49.Identifier|undefined):void=>{
        if(identifier&&["require","module","exports","Function"].includes(identifier.text))shadowed=identifier.text;
    };
    const visit=(node:ts49.Node):void=>{
        if(ts49.isVariableDeclaration(node)||ts49.isParameter(node)||ts49.isBindingElement(node))
            bindingNames(node.name).forEach(check);
        else if(ts49.isFunctionDeclaration(node)||ts49.isFunctionExpression(node)||ts49.isClassDeclaration(node)
            ||ts49.isClassExpression(node))check(node.name);
        else if(ts49.isImportClause(node)||ts49.isNamespaceImport(node)||ts49.isImportSpecifier(node))check(node.name);
        else if(ts49.isCatchClause(node)&&node.variableDeclaration)
            bindingNames(node.variableDeclaration.name).forEach(check);
        if(ts49.isIdentifier(node)&&["require","module","exports"].includes(node.text)&&!isPropertyName(node))escaped=node.text;
        ts49.forEachChild(node,visit);
    };visit(parsed);
    if(shadowed)throw new CliError(`primary host bundle input shadows CommonJS ambient ${shadowed}: ${id}`,4);
    if(escaped)throw new CliError(`primary host bundle input escapes CommonJS ambient ${escaped}: ${id}`,4);
}
function assertFrozenNamespaceCompatible(id:string,source:string):void {
    const parsed=ts49.createSourceFile(id,source,ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.JS),exported=new Set<string>(),
        mutable=new Set<string>();
    for(const statement of parsed.statements) {
        const isExported=statement.modifiers?.some(item=>item.kind===ts49.SyntaxKind.ExportKeyword)===true;
        if(ts49.isVariableStatement(statement)) {
            const names=statement.declarationList.declarations.flatMap(item=>bindingNames(item.name));
            if((statement.declarationList.flags&ts49.NodeFlags.Const)===0)names.forEach(item=>mutable.add(item.text));
            if(isExported&&(statement.declarationList.flags&ts49.NodeFlags.Const)===0)
                throw new CliError(`primary host bundle cannot freeze a mutable ESM export: ${id}`,4);
            if(isExported)names.forEach(item=>exported.add(item.text));
        } else if((ts49.isFunctionDeclaration(statement)||ts49.isClassDeclaration(statement))&&isExported&&statement.name)
            exported.add(statement.name.text);
        else if(ts49.isExportDeclaration(statement)&&!statement.moduleSpecifier&&statement.exportClause
            &&ts49.isNamedExports(statement.exportClause))statement.exportClause.elements.forEach(item=>exported.add(
                item.propertyName?.text??item.name.text));
    }
    if([...exported].some(name=>mutable.has(name)))
        throw new CliError(`primary host bundle cannot freeze a mutable aliased ESM export: ${id}`,4);
    let reassigned:string|null=null;
    const visit=(node:ts49.Node):void=>{
        if(ts49.isBinaryExpression(node)&&ts49.isIdentifier(node.left)&&exported.has(node.left.text)
            &&node.operatorToken.kind>=ts49.SyntaxKind.FirstAssignment&&node.operatorToken.kind<=ts49.SyntaxKind.LastAssignment)
            reassigned=node.left.text;
        if((ts49.isPrefixUnaryExpression(node)||ts49.isPostfixUnaryExpression(node))&&ts49.isIdentifier(node.operand)
            &&exported.has(node.operand.text)&&(node.operator===ts49.SyntaxKind.PlusPlusToken||node.operator===ts49.SyntaxKind.MinusMinusToken))
            reassigned=node.operand.text;
        ts49.forEachChild(node,visit);
    };visit(parsed);
    if(reassigned)throw new CliError(`primary host bundle cannot freeze reassigned ESM export ${reassigned}: ${id}`,4);
}

function commonJsFactory(id:string,source:string):Readonly<{id:string;body:string;identity:SecondaryArtifactIdentity;requests:readonly string[]}> {
    assertNoCommonJsShadowing(id,source);
    assertFrozenNamespaceCompatible(id,source);
    const output=ts49.transpileModule(source,{fileName:id,reportDiagnostics:true,compilerOptions:{target:ts49.ScriptTarget.ES5,
        module:ts49.ModuleKind.CommonJS,importsNotUsedAsValues:ts49.ImportsNotUsedAsValues.Remove,downlevelIteration:true}});
    if((output.diagnostics||[]).some(item=>item.category===ts49.DiagnosticCategory.Error))
        throw new CliError(`primary host bundle factory transpilation failed: ${id}`,4);
    const parsed=ts49.createSourceFile(id,output.outputText,ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.JS);
    if((parsed as any).parseDiagnostics.length)throw new CliError(`primary host bundle factory did not parse: ${id}`,4);
    const requests:string[]=[];
    const transformed=ts49.transform(parsed,[context=>root=>{
        const visit=(node:ts49.Node):ts49.VisitResult<ts49.Node>=>{
            if(ts49.isPropertyAccessExpression(node)&&isForbiddenIdentifier(node.name.text)) {
                if(ts49.isIdentifier(node.expression)&&node.expression.text==="module"&&node.name.text==="exports")
                    return ts49.factory.createPropertyAccessExpression(ts49.factory.createIdentifier("__as3LocalModule"),"value");
                return ts49.factory.createElementAccessExpression(ts49.visitNode(node.expression,visit) as ts49.Expression,
                    ts49.factory.createStringLiteral(node.name.text));
            }
            if(ts49.isPropertyAssignment(node)&&ts49.isIdentifier(node.name)&&isForbiddenIdentifier(node.name.text))
                return ts49.factory.updatePropertyAssignment(node,ts49.factory.createStringLiteral(node.name.text),
                    ts49.visitNode(node.initializer,visit) as ts49.Expression);
            if(ts49.isBindingElement(node)&&node.propertyName&&ts49.isIdentifier(node.propertyName)
                &&isForbiddenIdentifier(node.propertyName.text))
                return ts49.factory.updateBindingElement(node,node.dotDotDotToken,ts49.factory.createStringLiteral(node.propertyName.text),
                    ts49.visitNode(node.name,visit) as ts49.BindingName,
                    node.initializer?ts49.visitNode(node.initializer,visit) as ts49.Expression:undefined);
            if(ts49.isShorthandPropertyAssignment(node)&&node.name.text==="Function")
                return ts49.factory.createPropertyAssignment(ts49.factory.createStringLiteral("Function"),
                    ts49.factory.createIdentifier("__as3IntrinsicFunction"));
            if(ts49.isCallExpression(node)&&ts49.isIdentifier(node.expression)&&node.expression.text==="require") {
                if(node.arguments.length!==1||!ts49.isStringLiteral(node.arguments[0]!))
                    throw new CliError(`primary host bundle contains dynamic CommonJS resolution: ${id}`,4);
                requests.push(node.arguments[0]!.text);
                return ts49.factory.updateCallExpression(node,ts49.factory.createIdentifier("__as3LocalRequire"),
                    node.typeArguments,node.arguments);
            }
            if(ts49.isCallExpression(node)&&node.expression.kind===ts49.SyntaxKind.ImportKeyword)
                throw new CliError(`primary host bundle contains dynamic import: ${id}`,4);
            if(ts49.isMetaProperty(node)&&node.keywordToken===ts49.SyntaxKind.ImportKeyword)
                throw new CliError(`primary host bundle contains import metadata: ${id}`,4);
            if(ts49.isIdentifier(node)&&node.text==="Function"&&!isPropertyName(node))
                return ts49.factory.createIdentifier("__as3IntrinsicFunction");
            if(ts49.isIdentifier(node)&&node.text==="module"&&!isPropertyName(node))
                return ts49.factory.createIdentifier("__as3LocalModule");
            if(ts49.isIdentifier(node)&&node.text==="exports"&&!isPropertyName(node))
                return ts49.factory.createIdentifier("__as3LocalExports");
            if(ts49.isIdentifier(node)&&node.text==="require")
                throw new CliError(`primary host bundle contains an escaped require identity: ${id}`,4);
            return ts49.visitEachChild(node,visit,context);
        };return ts49.visitNode(root,visit) as ts49.SourceFile;
    }]);
    let body:string;
    try {body=jsonStringLiterals(ts49.createPrinter({newLine:ts49.NewLineKind.LineFeed})
        .printFile(transformed.transformed[0] as ts49.SourceFile).replace(/\r\n?/g,"\n").replace(/\n*$/,"\n"));}
    finally {transformed.dispose();}
    const audited=ts49.createSourceFile(id,body,ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.JS);let ambient:string|null=null;
    const audit=(node:ts49.Node):void=>{
        if(ts49.isIdentifier(node)&&isForbiddenIdentifier(node.text))ambient=node.text;
        if(ts49.isTemplateExpression(node)||ts49.isNoSubstitutionTemplateLiteral(node))ambient="template literal";
        ts49.forEachChild(node,audit);
    };audit(audited);
    if(ambient)throw new CliError(`primary host bundle retained CommonJS ambient ${ambient}: ${id}`,4);
    return Object.freeze({id,body,identity:artifact(id,body),requests:Object.freeze(requests)});
}

function auditBundle(source:string):void {
    const parsed=ts49.createSourceFile("AchievementModule.primary-host-bundle.mjs",source,
        ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.JS);
    if((parsed as any).parseDiagnostics.length)throw new CliError("primary host bundle ESM did not parse",4);
    let exported=0,forbidden:string|null=null;
    for(const statement of parsed.statements) {
        if(ts49.isImportDeclaration(statement)||ts49.isImportEqualsDeclaration(statement)||ts49.isExportDeclaration(statement)
            ||ts49.isExportAssignment(statement))forbidden="module dependency syntax";
        if(ts49.isFunctionDeclaration(statement)&&statement.name?.text===EXPORT_NAME
            &&statement.modifiers?.some(item=>item.kind===ts49.SyntaxKind.ExportKeyword))exported++;
        else if(statement.modifiers?.some(item=>item.kind===ts49.SyntaxKind.ExportKeyword))forbidden="additional export";
    }
    const visit=(node:ts49.Node):void=>{
        if(ts49.isCallExpression(node)&&node.expression.kind===ts49.SyntaxKind.ImportKeyword)forbidden="dynamic import";
        if(ts49.isMetaProperty(node)&&node.keywordToken===ts49.SyntaxKind.ImportKeyword)forbidden="import metadata";
        if(ts49.isIdentifier(node)&&isForbiddenIdentifier(node.text))
            forbidden=`ambient ${node.text}`;
        if(ts49.isTemplateExpression(node)||ts49.isNoSubstitutionTemplateLiteral(node))forbidden="template literal";
        if(ts49.isStringLiteral(node)) {
            const raw=source.slice(node.getStart(parsed),node.end);
            try {if(JSON.parse(raw)!==node.text)forbidden="non-JSON string literal";}catch {forbidden="non-JSON string literal";}
        }
        ts49.forEachChild(node,visit);
    };visit(parsed);
    if(exported!==1||forbidden)throw new CliError(forbidden?`primary host bundle contains ${forbidden}`:
        "primary host bundle does not have its sole factory export",4);
}

/** Bundles the already authenticated ESM candidate graph into one dependency-free synchronous module closure. */
export function emitPrimaryHostBundleCandidate(host:EmittedPrimarySecondaryHostPackage,runtime:EmittedBrowserEsmRuntime,
    provider:CompilerProviderAuthority):EmittedPrimaryHostBundleCandidate {
    const hostFile=host.files.find(file=>file.path==="AchievementModule.primary-host.mjs");
    const hostReceiptFile=host.files.find(file=>file.path==="AchievementModule.primary-host-candidate-receipt.json");
    if(!hostFile||!hostReceiptFile)throw new CliError("primary host bundle lacks its authenticated candidate inputs",6);
    if(!sameArtifact(hostFile.identity,host.module)||!sameArtifact(hostReceiptFile.identity,host.receipt)
        ||!sameArtifact(artifact(hostFile.path,hostFile.body),host.module)
        ||!sameArtifact(artifact(hostReceiptFile.path,hostReceiptFile.body),host.receipt))
        throw new CliError("primary host bundle candidate input identity differs",6);
    for(const file of runtime.files) {
        if(file.path.startsWith("/")||file.path.startsWith("../")||posix.normalize(file.path)!==file.path)
            throw new CliError(`primary host bundle runtime input path is invalid: ${file.path}`,6);
        if(!sameArtifact(file.identity,artifact(file.path,file.body)))
            throw new CliError(`primary host bundle runtime input identity differs: ${file.path}`,6);
        const parsed=ts49.createSourceFile(file.path,file.body,ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.JS),declared:string[]=[];
        for(const statement of parsed.statements) {
            if(ts49.isImportDeclaration(statement)&&ts49.isStringLiteral(statement.moduleSpecifier))declared.push(statement.moduleSpecifier.text);
            if(ts49.isExportDeclaration(statement)&&statement.moduleSpecifier&&ts49.isStringLiteral(statement.moduleSpecifier))
                declared.push(statement.moduleSpecifier.text);
        }
        if(canonicalJson(declared)!==canonicalJson(file.imports.map(item=>item.specifier))
            ||file.imports.some(item=>!exactKeys(item,["specifier","path"])||!item.specifier.startsWith(".")
                ||posix.normalize(posix.join(posix.dirname(file.path),item.specifier))!==item.path))
            throw new CliError(`primary host bundle runtime dependency edge differs: ${file.path}`,6);
    }
    const candidate=validateSourceCandidate(hostReceiptFile.body,host,runtime,provider,hostFile.body);
    const hostId=`achievement-primary-host/${hostFile.path}`;
    const inputs=[Object.freeze({id:hostId,body:hostFile.body}),...runtime.files.map(file=>Object.freeze({
        id:`${runtime.root}/${file.path}`,body:file.body}))];
    if(new Set(inputs.map(input=>input.id)).size!==inputs.length)
        throw new CliError("primary host bundle input closure is duplicated",6);
    const owned=new Set(inputs.map(input=>input.id));
    const factories=inputs.map(input=>commonJsFactory(input.id,input.body));
    for(const factory of factories)for(const requested of factory.requests)if(resolveOwned(factory.id,requested,owned)===null)
        throw new CliError(`primary host bundle has an unowned factory dependency: ${factory.id} -> ${requested}`,6);
    const byId=new Map(factories.map(factory=>[factory.id,factory])),reachable=new Set<string>(),pending=[hostId];
    while(pending.length) {
        const id=pending.shift()!;if(reachable.has(id))continue;
        const factory=byId.get(id);if(!factory)throw new CliError("primary host bundle reachable factory is absent",6);
        reachable.add(id);factory.requests.forEach(requested=>pending.push(resolveOwned(id,requested,owned)!));
    }
    if(reachable.size!==factories.length)throw new CliError("primary host bundle input closure contains unreachable modules",6);
    const cycles=factoryCycles(factories,owned);
    const ordered=factories.sort((left,right)=>compare(left.id,right.id));
    const factoryEvidence=ordered.map(factory=>factory.identity),inputEvidence=inputs.map(input=>artifact(input.id,input.body))
        .sort((left,right)=>compare(left.path,right.path));
    const lines=["const __as3IntrinsicFunction = (() => {}).constructor;","const __as3Factories = Object.freeze({",...ordered.map(factory=>
        `  ${JSON.stringify(factory.id)}: (__as3LocalModule, __as3LocalExports, __as3LocalRequire) => {\n${factory.body.split("\n").map(row=>`    ${row}`).join("\n")}\n  },`),
        "});","const __as3Cache = Object.create(null);",
        "const __as3Load = id => {","  if (__as3Cache[id] !== undefined) return __as3Cache[id].value;",
        "  const factory = __as3Factories[id];","  if (typeof factory !== \"function\") throw new Error(\"primary host embedded module is absent\");",
        "  const record = {value:Object.create(null)};","  __as3Cache[id] = record;",
        "  factory(record, record.value, requested => {",
        "    if (typeof requested !== \"string\" || requested.charAt(0) !== \".\") throw new Error(\"primary host embedded dependency is unowned\");",
        "    const base = id.split(\"/\"); base.pop();",
        "    for (const part of requested.split(\"/\")) { if (part === \"\" || part === \".\") continue; if (part === \"..\") base.pop(); else base.push(part); }",
        "    const candidate = base.join(\"/\");",
        "    for (const target of [candidate, candidate + \".mjs\", candidate + \".js\"]) if (__as3Factories[target] !== undefined) return __as3Load(target);",
        "    throw new Error(\"primary host embedded dependency is absent\");","  });","  Object.freeze(record.value);","  return record.value;","};",
        `const __as3Host = __as3Load(${JSON.stringify(hostId)});`,`const __as3Factory = __as3Host[${JSON.stringify(EXPORT_NAME)}];`,
        "if (typeof __as3Factory !== \"function\") throw new Error(\"primary host embedded factory is absent\");","",
        `export function ${EXPORT_NAME}() { return __as3Factory(); }`,""];
    const moduleBody=jsonStringLiterals(lines.join("\n"));auditBundle(moduleBody);
    const module=artifact("AchievementModule.primary-host-bundle.mjs",moduleBody);
    if(!inputEvidence.some(item=>sameArtifact(item,candidate.primaryRuntime)))
        throw new CliError("primary host candidate receipt does not bind its embedded primary runtime",6);
    const receiptBody=`${canonicalJson({schema:"ap-original-achievement-primary-host-bundle-candidate-receipt@1",status:"held",
        holds:[{code:"AP_ACHIEVEMENT_PRIMARY_HOST_BROWSER_EXECUTION_UNVERIFIED",
            reason:"the exact import-free bundle bytes have not passed an AP-owned browser execution observer"}],
        provider:{repository:provider.repository,commit:provider.commit,packageLockSha256:provider.packageLockSha256},
        primaryAuthority:candidate.primaryAuthority,expectedPlan:candidate.expectedPlan,primaryRuntime:candidate.primaryRuntime,
        bootstrapDefinitions:candidate.bootstrapDefinitions,runtimeModules:candidate.runtimeModules,
        sourceHostCandidate:host.module,sourceHostCandidateReceipt:host.receipt,
        embeddedInputClosure:inputEvidence,embeddedFactoryClosure:factoryEvidence,embeddedFactoryCycles:cycles,
        dependencies:[],exportName:EXPORT_NAME,output:module})}\n`;
    const receipt=artifact("AchievementModule.primary-host-bundle-candidate-receipt.json",receiptBody);
    return Object.freeze({root:"achievement-primary-host-bundle-candidate",module,receipt,files:Object.freeze([
        Object.freeze({path:module.path,body:moduleBody,identity:module}),
        Object.freeze({path:receipt.path,body:receiptBody,identity:receipt}),
    ].sort((left,right)=>compare(left.path,right.path)))});
}

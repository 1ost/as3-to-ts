import {createHash} from "node:crypto";
import {Buffer} from "node:buffer";
import {posix} from "node:path";
import ts49 = require("typescript-4-9");
import {CliError} from "./errors";

interface SecondaryArtifactIdentity {readonly path:string;readonly bytes:number;readonly sha256:string;}

export interface BrowserEsmSource {readonly path:string;readonly code:string;}
export interface BrowserEsmImport {readonly specifier:string;readonly path:string;}
export interface BrowserEsmFile {
    readonly path:string;readonly body:string;readonly identity:SecondaryArtifactIdentity;
    readonly imports:readonly BrowserEsmImport[];
}
export interface EmittedBrowserEsmRuntime {
    readonly root:"achievement-primary-runtime";readonly files:readonly BrowserEsmFile[];
    readonly primaryRuntime:BrowserEsmFile;
    file(path:string):BrowserEsmFile;
}

function sha256(value:string):string{return createHash("sha256").update(value,"utf8").digest("hex");}
function compare(left:string,right:string):number{return Buffer.compare(Buffer.from(left,"utf8"),Buffer.from(right,"utf8"));}
function safeModulePath(path:string):boolean{return /^(?:[A-Za-z0-9_$.-]+\/)*[A-Za-z0-9_$.-]+\.mjs$/.test(path)
    &&path.split("/").every(segment=>segment!=="."&&segment!=="..");}
function relativeSpecifier(from:string,to:string):string {
    const relative=posix.relative(posix.dirname(from),to);return relative.startsWith(".")?relative:`./${relative}`;
}

function transpile(source:BrowserEsmSource,runtimePackage:string,ownedPaths:ReadonlySet<string>):BrowserEsmFile {
    if(!safeModulePath(source.path))throw new CliError("browser ESM source has an unsafe output path",6);
    const result=ts49.transpileModule(source.code,{fileName:source.path.replace(/\.mjs$/,".ts"),reportDiagnostics:true,
        compilerOptions:{target:ts49.ScriptTarget.ES2020,module:ts49.ModuleKind.ES2020,
            importsNotUsedAsValues:ts49.ImportsNotUsedAsValues.Remove}});
    if((result.diagnostics||[]).some(item=>item.category===ts49.DiagnosticCategory.Error))
        throw new CliError(`browser ESM transpilation failed: ${source.path}`,4);
    const parsed=ts49.createSourceFile(source.path,result.outputText,ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.JS);
    if((parsed as any).parseDiagnostics.length)throw new CliError(`browser ESM output did not parse: ${source.path}`,4);
    const imports:BrowserEsmImport[]=[];
    const transformed=ts49.transform(parsed,[context=>root=>{
        const mapped=(raw:string):{specifier:string;path:string}=>{
            let target:string;
            if(raw.startsWith(".")) {
                const base=posix.normalize(posix.join(posix.dirname(source.path),raw));
                target=/\.(?:mjs|js)$/.test(base)?base.replace(/\.js$/,".mjs"):`${base}.mjs`;
            } else if(raw.startsWith(`${runtimePackage}/`))target=`${raw.slice(runtimePackage.length+1)}.mjs`;
            else target=`__unowned__/${raw}`;
            return {specifier:target.startsWith("__unowned__/")?raw:relativeSpecifier(source.path,target),path:target};
        };
        const visit=(node:ts49.Node):ts49.VisitResult<ts49.Node>=>{
            if(ts49.isCallExpression(node)&&node.expression.kind===ts49.SyntaxKind.ImportKeyword)
                throw new CliError(`browser ESM output contains dynamic import: ${source.path}`,4);
            if(ts49.isIdentifier(node)&&["require","module","exports"].includes(node.text)) {
                const propertyName=ts49.isPropertyAssignment(node.parent)&&node.parent.name===node
                    ||ts49.isPropertyAccessExpression(node.parent)&&node.parent.name===node;
                if(!propertyName)throw new CliError(`browser ESM output contains CommonJS: ${source.path}`,4);
            }
            if(ts49.isImportDeclaration(node)&&ts49.isStringLiteral(node.moduleSpecifier)) {
                const {specifier,path}=mapped(node.moduleSpecifier.text);imports.push(Object.freeze({specifier,path}));
                return ts49.factory.updateImportDeclaration(node,node.modifiers,node.importClause,
                    ts49.factory.createStringLiteral(specifier),node.assertClause);
            }
            if(ts49.isExportDeclaration(node)&&node.moduleSpecifier&&ts49.isStringLiteral(node.moduleSpecifier)) {
                const {specifier,path}=mapped(node.moduleSpecifier.text);imports.push(Object.freeze({specifier,path}));
                return ts49.factory.updateExportDeclaration(node,node.modifiers,node.isTypeOnly,node.exportClause,
                    ts49.factory.createStringLiteral(specifier),node.assertClause);
            }
            return ts49.visitEachChild(node,visit,context);
        };return ts49.visitNode(root,visit) as ts49.SourceFile;
    }]);
    let body:string;
    try {body=ts49.createPrinter({newLine:ts49.NewLineKind.LineFeed}).printFile(transformed.transformed[0] as ts49.SourceFile)
        .replace(/\r\n?/g,"\n").replace(/\n*$/,"\n");} finally {transformed.dispose();}
    const reparsed=ts49.createSourceFile(source.path,body,ts49.ScriptTarget.ES2020,true,ts49.ScriptKind.JS);
    if((reparsed as any).parseDiagnostics.length)throw new CliError(`browser ESM printed output did not parse: ${source.path}`,4);
    const identity=Object.freeze({path:source.path,bytes:Buffer.byteLength(body,"utf8"),sha256:sha256(body)});
    return Object.freeze({path:source.path,body,identity,imports:Object.freeze(imports)});
}

/** Emits only the reachable, browser-native ESM primary graph and proves its closed static imports. */
export function emitBrowserEsmRuntime(sources:readonly BrowserEsmSource[],runtimePackage:string,
    roots:readonly string[]):EmittedBrowserEsmRuntime {
    if(!Array.isArray(sources)||!Array.isArray(roots)||typeof runtimePackage!=="string"||runtimePackage==="")
        throw new CliError("browser ESM runtime input is invalid",6);
    const sourceByPath=new Map<string,BrowserEsmSource>();
    for(const source of sources) {
        if(!source||typeof source.code!=="string"||!safeModulePath(source.path)||sourceByPath.has(source.path))
            throw new CliError("browser ESM runtime source inventory is invalid or duplicated",6);
        sourceByPath.set(source.path,Object.freeze({path:source.path,code:source.code}));
    }
    const ownedPaths=new Set(sourceByPath.keys()),compiled=new Map<string,BrowserEsmFile>();
    sourceByPath.forEach(source=>compiled.set(source.path,transpile(source,runtimePackage,ownedPaths)));
    const reachable=new Set<string>(),pending=[...roots];
    while(pending.length) {
        const path=pending.shift()!;
        if(reachable.has(path))continue;
        const file=compiled.get(path);if(!file)throw new CliError(`browser ESM runtime root or dependency is absent: ${path}`,6);
        reachable.add(path);
        for(const imported of file.imports) {
            if(imported.path.startsWith("__unowned__/"))
                throw new CliError(`browser ESM runtime dependency lacks exact compiler-owned bytes: ${imported.specifier}`,6);
            if(!ownedPaths.has(imported.path))throw new CliError(`browser ESM runtime dependency is absent: ${imported.path}`,6);
            if(imported.specifier!==relativeSpecifier(file.path,imported.path))
                throw new CliError("browser ESM runtime import contains an alias path",6);
            pending.push(imported.path);
        }
    }
    const files=[...reachable].sort(compare).map(path=>compiled.get(path)!);
    const primaryRuntime=compiled.get("AS3Authority.generated.mjs");
    if(!primaryRuntime||!reachable.has(primaryRuntime.path))throw new CliError("browser ESM primary authority is not reachable",6);
    const file=(path:string):BrowserEsmFile=>{const value=compiled.get(path);if(!value||!reachable.has(path))
        throw new CliError(`browser ESM requested module is not in the authenticated closure: ${path}`,6);return value;};
    return Object.freeze({root:"achievement-primary-runtime" as const,files:Object.freeze(files),primaryRuntime,file});
}

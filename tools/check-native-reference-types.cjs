// Focused regression against real bridge declarations; not a full Laya engine typecheck.
const ts=require('typescript-4-9');
const path=require('node:path');
const generated=path.resolve(process.argv[2] || '');
if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: node tools/check-native-reference-types.cjs <generated-probe.ts> <LayaAir-root>');
const laya=path.resolve(process.argv[3],'src/layaAir');
const runtime=path.resolve(__dirname,'../src/hardened-runtime');
const roots=[generated,...['flash/display/Shape.ts','flash/display/Sprite.ts','flash/display/MovieClip.ts','flash/display/DisplayObject.ts','flash/display/DisplayObjectContainer.ts','flash/display/InteractiveObject.ts','flash/events/EventDispatcher.ts','flash/events/EventDispatcherCore.ts'].map(p=>path.join(laya,p)),...['AS3Type.ts','AS3Coerce.ts','internal/AS3TypeRegistry.ts'].map(p=>path.join(runtime,p))];
// Bound resolution to the real declarations needed by this regression. This
// diagnoses the generated probe, not unrelated engine dependency diagnostics.
const program=ts.createProgram(roots,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,strict:true,skipLibCheck:true,noEmit:true,noResolve:true,baseUrl:'/',paths:{'laya/*':[laya+'/*'],'@laya/as3-runtime/*':[runtime+'/*']}});
const source=program.getSourceFile(generated);
if (!source) throw new Error("Generated probe was not loaded");
const result=program.getSemanticDiagnostics(source);
process.stdout.write(ts.formatDiagnosticsWithColorAndContext(result,{getCanonicalFileName:p=>p,getCurrentDirectory:()=>process.cwd(),getNewLine:()=> '\n'}));
process.stdout.write(JSON.stringify(result.map(d=>({code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')})))+'\n');
process.exitCode=result.length?1:0;

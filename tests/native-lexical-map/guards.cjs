const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('crypto'),cp=require('child_process');
const compiler=path.resolve(__dirname,'../..'),parse=require(path.join(compiler,'lib/parse')),emit=require(path.join(compiler,'lib/emit'));
const read=p=>fs.readFileSync(p,'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
cp.execFileSync(process.env.PYTHON||'python',[path.join(__dirname,'verify-evidence.py')],{encoding:'utf8',windowsHide:true});
const evidence=path.join(__dirname,'capture-a'),metadata=JSON.parse(cp.execFileSync(process.env.PYTHON||'python',[path.join(__dirname,'extract-metadata.py'),evidence],{encoding:'utf8',windowsHide:true}));
const sources=Object.fromEntries(['Left','Right'].map(n=>['probe.'+n,read(path.join(evidence,'sources/original/probe/'+n+'.as'))]));
const base={customVisitors:[],definitionsByNamespace:{probe:['Left','Right']},nativeClassInitialization:{classes:{'probe.Left':'lazy','probe.Right':'lazy'}},nativeCallableClasses:sources,nativeCallableMetadata:{module:'./AS3MethodBinding',classes:metadata.classes},nativeCallableMethodBindingModule:'./AS3MethodBinding',nativeCallableCoercionModule:'./AS3MethodBinding',nativeCallableStringModule:'./AS3String',nativeArrayCreationModule:'./AS3ArrayCreation',nativeLexicalMembersModule:'./AS3LexicalMembers'};
const clone=x=>JSON.parse(JSON.stringify(x));
const run=(o,name='Left')=>emit(parse(name+'.as',o.nativeCallableClasses['probe.'+name]),o.nativeCallableClasses['probe.'+name],o);
const output=run(clone(base)),report=[];
function negative(id,change,expected){const options=clone(base);change(options);const before=JSON.stringify(options);let error;try{run(options);}catch(e){error=String(e);}assert(error,id+' accepted');assert.match(error,expected,id);assert.equal(JSON.stringify(options),before,id+' mutated inputs');assert.equal(run(clone(base)),output,id+' poisoned subsequent emission');report.push({id,status:'held',error});}
// Mutated complete sources below are compiler rejection controls, not original runtime evidence.
function sourceChange(o,from,to){o.nativeCallableClasses['probe.Right']=o.nativeCallableClasses['probe.Right'].replace(from,to);o.nativeCallableMetadata.classes['probe.Right'].sourceSha256=sha(o.nativeCallableClasses['probe.Right']);}
negative('sibling-source-bytes',o=>{o.nativeCallableClasses['probe.Right']+='\n';},/exact authenticated source bytes.*source-map declaration: probe.Right/);
negative('sibling-record-missing',o=>{delete o.nativeCallableMetadata.classes['probe.Right'];},/exact authenticated source bytes.*source-map declaration: probe.Right/);
negative('sibling-map-identity',o=>{o.nativeCallableClasses['probe.Right']=sources['probe.Left'];},/source declaration identity.*source-map declaration: probe.Right|exact source bytes.*source-map declaration: probe.Right/);
negative('sibling-metadata-identity',o=>{o.nativeCallableMetadata.classes['probe.Right'].metadata.name='probe::Left';},/source declaration identity.*source-map declaration: probe.Right/);
negative('sibling-source-hash-swap',o=>{o.nativeCallableMetadata.classes['probe.Right'].sourceSha256=metadata.classes['probe.Left'].sourceSha256;},/exact authenticated source bytes.*source-map declaration: probe.Right/);
negative('sibling-entire-record-swap',o=>{o.nativeCallableMetadata.classes['probe.Right']=o.nativeCallableMetadata.classes['probe.Left'];},/exact authenticated source bytes.*source-map declaration: probe.Right/);
negative('sibling-public-surface-missing',o=>{o.nativeCallableMetadata.classes['probe.Right'].metadata.instance.methods.pop();},/complete source member surface.*source-map declaration: probe.Right/);
negative('sibling-storage-traits-missing',o=>{o.nativeCallableMetadata.classes['probe.Right'].staticTraits.pop();},/source storage\/types.*source-map declaration: probe.Right/);
negative('sibling-base-metadata',o=>{o.nativeCallableMetadata.classes['probe.Right'].metadata.base='probe::Left';},/ancestry.*source-map declaration: probe.Right/);
negative('sibling-class-flags',o=>{o.nativeCallableMetadata.classes['probe.Right'].metadata.isFinal=true;},/source class flags.*source-map declaration: probe.Right/);
negative('sibling-no-lazy-authority',o=>{delete o.nativeClassInitialization.classes['probe.Right'];},/unresolved class-value identity: Right|source identity must be lazy: probe.Right/);
negative('no-lexical-module',o=>{delete o.nativeLexicalMembersModule;},/nonpublic source members require lexical namespace dispatch/);
negative('sibling-derived',o=>sourceChange(o,'class Right {','class Right extends Left {'),/Object-root.*source-map declaration: probe.Right/);
negative('sibling-interface',o=>sourceChange(o,'class Right {','class Right implements IRight {'),/Object-root.*source-map declaration: probe.Right/);
negative('sibling-typed-return',o=>sourceChange(o,'function read():*','function read():Array'),/typed and void method returns.*source-map declaration: probe.Right/);
negative('sibling-typed-parameter',o=>sourceChange(o,'function write(arg:*)','function write(arg:String)'),/typed method parameter.*source-map declaration: probe.Right/);
negative('sibling-optional-parameter',o=>sourceChange(o,'function write(arg:*)','function write(arg:*=null)'),/optional method defaults.*source-map declaration: probe.Right/);
negative('sibling-accessor',o=>sourceChange(o,'function protectedRead():*','function get protectedRead():*'),/accessor entry.*source-map declaration: probe.Right/);
negative('sibling-foreign-private-slot',o=>sourceChange(o,'private var secret:*','private var secret:Left'),/lexical foreign reference.*source-map declaration: probe.Right/);
negative('sibling-lexical-const',o=>sourceChange(o,'private var secret:*','private const secret:*'),/lexical const.*source-map declaration: probe.Right/);
negative('sibling-nested-function',o=>sourceChange(o,'return [secret,value,Right.token,Right.marker];','var f:*=function():*{return 1;};return f;'),/anonymous\/nested function.*source-map declaration: probe.Right/);
negative('sibling-typed-local-optout',o=>sourceChange(o,'return value;','var n:int=1;return n;'),/typed local.*source-map declaration: probe.Right/);
negative('sibling-declaration-order',o=>sourceChange(o,'return value;','return secret;var secret:*=1;'),/declaration-order.*source-map declaration: probe.Right/);
negative('sibling-foreign-typed-local-optin',o=>{sourceChange(o,'return value;','var n:Left=null;return n;');o.nativeTypedLocals=true;o.nativeTypedLocalAdditionModule='./AS3Addition';},/foreign local reference.*source-map declaration: probe.Right/);
// Per-class metadata planning never substitutes for emission of every complete class.
const operation=clone(base);sourceChange(operation,'return value;','delete secret;return value;');
run(operation);let operationError;try{run(operation,'Right');}catch(e){operationError=String(e);}assert.match(operationError,/AS3_LEXICAL_COMPILER_UNSUPPORTED/);report.push({id:'sibling-operation-requires-own-emission',status:'held-at-own-emission',error:operationError});
const cache=path.join(compiler,'.cache/native-lexical-map');fs.mkdirSync(cache,{recursive:true});const dir=fs.mkdtempSync(path.join(cache,'guards-'));fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({sourceMapSize:2,guards:report,originalRowsUnmodified:true},null,2));console.log(JSON.stringify({dir,guards:report.length}));

import hashlib,json,os,shutil,subprocess,tempfile,sys
from pathlib import Path
HERE=Path(__file__).resolve().parent
SOURCE=HERE.parents[1]
OUTPUT=Path(sys.argv[1]).resolve()
OUTPUT.mkdir(parents=True,exist_ok=True)
PACKAGE=Path(tempfile.mkdtemp(prefix='callable-production-install-'))
for name in ['package.json','package-lock.json']:shutil.copyfile(SOURCE/name,PACKAGE/name)
shutil.copytree(SOURCE/'lib',PACKAGE/'lib')
package=json.loads((PACKAGE/'package.json').read_text())
lock=json.loads((PACKAGE/'package-lock.json').read_text())
assert package['dependencies']['typescript']=='2.5.2'
assert 'typescript' not in package['devDependencies']
assert lock['dependencies']['typescript']['version']=='2.5.2' and not lock['dependencies']['typescript'].get('dev')
(PACKAGE/'probe.cjs').write_text('''
const assert=require('assert'),fs=require('fs'),path=require('path');
const ts=require('typescript'),parse=require('./lib/parse'),emit=require('./lib/emit');
assert.equal(ts.version,'2.5.2');
assert(require.resolve('typescript').startsWith(path.join(__dirname,'node_modules')));
assert(!fs.existsSync(path.join(__dirname,'node_modules/diff')));
const source='package p {public class C {public var n:int=1; public function C(){}}}';
const output=emit(parse('C.as',source),source,{customVisitors:[],definitionsByNamespace:{},
 nativeClassInitialization:{classes:{'p.C':'lazy'}},nativeCallableMethodBindingModule:"./AS3MethodBinding",nativeCallableClasses:{'p.C':source}});
assert(output.includes('function C('));assert(output.includes('.enter(this,'));
for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
 const result=ts.transpileModule(output,{compilerOptions:{target,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
 assert.deepEqual(result.diagnostics,[]);
}
console.log(JSON.stringify({typescript:ts.version,productionOnly:true,optionalPassInvoked:true,bothTargets:true}));
''',encoding='utf-8')
commands=[[('npm.cmd' if os.name=='nt' else 'npm'),'ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund'],['node','probe.cjs']]
environment=dict(os.environ);environment.pop('NODE_PATH',None)
results=[]
for command in commands:
 result=subprocess.run(command,cwd=PACKAGE,env=environment,capture_output=True,text=True,encoding='utf-8',timeout=120)
 results.append({'command':command,'cwd':str(PACKAGE),'exitCode':result.returncode,'stdout':result.stdout,'stderr':result.stderr})
 (OUTPUT/'production-install.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
 print(result.stdout)
 assert result.returncode==0,result.stderr
for name in ['package.json','package-lock.json']:
 assert (PACKAGE/name).read_bytes()==(SOURCE/name).read_bytes(),name+' was unexpectedly changed'
print('Fresh production-only install executes the optional pass with exact TypeScript 2.5.2')

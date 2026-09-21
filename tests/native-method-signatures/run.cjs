'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const {NativeMethodSignatures}=require('../../lib/emit/native-method-signatures');
const parse=require('../../lib/parse'),K=require('../../lib/syntax/nodeKind').default;
const root=__dirname,sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),json=p=>JSON.parse(read(p));
let checks=0;const check=(actual,expected)=>{assert.deepStrictEqual(actual,expected);checks++;};
const reject=(fn,message)=>{assert.throws(fn,message||/AS3_METHOD_SIGNATURE_UNSUPPORTED/);checks++;};
for(const file of json('files.json'))check(sha(fs.readFileSync(path.join(root,file.path))),file.sha256);
const groups=[['entry-return33',33],['storage8',8],['plain12',12],['arity9',9],['prior-entry43',43],['prior-return22',22],['extra7',7]];
const canonicalXML=text=>{
 const parser=require('sax').parser(true),stack=[];let value;
 parser.onopentag=tag=>{const n=[tag.name,Object.entries(tag.attributes).sort(),[]];if(stack.length)stack[stack.length-1][2].push(n);else value=n;stack.push(n);};
 parser.onclosetag=()=>stack.pop();parser.write(text).close();
 const sort=n=>[n[0],n[1],n[2].map(sort).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))];return sort(value);
};
for(const [group,count]of groups){
 const names=group==='prior-return22'?['flash-final-a','flash-final-b']:['flash-a','flash-b'];
 const captures=names.map(name=>{
  const base=`fixtures/${group}/${name}`,receipt=json(base+'/provenance.json');
  for(const file of receipt.files){let p=path.join(root,base,file.path);if(!fs.existsSync(p))p=path.join(root,base,'sources',file.path);check(sha(fs.readFileSync(p)),file.sha256);}
  return json(base+'/flash.json');
 });
 check(captures[0].rows.length,count);check(captures[1].rows,captures[0].rows);
 for(const key of ['reflection','instances'])if(captures[0][key])check(captures[0][key].map(canonicalXML),captures[1][key].map(canonicalXML));
}
function fixture(group,name,index=0){
 const base=`fixtures/${group}/flash-a`,capture=json(base+'/flash.json');
 return {qname:'probe.'+name,source:read(base+'/sources/original/probe/'+name+'.as'),classXML:capture.reflection[index],instanceXML:capture.instances[index]};
}
function evidence(f){return{sourceSha256:sha(f.source),classXML:f.classXML,classXMLSha256:sha(f.classXML),instanceXML:f.instanceXML,instanceXMLSha256:sha(f.instanceXML)};}
const plan=f=>new NativeMethodSignatures(f.qname,f.source,evidence(f));
const entry=fixture('entry-return33','EntrySubject'),storage=fixture('storage8','ParameterStorage'),plain=fixture('plain12','PlainSubject'),extra=fixture('extra7','PlanSubject');
const compact=m=>[m.name,m.visibility,m.isStatic,m.minimumArguments,m.maximumArguments,m.formalLength,m.parameters.map(p=>p.type),m.parameters.map(p=>p.defaultLiteral?p.defaultLiteral.text:null),m.returnType,m.returns.length,m.throws.length];
const expectations=[
 [entry,[['publicEntry','public',false,1,3,3,['Number','Boolean','Number'],[null,'true','5'],'*',1,0],['protectedEntry','protected',false,1,2,2,['Number','Boolean'],[null,'false'],'*',1,0],['privateEntry','private',false,1,2,2,['Number','Boolean'],[null,'true'],'*',1,0],['pick','public',false,1,1,1,['*'],[null],'*',3,0]]],
 [storage,[['numberWrite','public',false,2,2,2,['Number','*'],[null,null],'*',1,0],['booleanWrite','public',false,2,2,2,['Boolean','*'],[null,null],'*',1,0],['compound','public',false,2,2,2,['Number','*'],[null,null],'*',1,0],['increment','public',false,1,1,1,['Number'],[null],'*',1,0],['retain','public',false,2,2,2,['Number','*'],[null,null],'*',1,0]]],
 [plain,[['renderTime','public',false,1,3,3,['Number','Boolean','Boolean'],[null,'false','false'],'void',0,0],['easeOut','protected',false,4,4,4,['Number','Number','Number','Number'],[null,null,null,null],'Number',1,0],['setEnabled','public',false,1,2,2,['Boolean','Boolean'],[null,'false'],'Boolean',1,0],['finish','private',false,1,1,1,['*'],[null],'void',1,0],['numberReturn','public',false,1,1,1,['*'],[null],'Number',1,0],['pick','public',false,1,1,1,['*'],[null],'*',2,0]]],
 [extra,[['fail','public',false,1,1,1,['*'],[null],'Number',0,1],['defaults','public',false,0,5,5,['*','*','*','*','*'],['0','true','null','undefined',"'text'"],'*',1,0],['negative','public',false,0,2,2,['Number','Boolean'],['-0','false'],'*',1,0],['number','public',false,1,1,1,['*'],[null],'Number',1,0]]]
];
const nodes=tree=>{const out=[];function walk(n){if(!n)return;out.push(n);n.children.forEach(walk);}walk(tree);return out;};
for(const [f,expected]of expectations){
 const p=plan(f),all=nodes(parse(f.qname+'.as',f.source));check(p.methods.map(compact),expected);check(Object.isFrozen(p.methods),true);
 for(const m of p.methods){
  const node=all.find(n=>n.kind===K.FUNCTION&&n.start===m.start);check(p.forMethod(node),m);check(Object.isFrozen(m),true);check(Object.isFrozen(m.parameters),true);
  check(f.source.slice(m.body.start,m.body.start+1),'{');
  for(const param of m.parameters){check(Object.isFrozen(param),true);check(f.source.slice(param.start,param.end).startsWith(param.name),true);if(param.defaultLiteral){check(Object.isFrozen(param.defaultLiteral),true);check(f.source.slice(param.defaultLiteral.start,param.defaultLiteral.end),param.defaultLiteral.text);}}
  for(const ret of m.returns){const n=all.find(n=>n.kind===K.RETURN&&n.start===ret.start);check(p.forReturn(node,n),ret);check(/^return\b/.test(f.source.slice(ret.start)),true);check(Object.isFrozen(ret),true);if(ret.expression)check(Object.isFrozen(ret.expression),true);}
  for(const thrown of m.throws){const n=all.find(n=>n.kind===K.RETURN&&n.start===thrown.start);check(/^throw\b/.test(f.source.slice(thrown.start)),true);reject(()=>p.forReturn(node,n),/unowned original return/);}
  const wrong=Object.assign({},node,{end:node.end+1});reject(()=>p.forMethod(wrong),/unowned or changed original method/);
  const ctor=all.find(n=>n.kind===K.FUNCTION&&n.children.some(c=>c&&c.kind===K.NAME&&c.text===f.qname.split('.').pop()));if(ctor)reject(()=>p.forMethod(ctor),/unowned or changed original method/);
 }
}
check(plan(extra).methods[1].parameters.map(p=>p.defaultLiteral.kind),['number','boolean','null','undefined','string']);
const negativeParameter=plan(extra).methods[2].parameters[0];
check(extra.source.slice(negativeParameter.start,negativeParameter.end),'n:Number=-0');
for(const [f]of expectations)for(const m of plan(f).methods)for(const p of m.parameters)if(p.defaultLiteral)check(p.start<=p.defaultLiteral.start&&p.end>=p.defaultLiteral.end,true);
reject(()=>plan(fixture('entry-return33','ReturnSubject',1)),/typed exception-return regions held/);
reject(()=>plan(fixture('entry-return33','OverrideChild',3)),/Object-root declaration required/);
reject(()=>new NativeMethodSignatures(entry.qname,entry.source+' ',evidence(entry)),/digests required/);
reject(()=>new NativeMethodSignatures(entry.qname,entry.source,{...evidence(entry),instanceXML:undefined}),/digests required/);
reject(()=>new NativeMethodSignatures('probe.Counterfeit',entry.source,evidence(entry)),/source declaration identity/);
function mutateSource(f,from,to,expected){assert(f.source.includes(from));reject(()=>plan({...f,source:f.source.replace(from,to)}),expected);}
mutateSource(entry,'a:Number','a:probe.Number',/unsupported method parameter type/);
mutateSource(entry,'a:Number','a:String',/unsupported method parameter type/);
mutateSource(entry,'b:Boolean=true','b:Boolean=1',/default literal\/type mismatch/);
mutateSource(entry,'c:Number=5','c:Number=unknown()',/optional source literal held/);
mutateSource(entry,'c:Number=5','c:Number',/required parameter after default/);
mutateSource(entry,'c:Number=5','a:Number=5',/duplicate method parameter/);
mutateSource(entry,"journal.push('public:'+tag)","journal.push(arguments)",/source arguments held/);
mutateSource(entry,"journal.push('public:'+tag)","function nested():* {return 1;}",/nested source functions held/);
mutateSource(entry,'public function pick','public override function pick',/member namespace or override held/);
mutateSource(entry,'public function pick(n:*):*','public function get pick():*',/accessors held/);
mutateSource(entry,'public function pick(n:*):*','public function pick(...n):*',/rest method parameters held/);
mutateSource(plain,'return value;','try{return value;}finally{}',/typed exception-return regions held/);
mutateSource(plain,"journal.push('number');return value;","journal.push('number');",/typed fallthrough completion held/);
mutateSource(plain,"if(value)return;","if(value)return value;",/return value\/type mismatch/);
mutateSource(entry,'public class EntrySubject','public class EntrySubject extends Object',/Object-root declaration required/);
for(const [from,to]of [['type="Number"','type="Boolean"'],['optional="true"','optional="false"'],['index="1"','index="2"'],['returnType="*"','returnType="Number"'],['name="tag"','name="other"']]){
 const f={...entry,classXML:entry.classXML.replace(from,to),instanceXML:entry.instanceXML.replace(from,to)};reject(()=>plan(f));
}
reject(()=>plan({...entry,classXML:entry.classXML.replace('</factory>','<method name="phantom" declaredBy="probe::EntrySubject" returnType="*"/></factory>')}),/factory\/instance disagreement/);
reject(()=>plan({...entry,classXML:entry.classXML.replace('isFinal="true"','isFinal="false"')}),/reflection attributes/);
reject(()=>plan({...entry,classXML:'<!DOCTYPE type>'+entry.classXML}),/DTD held/);
reject(()=>plan({...entry,classXML:entry.classXML.slice(0,-7)}),/invalid reflection XML/);
console.log(JSON.stringify({status:'pass',checks,originalRowsRetained:134,repeatedCaptureGroups:7,completePlannedClasses:4,completeHeldClasses:['ReturnSubject','OverrideChild'],runtimeAdmission:false},null,2));

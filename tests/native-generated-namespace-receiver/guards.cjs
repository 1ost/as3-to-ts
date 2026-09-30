const assert=require('node:assert/strict'),parse=require('../../lib/parse'),K=require('../../lib/syntax/nodeKind').default,{NativeNamespaces}=require('../../lib/emit/native-namespaces');
function parsed(source){const root=parse('Probe.as',source);function normalize(n){n.children=n.children.filter(Boolean);for(const c of n.children){c.parent=n;normalize(c);}}normalize(root);return root;}
module.exports=()=>{
 let guards=0;
 for(const base of ['EventDispatcher','MissingBase']){
  const source='package {import flash.events.EventDispatcher;public namespace slot="urn:test:receiver";public class Target {slot var value:int=1;}public class Probe extends '+base+' {public function make():Target{return null;}public function read():int{return this.make().slot::value;}}}';
  const root=parsed(source),namespaces=new NativeNamespaces(root,source);let access;
  function walk(n){if(!n)return;if(n.kind===K.NAMESPACE_ACCESS)access=n;n.children.forEach(walk);}walk(root);
  assert.ok(access);assert.throws(()=>namespaces.receiverType(access),/AS3_NAMESPACE_UNSUPPORTED: namespace inheritance requires a proven same-file ordinary base/);guards++;
 }
 for(const qualifier of ['slot','other']){
  const source='package {import flash.events.EventDispatcher;public namespace '+qualifier+'="urn:test:receiver";public class Probe extends EventDispatcher {'+qualifier+' var value:int=1;}}';
  assert.throws(()=>new NativeNamespaces(parsed(source),source),/AS3_NAMESPACE_UNSUPPORTED: namespace inheritance requires a proven same-file ordinary base/);guards++;
 }
 return guards;
};

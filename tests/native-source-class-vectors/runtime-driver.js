const nc=load('nativeClass'),klass=name=>nc.readNativeClass(load(name)[name]);
const rows=[],Trace=klass('Trace');rows.push({id:'initial',value:Trace.events.concat()});
const Consumer=klass('Consumer'),c=new Consumer();rows.push({id:'consumer',value:[c.slot===null,Trace.events.concat()]});
rows.push({id:'null-before',value:[c.accept(null)===null,Trace.events.concat()]});
try{c.accept({});rows.push({id:'invalid-before',value:'accepted'});}catch(e){if(!api.as3IsSourceErrorInstance(e))throw e;rows.push({id:'invalid-before',value:[e.name,e.errorID,Trace.events.concat()]});}
const base=c.make();rows.push({id:'make-base',value:[base.length,Trace.events.concat()]});
const derived=c.makeChild();rows.push({id:'make-child',value:[derived.length,Trace.events.concat()]});
const Item=klass('Item'),Child=klass('Child'),Other=klass('Other'),item=new Item(7),child=new Child(8),other=new Other(9);base.push(item);derived.push(child);
rows.push({id:'instances',value:Trace.events.concat()});
const objects=api.as3VectorFromValues(api.as3VectorPrimitiveSpec('Object'),[item]),inputs=[base,derived,null,undefined,objects,[item],{}];
for(let i=0;i<inputs.length;i++){
 const input=inputs[i];c.assign(base);
 try{const result=c.assign(input);rows.push({id:'assign:'+i,value:['ok',result===input,result===undefined,c.slot===input,c.slot===null]});}
 catch(e){if(!api.as3IsSourceErrorInstance(e))throw e;rows.push({id:'assign:'+i,value:[e.name,e.errorID,c.slot===base]});}
 try{const result=c.acceptInterface(input);rows.push({id:'interface:'+i,value:['ok',result===input,result===null]});}
 catch(e){if(!api.as3IsSourceErrorInstance(e))throw e;rows.push({id:'interface:'+i,value:[e.name,e.errorID]});}
 try{const result=c.accept(input);rows.push({id:'accept:'+i,value:['ok',result===input,result===null]});}
 catch(e){if(!api.as3IsSourceErrorInstance(e))throw e;rows.push({id:'accept:'+i,value:[e.name,e.errorID]});}
}
const items=[item,child,null,undefined,other,{},7];
for(const method of ['push','write'])for(let kind=0;kind<2;kind++)for(let i=0;i<items.length;i++){
 const vector=kind===0?c.make():c.makeChild();vector.push(kind===0?item:child);const input=items[i];
 try{const result=c[method](vector,input);rows.push({id:method+':'+kind+':'+i,value:['ok',method==='push'?result:result===input,vector.length,vector[method==='push'?1:0]===input,vector[method==='push'?1:0]===null]});}
 catch(e){if(!api.as3IsSourceErrorInstance(e))throw e;rows.push({id:method+':'+kind+':'+i,value:[e.name,e.errorID,vector.length,vector[0]===(kind===0?item:child)]});}
}
// Provider identity guards are separate from the AIR observations.
const spec=api.as3VectorClassSpec('vectorclasses::Item',Item);
if(api.as3VectorConvert(spec,base)!==base)throw Error('Class and declaration specs diverged');
const foreign=api.as3VectorDeclarationSpec(api.declareAS3ReferenceType('vectorclasses::Item').type);
for(const action of [()=>api.as3CoerceVector(base,foreign),()=>api.as3VectorDeclarationSpec({name:'vectorclasses::Item'}),()=>base.push(Object.create(Item.prototype))]){
 let failed=false;try{action();}catch(e){failed=true;}if(!failed)throw Error('forged identity accepted');
}
let traps=0;const hostile=new Proxy({}, {get(){traps++;throw Error('get');},getPrototypeOf(){traps++;throw Error('prototype');}});
let failed=false;try{base.push(hostile);}catch(e){failed=api.as3IsSourceErrorInstance(e);}if(!failed||traps!==0)throw Error('host trap inspected');
// A closed canonical provider retains interface ancestry even if its registration
// predates declaration publication. No source methods are replaced by this guard.
const contract=api.defineAS3Interface('guard::Canonical'),entries=new WeakSet();
class Canonical {constructor(){entries.add(this);}}
const token=api.publishCanonicalAS3Declaration(Canonical,'guard::Canonical',null,Object,value=>entries.has(value),[contract]);
const nativeSpec=api.as3VectorDeclarationSpec(token),empty=api.as3VectorCreate(nativeSpec);
if(!api.as3VectorIs(empty,api.as3VectorInterfaceSpec(contract)))throw Error('canonical interface ancestry lost');
globalThis.result=rows;

const nc=load('nativeClass'),klass=name=>nc.readNativeClass(load(name)[name]),domain=load('declarationDomain');
const ProtectedVectorSlot=klass('ProtectedVectorSlot'),ChildVectorSlot=klass('ChildVectorSlot'),ProbeOrder=klass('ProbeOrder');
const item=new ProbeOrder(7),IOrder=domain[declarationInterfaces.find(i=>i.qname==='org.emvc.interfaces.IOrder').tokenExport];
const good=api.as3VectorFromValues(api.as3VectorInterfaceSpec(IOrder),[item]),objects=api.as3VectorFromValues(api.as3VectorPrimitiveSpec('Object'),[item]),concrete=api.as3VectorFromValues(api.as3VectorClassSpec('vectorcases::ProbeOrder',ProbeOrder),[item]);
const rows=[],inputs=[good,null,undefined,objects,concrete,[item],{}];
let base=new ProtectedVectorSlot(),child=new ChildVectorSlot(),other=new ChildVectorSlot();
rows.push({id:'defaults',value:[base.read()===null,child.read()===null,child.childRead()===null,base.initial().length,child.initial().length,base.initial()!==child.initial(),child.initial()!==other.initial()]});
for(const method of ['assign','childAssign'])for(let i=0;i<inputs.length;i++){
 child=new ChildVectorSlot();child.assign(good);const input=inputs[i];
 try{const result=child[method](input);rows.push({id:method+':'+i,value:['ok',result===input,result===undefined,child.read()===input,child.read()===null,child.childRead()===child.read()]});}
 catch(error){if(!api.as3IsSourceErrorInstance(error))throw error;rows.push({id:method+':'+i,value:[error.name,error.errorID,api.sourceErrorParent(error)===api.getAS3SourceErrorPrototype('TypeError'),child.read()===good,child.childRead()===good]});}
}
child=new ChildVectorSlot();other=new ChildVectorSlot();const original=child.initial();
child.append(item);rows.push({id:'append',value:[child.initial()===original,child.initial().length,child.initial()[0]===item,other.initial().length]});
child.reset();rows.push({id:'reset',value:[child.initial()!==original,child.initial().length,original.length,other.initial().length]});
child.childAssign(good);rows.push({id:'shared-write',value:[child.read()===good,child.childRead()===good]});
child.assign(undefined);rows.push({id:'shared-clear',value:[child.read()===null,child.childRead()===null]});
globalThis.result=rows;

// Separate observer; all nine retained AS3 subjects are emitted without changes.
const nc=load('nativeClass'),domain=load('declarationDomain'),tokens=@TOKENS@;
const klass=name=>nc.readNativeClass(load(name)[name]);
const ProbeOrder=klass('ProbeOrder'),VectorBoundary=klass('VectorBoundary');
klass('DerivedOrder');klass('OtherOrder');
const IOrder=domain[tokens['org.emvc.interfaces.IOrder']],IVectorBoundary=domain[tokens['vectorcases.IVectorBoundary']];
const item=new ProbeOrder(7),spec=api.as3VectorInterfaceSpec(IOrder);
const good=api.as3VectorFromValues(spec,[item]);
const objects=api.as3VectorFromValues(api.as3VectorPrimitiveSpec('Object'),[item]);
const concrete=api.as3VectorFromValues(api.as3VectorClassSpec('vectorcases::ProbeOrder',ProbeOrder),[item]);
const cases=[['interface',good],['null',null],['undefined',undefined],['object-vector',objects],['concrete-vector',concrete],['array',[item]],['object',{}]];
const rows=[],row=(id,value)=>rows.push({id,value});
let subject=new VectorBoundary();
row('default',[subject.queue===null,subject.raw===undefined,subject.entries,api.as3Is(subject,IVectorBoundary),good[0]===item]);
function valueInfo(value,input){return [value===input,value===good,value===null,value===undefined,value==null?'':api.getQualifiedClassName(value)];}
for(const [id,input] of cases)for(const method of ['read','exchange','assign','local']){
 subject=new VectorBoundary();subject.queue=good;subject.raw=input;
 const call=subject[method];let result;
 try{const value=method==='read'?call():call(input);result={ok:true,value:valueInfo(value,input)};}
 catch(error){if(!api.as3IsSourceErrorInstance(error))throw new Error(method+'-'+id+': '+error.stack);result={ok:false,error:api.as3GetProperty(error,'name'),errorID:api.as3GetProperty(error,'errorID'),
  sourceError:api.as3IsSourceErrorInstance(error),typeError:api.sourceErrorParent(error)===api.getAS3SourceErrorPrototype('TypeError')};}
 row(method+'-'+id,[result,subject.entries,subject.queue===good,subject.queue===null]);
}
subject=new VectorBoundary();subject.queue=good;
row('catch-invalid',[subject.catchAssignment(objects),subject.queue===good]);
row('catch-null',[subject.catchAssignment(undefined),subject.queue===null]);
const fn=subject.exchange;
try{fn();row('missing-argument','accepted');}
catch(error){row('missing-argument',[error.name,error.errorID,subject.entries]);}
try{fn(good,good);row('extra-argument','accepted');}
catch(error){row('extra-argument',[error.name,error.errorID,subject.entries]);}
globalThis.result=rows;

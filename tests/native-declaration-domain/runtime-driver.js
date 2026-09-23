const p=load('AS3MethodBinding'),nc=load('nativeClass'),domain=load('declarationDomain');
const loadedBeforeClasses=Array.from(load.loaded.keys());
const aClass=nc.readNativeClass(load('a.Node').Node,'value'),bClass=nc.readNativeClass(load('b.Node').Node,'value'),Anchor=nc.readNativeClass(load('Anchor').Anchor,'value');
const a=new aClass(),b=new bClass(),anchor=new Anchor(),rows=[];
const row=(id,value)=>rows.push({id,value});
row('a-default',a.next===null);row('b-default',b.next===null);row('anchor-default',anchor.next===null);
row('a-static-default',aClass.defaultNode===null);row('b-static-default',bClass.defaultNode===null);
row('a-own-reference',new aClass(a).next===a);row('b-qualified-reference',new bClass(b).next===b);row('anchor-same-package',new Anchor(anchor).next===anchor);
row('a-link-own',a.link(a)===a);row('a-link-undefined',a.link(undefined)===null);row('b-link-own',b.link(b)===b);
try{a.link(b);}catch(e){row('foreign-write-fails',[e.name,e.errorID,a.next===null]);}
try{b.link(a);}catch(e){row('other-domain-write-fails',[e.name,e.errorID,b.next===b]);}
row('Class-identities-distinct',aClass!==bClass);
const CycleA=nc.readNativeClass(load('CycleA').CycleA,'value'),CycleB=nc.readNativeClass(load('CycleB').CycleB,'value');
row('cycle-A-publishes-B',CycleA.other===CycleB);row('cycle-B-sees-null-A',CycleB.other===null);
const guards=[];function guard(id,test){if(!test())throw Error('domain guard failed: '+id);guards.push({id,pass:true});}
function throws(run){try{run();return false;}catch(e){return true;}}
guard('domain-module-does-not-load-class-modules',()=>loadedBeforeClasses.length===1&&loadedBeforeClasses[0]==='declarationDomain');
guard('class-publication-uses-domain-token',()=>p.getAS3DeclarationType(aClass)===domain.type3&&p.getAS3DeclarationType(bClass)===domain.type4);
guard('own-instance-uses-domain-token',()=>p.isAS3DeclaredInstance(a,domain.type3)&&p.as3CoerceReference(a,domain.type3)===a);
guard('same-name-foreign-instance-rejected',()=>!p.isAS3DeclaredInstance(b,domain.type3)&&throws(()=>p.as3CoerceReference(b,domain.type3)));
guard('token-is-frozen-and-private-branded',()=>Object.isFrozen(domain.type3)&&p.isAS3DeclarationType(domain.type3)&&!p.isAS3DeclarationType({...domain.type3}));
guard('token-copy-forgery-rejected',()=>throws(()=>p.as3CoerceReference(a,{...domain.type3})));
guard('token-json-forgery-rejected',()=>throws(()=>p.as3CoerceReference(a,JSON.parse(JSON.stringify(domain.type3)))));
const otherLoad=createDomainLoader(),otherDomain=otherLoad('declarationDomain');
guard('separate-same-qname-domains-distinct',()=>domain.type3!==otherDomain.type3);
guard('uninitialized-domain-null-coercion-needs-no-class-load',()=>p.as3CoerceReference(null,otherDomain.type3)===null&&otherLoad.loaded.size===1);
guard('uninitialized-domain-undefined-coercion-needs-no-class-load',()=>p.as3CoerceReference(undefined,otherDomain.type3)===null&&otherLoad.loaded.size===1);
guard('uninitialized-domain-invalid-coercion-needs-no-class-load',()=>throws(()=>p.as3CoerceReference(a,otherDomain.type3))&&otherLoad.loaded.size===1);
const otherB=nc.readNativeClass(otherLoad('b.Node').Node,'value'),otherA=nc.readNativeClass(otherLoad('a.Node').Node,'value'),otherInstance=new otherA();
guard('reverse-load-order-preserves-own-token',()=>p.getAS3DeclarationType(otherA)===otherDomain.type3&&p.getAS3DeclarationType(otherB)===otherDomain.type4);
guard('separate-domains-reject-cross-instance',()=>throws(()=>p.as3CoerceReference(otherInstance,domain.type3))&&throws(()=>p.as3CoerceReference(a,otherDomain.type3)));
guard('module-reload-reuses-domain-and-class',()=>otherLoad('declarationDomain')===otherDomain&&nc.readNativeClass(otherLoad('a.Node').Node,'value')===otherA);
let failOnce=true,failedClass,attempts=0;const sentinel={injected:'after-generated-factory-before-lazy-cache'};
const retryNative=Object.assign({},nc,{declareNativeClass(factory){return nc.declareNativeClass(finalize=>{attempts++;const value=factory(finalize);if(failOnce){failOnce=false;failedClass=value;throw sentinel;}return value;});}});
const retryLoad=createDomainLoader(retryNative),retryDomain=retryLoad('declarationDomain'),retryHandle=retryLoad('a.Node').Node;
let thrown;try{nc.readNativeClass(retryHandle,'value');}catch(e){thrown=e;}
guard('injected-factory-failure-preserves-throw-identity',()=>thrown===sentinel&&attempts===1);
const retriedClass=nc.readNativeClass(retryHandle,'value'),retryInstance=new retriedClass();
guard('retry-publishes-fresh-generation-on-same-token',()=>attempts===2&&failedClass!==retriedClass&&p.getAS3DeclarationType(failedClass)===retryDomain.type3&&p.getAS3DeclarationType(retriedClass)===retryDomain.type3);
guard('retry-entered-instance-and-cache-valid',()=>p.as3CoerceReference(retryInstance,retryDomain.type3)===retryInstance&&nc.readNativeClass(retryHandle,'value')===retriedClass&&attempts===2);
globalThis.result={rows,guards};

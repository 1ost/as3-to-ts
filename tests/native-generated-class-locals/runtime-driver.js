const p=load('AS3MethodBinding'),nc=load('nativeClass'),domain=load('declarationDomain');
const typeToken=(q,d=domain)=>d[declarationBindings.find(b=>b.qname===q).tokenExport];
const get=(name,exportName=name)=>nc.readNativeClass(load(name)[exportName],'value');
const field=(value,name)=>p.as3GetProperty(value,name),set=(value,name,x)=>p.as3SetProperty(value,name,x),del=(value,name)=>p.as3DeleteProperty(value,name);
const register=fn=>{p.registerAS3Function(fn,p.getAS3BuiltinScriptGlobal(),fn.length);return fn;};
const initializationRows=[],State=get('State');initializationRows.push({id:'entry',events:State.events.concat()});
const holder=new (get('DeferredHolder'))();initializationRows.push({id:'holder',events:State.events.concat()});
let value=holder.empty();initializationRows.push({id:'default',isNull:value===null,events:State.events.concat()});
value=holder.accept(undefined);initializationRows.push({id:'undefined',isNull:value===null,events:State.events.concat()});
try{holder.accept({});}catch(e){initializationRows.push({id:'invalid',error:[field(e,'name'),field(e,'errorID')],events:State.events.concat()});}
const beforeForeignConstruction=Array.from(load.loaded.keys());
const deferred=new (get('DeferredPeer'))();initializationRows.push({id:'construction',events:State.events.concat()});
value=holder.accept(deferred);initializationRows.push({id:'genuine',same:value===deferred,events:State.events.concat()});
const Entry=get('Entry'),Peer=get('Peer'),OtherPeer=get('OtherPeer','Peer'),x=new Entry(),q=new (get('Qualified'))(),same=new (get('SamePackage'))(),peer=new Peer(),other=new OtherPeer(),companion=new (get('Companion'))(),left=new (get('Left'))(),right=new (get('Right'))();
let events=[];const rows=[],token={token:true};
function encode(value){if(value===undefined)return {kind:'undefined'};if(value===null)return {kind:'null'};if(value===peer)return {kind:'peer'};if(value===other)return {kind:'other'};if(value===x)return {kind:'self'};if(value===companion)return {kind:'companion'};if(value===left)return {kind:'left'};if(value===right)return {kind:'right'};if(Array.isArray(value))return value.map(encode);return value;}
function errorValue(e){return [field(e,'name'),field(e,'errorID')];}
const observer={error:register(errorValue)};
function row(id,target,name,args){events=[];try{rows.push({id,value:encode(target[name](...args)),events});}catch(e){rows.push({id,error:errorValue(e),sameThrow:e===token,events});}}
row('default',x,'empty',[]);
const inputs=[peer,null,undefined,other,{},3,'peer',Peer],labels=['peer','null','undefined','other','plain','number','string','Class'];
inputs.forEach((value,i)=>row('init-'+labels[i],x,'initialize',[value]));
row('store-peer',x,'store',[null,peer]);row('store-undefined',x,'store',[peer,undefined]);row('store-null',x,'store',[peer,null]);row('chain-undefined',x,'chain',[peer,undefined]);row('chain-peer',x,'chain',[null,peer]);
row('failed-write',x,'failure',[peer,other,observer]);row('failed-init',x,'failedInit',[other,observer]);
const bad={valueOf:register(()=>{events.push('valueOf');throw token;}),toString:register(()=>{events.push('toString');throw token;})};row('no-hooks',x,'failure',[peer,bad,observer]);
const box={next:register(()=>{events.push('rhs');return peer;})};row('rhs-once',x,'expression',[box]);box.next=register(()=>{events.push('rhs');return other;});row('rhs-invalid',x,'expression',[box]);box.next=register(()=>{events.push('rhs-throw');throw token;});row('rhs-throw',x,'expression',[box]);
row('self',x,'self',[x]);row('self-invalid',x,'self',[peer]);row('qualified-own',q,'own',[peer]);row('qualified-other',q,'other',[other]);row('qualified-own-invalid',q,'own',[other]);row('qualified-other-invalid',q,'other',[peer]);row('qualified-split',q,'split',[peer,other]);
row('same-package',same,'accept',[companion]);row('same-package-invalid',same,'accept',[peer]);row('left-default',left,'empty',[]);row('right-default',right,'empty',[]);row('left-right',left,'accept',[right]);row('right-left',right,'accept',[left]);row('left-invalid',left,'accept',[left]);
row('skipped-default',x,'skipped',[false]);row('entered-default',x,'skipped',[true]);row('repeated-preserves-value',x,'repeated',[peer]);row('before-declaration-default',x,'readBeforeDeclaration',[]);
const Constructed=get('Constructed');
row('constructor-local-peer',{run:()=>new Constructed(peer).stored},'run',[]);
row('constructor-local-null',{run:()=>new Constructed(null).stored},'run',[]);
row('constructor-local-invalid',{run:()=>new Constructed(other).stored},'run',[]);
const errorRows=[];function failure(v){try{x.initialize(v);}catch(e){return e;}return null;}function fields(e){return [field(e,'name'),typeof field(e,'message'),field(e,'message')===null,field(e,'errorID')];}
const failureValue=failure(other);errorRows.push({id:'fields',value:fields(failureValue)});errorRows.push({id:'fresh',value:failure(other)!==failureValue});set(failureValue,'name',17);set(failureValue,'message',null);errorRows.push({id:'wildcard',value:fields(failureValue)});errorRows.push({id:'delete-fixed',value:[del(failureValue,'name'),del(failureValue,'message'),del(failureValue,'errorID')]});
try{set(failureValue,'errorID',9);}catch(ro){errorRows.push({id:'readonly',value:fields(ro)});}errorRows.push({id:'id-retained',value:field(failureValue,'errorID')});set(failureValue,'extra','slot');errorRows.push({id:'dynamic',value:[field(failureValue,'extra'),del(failureValue,'extra'),field(failureValue,'extra')===undefined]});
let seen=null;try{x.catchRethrow(other,{seen:register(e=>{seen=e;})});}catch(re){errorRows.push({id:'rethrow',same:seen===re,value:fields(re)});}
const prototype=p.getAS3SourceErrorPrototype('TypeError'),old=field(prototype,'name');set(prototype,'name','Changed');const changed=failure(other);set(prototype,'name',old);errorRows.push({id:'snapshot',value:fields(changed)});
const guards=[];function guard(id,test){if(!test())throw Error(id);guards.push({id,pass:true});}
const throws=f=>{try{f();return false;}catch(e){return true;}};
guard('coercion-default-and-error-do-not-load-foreign-module',()=>!beforeForeignConstruction.includes('DeferredPeer'));
guard('self-token-is-exact-domain-token',()=>p.getAS3DeclarationType(Entry)===typeToken('refs.Entry')&&p.as3CoerceReference(x,typeToken('refs.Entry'))===x);
guard('foreign-token-is-class-publication-token',()=>p.getAS3DeclarationType(Peer)===typeToken('refs.Peer')&&p.as3CoerceReference(peer,typeToken('refs.Peer'))===peer);
guard('source-error-not-host-counterfeit',()=>p.isAS3SourceError(failure({}))&&!p.isAS3SourceError(Object.assign(new TypeError(),{errorID:1034})));
const otherLoad=createDomainLoader(),otherDomain=otherLoad('declarationDomain'),otherEntry=nc.readNativeClass(otherLoad('Entry').Entry,'value'),otherX=new otherEntry();
guard('same-qname-domain-token-distinct',()=>typeToken('refs.Peer')!==typeToken('refs.Peer',otherDomain));
guard('uninitialized-foreign-target-default-works',()=>otherX.empty()===null&&!otherLoad.loaded.has('Peer'));
guard('uninitialized-foreign-target-rejects-cross-domain',()=>throws(()=>otherX.initialize(peer))&&!otherLoad.loaded.has('Peer'));
guard('undefined-store-does-not-initialize-foreign-target',()=>otherX.store(null,undefined)[1]===null&&!otherLoad.loaded.has('Peer'));
const otherPeerClass=nc.readNativeClass(otherLoad('Peer').Peer,'value'),otherPeer=new otherPeerClass();
guard('reverse-load-independent-domain-accepts-own-instance',()=>otherX.initialize(otherPeer)===otherPeer);
guard('first-domain-rejects-second-domain-instance',()=>throws(()=>x.initialize(otherPeer)));
globalThis.result={rows,initializationRows,errorRows,guards};

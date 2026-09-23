const Entry=load('nativeClass').readNativeClass(load('EntryDispatcher').EntryDispatcher);
const Leaf=load('nativeClass').readNativeClass(load('LeafDispatcher').LeafDispatcher);
const rows=[];
Entry.log=[];const a=new Entry();
rows.push({id:'self-entry',value:Entry.log});
rows.push({id:'self-fields',value:[a===Entry.captured,a.marker,Entry.early===a.hasEventListener]});
const other=new api.EventDispatcher(),method=a.hasEventListener;
rows.push({id:'bound-method',value:[method('early'),method.call(other,'early'),method===a.hasEventListener]});
Entry.log=[];const targeted=new Entry(other);
rows.push({id:'targeted-entry',value:Entry.log});
rows.push({id:'target-listeners',value:[targeted.hasEventListener('early'),other.hasEventListener('early')]});
Entry.log=[];let failure=[];try{new Entry(7);}catch(error){failure=[error.name,error.errorID];}
rows.push({id:'failed-entry',value:[failure,Entry.log,Entry.captured.marker,Entry.captured.hasEventListener('early')]});
const failed=Entry.captured;
Entry.log=[];const leaf=new Leaf();
rows.push({id:'leaf-entry',value:[Entry.log,leaf.marker,leaf.leaf]});
rows.push({id:'membership',value:[api.as3Is(leaf,Leaf),api.as3Is(leaf,Entry),api.as3Is(leaf,api.EventDispatcher),api.as3Is(leaf,api.IEventDispatcher),api.as3Is(a,api.IEventDispatcher)]});
rows.push({id:'native-methods',value:[a.toString(),new api.EventDispatcher().toString(),...['addEventListener','removeEventListener','dispatchEvent','hasEventListener','willTrigger'].map(name=>api.as3GetProperty(a[name],'length'))]});
a.remove();rows.push({id:'remove-bound-listener',value:[a.hasEventListener('early'),targeted.hasEventListener('early'),leaf.hasEventListener('early')]});
let runtimeGuards=0;
function rejects(action){let rejected=false;try{action();}catch(e){rejected=true;}if(!rejected)throw Error('native entry unexpectedly accepted');runtimeGuards++;}
for(const value of [{},Object.create(api.EventDispatcher.prototype),api.EventDispatcher.prototype,other]){
 rejects(()=>api.prepareGeneratedFlashEventDispatcher(value));
 rejects(()=>api.initializeGeneratedFlashEventDispatcher(value,[]));
}
for(const value of [a,failed]){
 rejects(()=>api.prepareGeneratedFlashEventDispatcher(value));
 rejects(()=>api.initializeGeneratedFlashEventDispatcher(value,[]));
}
for(const value of [{},Object.create(api.EventDispatcher.prototype)]){
 if(api.as3Is(value,api.EventDispatcher)||api.as3Is(value,api.IEventDispatcher))throw Error('forged dispatcher identity');runtimeGuards++;
}
if(runtimeGuards!==14)throw Error('native guard count');
globalThis.runtimeGuards=runtimeGuards;
globalThis.result=rows;

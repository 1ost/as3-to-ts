// Observer only; the complete captured HostConsumer is emitted unchanged.
const HostConsumer=load('nativeClass').readNativeClass(load('HostConsumer').HostConsumer);
const rows=[];function record(id,fn){let result;let failed=[];try{result=fn();}catch(e){failed=[e.name,e.errorID];}rows.push({id,value:[result===undefined?'<undefined>':result,failed]});}
record('available',()=>HostConsumer.available());record('guarded',()=>HostConsumer.guarded('probe'));
record('direct',()=>HostConsumer.direct('console.log'));record('caught',()=>HostConsumer.caught('console.log'));
record('null',()=>HostConsumer.caught(null));record('empty',()=>HostConsumer.caught(''));
record('noncanonical',()=>HostConsumer.caught('function(){return 1;}'));
// These verify the existing explicit native host contract, not an AIR browser capture.
const calls=[];const lease=api.installNativeExternalInterfaceHost({call(name,args){calls.push([name,args]);return 17;}});
try{
 if(HostConsumer.available()!==true)throw Error('Installed host unavailable');
 if(HostConsumer.guarded('native')!==true)throw Error('Guarded call skipped');
 if(HostConsumer.direct('host.echo')!==17)throw Error('Native return lost');
 if(JSON.stringify(calls)!==JSON.stringify([['console.log',['native']],['host.echo',['probe']]]))throw Error('Host arguments changed');
}finally{lease.dispose();}
if(HostConsumer.available()!==false)throw Error('Disposed host retained');
globalThis.result=rows;

import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue,as3ConstructValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('interface-method-read',domain);
 const make=(name,...args)=>as3ConstructClass(domain.getDefinition('ifacemethod.'+name),args),reader=make('Reader'),factory=make('Factory');
 const invoke=(object,name,...args)=>as3CallValue(get(object,name),()=>args),call=(name,...args)=>invoke(reader,name,...args),rows=[];
 const record=(id,value)=>rows.push({id,value});
 const errorRow=(id,fn,tail=()=>[])=>{try{fn();record(id,'missing error');}catch(e){record(id,[e.name,e.errorID,...tail()]);}};
 let cell,other,holder,fn;
 for(const name of ['direct','local','base','chain','stored'])for(let kind=0;kind<3;kind++){
  cell=kind===0?make('Cell',10):kind===1?make('Derived',10):invoke(factory,'make',10);
  other=make('Cell',100);holder=make('Holder');set(holder,'cell',cell);call('store',cell);
  const read=()=>name==='chain'?call('chain',holder):name==='stored'?call('stored'):call(name,cell);
  fn=read();const again=read();
  record(name+':'+kind,[fn===again,get(fn,'length'),as3CallValue(fn,()=>[]),invoke(fn,'call',other,3.9),invoke(fn,'apply',other,[-1]),invoke(other,'add',0),get(holder,'hits'),call('own')]);
 }
 for(const name of ['direct','local','base','chain','stored']){
  holder=make('Holder');call('store',null);
  errorRow('null:'+name,()=>name==='chain'?call('chain',holder):name==='stored'?call('stored'):call(name,null),()=>[get(holder,'hits')]);
 }
 errorRow('null-holder',()=>call('chain',null));
 cell=make('Cell',4);other=make('Cell',20);holder=make('Holder');set(holder,'cell',cell);
 fn=call('chain',holder);set(holder,'cell',other);
 record('captured-receiver',[invoke(fn,'call',other,5),invoke(cell,'add',0),invoke(other,'add',0),get(holder,'hits')]);
 record('different-receivers',call('direct',cell)!==call('direct',other));
 record('interface-base-identity',call('direct',cell)===call('base',cell));
 fn=call('direct',cell);const events=[],convert={valueOf(){events.push('convert');return 2.9;}};
 record('argument-conversion',[as3CallValue(fn,()=>[convert]),events.slice()]);
 errorRow('wrong-interface',()=>call('local',{}));
 errorRow('extra-argument',()=>as3CallValue(fn,()=>[1,2]));
 errorRow('construct-closure',()=>as3ConstructValue(fn,()=>[]));
 return {rows};
}

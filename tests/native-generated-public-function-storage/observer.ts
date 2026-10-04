import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
function observe(Holder:any,Reader:any){
const invoke=(target:any,name:string,...args:any[])=>as3CallValue(get(target,name),()=>args);
const create=(type:any,...args:any[]):any=>as3ConstructClass(type,args);
   var rows:any[]=[],log:any[]=[],holder:any=create(Holder),other:any=create(Holder),reader:any=create(Reader,holder),marker:any={};
   function record(id:string,fn:any):void {try{rows.push({id:id,value:fn()});}catch(e:any){rows.push({id:id,error:[e.name,e.errorID]});}}
   function callback(this:any,value:any):any {log.push(["call",this===holder,value===marker]);return 7;}
   function argument():any {log.push("argument");return marker;}
   holder.callback=callback;holder.parameter=marker;holder.log=log;
   record("complete",function():any {var value:any=invoke(reader,'complete');return [value,log.concat()];});log=[];holder.log=log;
   record("explicit",function():any {var value:any=invoke(reader,'explicit',argument);return [value,log.concat()];});log=[];holder.log=log;
   record("implicit",function():any {var value:any=invoke(reader,'implicit',argument);return [value,log.concat()];});log=[];holder.log=log;
   record("accessor",function():any {var value:any=invoke(reader,'accessor',argument);return [value,log.concat()];});log=[];holder.log=log;
   record("replace-callback",function():any {var value:any=invoke(reader,'explicit',function():any{log.push("argument");holder.callback=function(this:any,v:any):any{log.push(["replacement",this===holder,v===marker]);return 8;};return marker;});return [value,log.concat()];});
   holder.callback=callback;log=[];holder.log=log;
   record("replace-receiver",function():any {var value:any=invoke(reader,'explicit',function():any{log.push("argument");invoke(reader,'install',other);return marker;});return [value,log.concat()];});invoke(reader,'install',holder);
   holder.callback=get(holder,'bound');
   record("bound",function():any{var result:any=invoke(reader,'explicit',argument);return [result[0]===holder,result[1]===marker];});
   holder.callback=get(other,'bound');
   record("foreign-bound",function():any{var result:any=invoke(reader,'complete');return [result[0]===other,result[1]===marker];});
   for(var mode:number=0;mode<3;mode++){
    log=[];holder.log=log;holder.callback=null;invoke(reader,'install',mode==0?null:holder);
    record("null-"+mode,function():any{try{if(mode==2)invoke(reader,'accessor',argument);else invoke(reader,'explicit',argument);}catch(e:any){return [log.concat(),e.name,e.errorID];}return "unexpected";});
   }
   invoke(reader,'install',holder);holder.callback=callback;holder.getterFailure=marker;
   for(mode=0;mode<2;mode++){
    log=[];holder.log=log;
    record("getter-failure-"+mode,function():any{try{invoke(reader,'accessor',function():any{log.push("argument");if(mode==1)throw marker;return marker;});}catch(e:any){return [e===marker,log.concat()];}return "unexpected";});
   }
   holder.getterFailure=null;
   for(mode=0;mode<3;mode++){
    log=[];holder.log=log;holder.arbitrary=mode==0?null:mode==1?undefined:9;
    record("noncallable-"+mode,function():any{try{invoke(reader,'arbitrary',argument);}catch(e:any){return [log.concat(),e.name,e.errorID];}return "unexpected";});
   }
   invoke(reader,'install',null);log=[];
   record("argument-throws-before-null",function():any{try{invoke(reader,'explicit',function():any{log.push("argument");throw marker;});}catch(e:any){return [e===marker,log.concat()];}return "unexpected";});
   return {ready:true,failure:"",observations:rows};

}
export async function run(module:NativeSourceClassModule){const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:3});try{const first=await session.load('first',new ApplicationDomain(ApplicationDomain.currentDomain)),other=await session.load('other',new ApplicationDomain(ApplicationDomain.currentDomain)),child=await session.load('child',new ApplicationDomain(first.applicationDomain));const Holder=first.getDefinition('calls.Holder'),Reader=first.getDefinition('calls.Reader'),result=observe(Holder,Reader),second=observe(other.getDefinition('calls.Holder'),other.getDefinition('calls.Reader'));const domainChecks=[Holder!==other.getDefinition('calls.Holder'),Reader!==other.getDefinition('calls.Reader'),Holder===child.getDefinition('calls.Holder'),Reader===child.getDefinition('calls.Reader'),JSON.stringify(result)===JSON.stringify(second)];if(!domainChecks.every(Boolean))throw Error('Domain mismatch');return {rows:result.observations,domainChecks};}finally{session.retire();}}

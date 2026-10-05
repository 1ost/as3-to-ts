import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('inherited-static',domain);
 const make=(name,...args)=>as3ConstructClass(domain.getDefinition(name.includes('.')?name:'staticfields.'+name),args);
 const invoke=(object,name,...args)=>as3CallValue(get(object,name),()=>args);
 const rows=[],base=make('Base'),child=make('Child'),grand=make('far.Grand'),hidden=invoke(make('Factory'),'make');
 const targets=[base,child,grand,hidden],suffixes=['Base','','Deep','Hidden'];
 const record=function(id,value) {rows.push({id:id,value:value});};
 const state=function() {return [invoke(base,'readBase'),invoke(child,'read'),invoke(grand,'readDeep'),invoke(hidden,'readHidden')];};
 const starts=[7,2147483647,-2147483648],ops=['preInc','postInc','preDec','postDec'];
 for(var i=0;i<4;i++)for(var j=0;j<4;j++)for(let k=0;k<3;k++){
 invoke(base,'writeBase',starts[k]);var raw=invoke(targets[i],ops[j]+suffixes[i]);record('update:'+i+':'+j+':'+k,[raw,state()]);
 }
 const values=[1.5,-3.9,4294967297,NaN,Infinity,undefined,null,'2.5'];
 for(i=0;i<4;i++)for(j=0;j<values.length;j++){
 invoke(base,'writeBase',7);raw=invoke(targets[i],'subtract'+suffixes[i],values[j]);record('subtract:'+i+':'+j,[String(raw),state()]);
 }
 invoke(base,'writeBase',-2147483648);record('static-decrement',[invoke(domain.getDefinition('staticfields.Base'),'staticDec'),state()]);
 invoke(base,'writeBase',7);record('static-subtract',[invoke(domain.getDefinition('staticfields.Base'),'staticSubtract',1.5),state()]);
 const events=[],converted={valueOf:function() {events.push('convert');invoke(base,'writeBase',99);return 2.5;}};
 invoke(base,'writeBase',7);raw=invoke(grand,'subtractDeep',converted);record('coercion-order',[raw,events.concat(),state()]);
 const thrown={},bad={valueOf:function() {events.push('throw');invoke(base,'writeBase',33);throw thrown;}};
 invoke(base,'writeBase',7);try{invoke(hidden,'subtractHidden',bad);record('throw','missing error');}catch(e){record('throw',[e===thrown,events.concat(),state()]);}
 invoke(base,'writeBase',31);record('late-instance',[invoke(make('Child'),'read'),invoke(make('far.Grand'),'readDeep'),invoke(invoke(make('Factory'),'make'),'readHidden')]);
 try{raw=get(hidden,'count');record('visibility','missing error');}catch(error){record('visibility',[error.name,error.errorID]);}
 return {rows};
}

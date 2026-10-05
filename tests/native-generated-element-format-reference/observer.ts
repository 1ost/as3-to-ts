import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3Is} from '@FLASH@/utils/AS3Type';
import {ElementFormat as Format} from '@FLASH@/utils/AS3CanonicalElementFormatReference';
import {FontDescription} from '@FLASH@/utils/AS3CanonicalFontDescriptionReference';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('formatcases',domain);
 const Reader=domain.getDefinition('formatcases.Reader'),reader=as3ConstructClass(Reader,[]),call=(object,name,...args)=>as3CallValue(get(object,name),()=>args);
 const rows=[],run=(id,fn)=>{try{rows.push({id,value:fn()});}catch(e){rows.push({id,error:[e.name,e.errorID]});}};
 const a=as3ConstructClass(Format,[null,23]),b=as3ConstructClass(Format,[null,41]),log=[];
 run('read',()=>call(reader,'read',a));run('read-null',()=>call(reader,'read',null));run('read-undefined',()=>call(reader,'read',undefined));run('read-structural',()=>call(reader,'read',{fontSize:23}));run('read-wrong-native',()=>call(reader,'read',new FontDescription()));
 const block={elementFormat:a};run('conditional-block',()=>call(reader,'pick',block,b));run('conditional-fallback',()=>call(reader,'pick',null,b));block.elementFormat={fontSize:9};run('conditional-invalid',()=>call(reader,'pick',block,b));
 run('assign',()=>call(reader,'assign',a));run('assign-invalid',()=>call(reader,'assign',{}));run('uninitialized',()=>call(reader,'empty'));
 run('parameter',()=>call(reader,'typed',a)===a);run('parameter-null',()=>call(reader,'typed',null)===null);run('parameter-undefined',()=>call(reader,'typed',undefined)===null);run('parameter-invalid',()=>call(reader,'typed',{}));
 run('clone',()=>{const result=call(reader,'cloned',a);return [result!==a,as3Is(result,Format),get(result,'fontSize'),get(result,'fontDescription')!==get(a,'fontDescription')];});
 run('construct',()=>{const result=call(reader,'make');return [as3Is(result,Format),get(result,'fontSize')];});
 run('return',()=>call(reader,'returned',a)===a);run('return-null',()=>call(reader,'returned',null)===null);run('return-undefined',()=>call(reader,'returned',undefined)===null);run('return-invalid',()=>call(reader,'returned',{}));
 run('finally',()=>{log.length=0;const result=call(reader,'throughFinally',a,log);return [result===a,log.slice()];});
 run('finally-invalid',()=>{log.length=0;try{call(reader,'throughFinally',{},log);}catch(e){return [log.slice(),e.name,e.errorID];}return 'missing error';});
 run('finally-replaced',()=>call(reader,'replace',{},b)===b);run('finally-replaced-invalid',()=>call(reader,'replace',a,{}));
 run('getter',()=>{set(reader,'stored',a);return get(reader,'selected')===a;});run('getter-undefined',()=>{set(reader,'stored',undefined);return get(reader,'selected')===null;});run('getter-invalid',()=>{set(reader,'stored',{});return get(reader,'selected');});
 const raw={toString(){log.push('string');return 'wrong';},valueOf(){log.push('number');return a;}};
 run('no-conversion-hooks',()=>{log.length=0;try{call(reader,'read',raw);}catch(e){return [log.slice(),e.name,e.errorID];}return 'missing error';});
 run('bound',()=>as3CallValue(get(reader,'returned'),()=>[a],{})===a);run('arity-missing',()=>call(reader,'returned'));run('arity-extra',()=>call(reader,'returned',a,b));
 run('parameter-read',()=>call(reader,'parameterRead',a));run('parameter-read-null',()=>call(reader,'parameterRead',null));run('clone-null',()=>call(reader,'cloned',null));
 run('bound-native-method',()=>{const fn=call(reader,'bound',a),result=as3CallValue(fn,()=>[],{});return [as3Is(result,Format),get(result,'fontSize'),result!==a];});
 run('index-read',()=>call(reader,'indexed',a,'fontSize'));run('index-null',()=>call(reader,'indexed',null,'fontSize'));
 run('write',()=>{log.length=0;const number={valueOf(){log.push('number');return 29;}},result=call(reader,'write',a,number);return [result===number,get(a,'fontSize'),log.slice()];});
 run('write-null',()=>call(reader,'write',null,1));run('write-locked',()=>{set(a,'locked',true);return call(reader,'write',a,1);});
 const checks=[];for(const [id,value]of [['prototype-forgery',Object.create(Format.prototype)],['proxy-forgery',new Proxy(a,{})],['class-is-not-instance',Format],['copied-instance',Object.assign(Object.create(Format.prototype),a)]]){
  let error;try{call(reader,'typed',value);}catch(e){error=e;}if(error?.name!=='TypeError'||error?.errorID!==1034)throw Error(id);checks.push(id);
 }
 const otherDomain=new ApplicationDomain(ApplicationDomain.currentDomain),otherSession=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await otherSession.load('formatcases',otherDomain);
 const Other=otherDomain.getDefinition('formatcases.Reader'),other=as3ConstructClass(Other,[]);if(Other===Reader||call(other,'typed',a)!==a)throw Error('domain identity');checks.push('separate-class-domain-shared-native');
 session.retire();if(call(reader,'typed',a)!==a)throw Error('retained reference');checks.push('retained-after-retire');otherSession.retire();
 return {rows,checks};
}

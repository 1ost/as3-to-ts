import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {FontMetrics} from '@FLASH@/utils/AS3CanonicalFontMetricsReference';
import {Rectangle} from '@FLASH@/geom/Rectangle';
import {run as native} from '@FONT_OBSERVER@';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('metrics',domain);
 const subject=as3ConstructClass(domain.getDefinition('metriccases.MetricChild'),[]);
 const call=value=>as3CallValue(get(subject,'select'),()=>[value]);
 const engine=native(),rows=[...engine.rows];
 const observe=(id,fn)=>{try{rows.push({id,value:fn()});}catch(e){rows.push({id,value:{error:[e.name,e.errorID]}});}};
 const m=new FontMetrics(new Rectangle(1,2,3,4),1,2,3,4,5,6,7,8,9);
 observe('generated-default',()=>get(subject,'stored')===null);
 observe('generated-override',()=>[call(m)===m,get(subject,'stored')===m]);
 observe('generated-null',()=>[call(null)===null,get(subject,'stored')===null]);
 observe('generated-undefined',()=>[call(undefined)===null,get(subject,'stored')===null]);
 observe('generated-invalid',()=>call({}));
 observe('generated-after-invalid',()=>get(subject,'stored')===null);
 observe('generated-field',()=>{set(subject,'stored',m);return get(subject,'stored')===m;});
 observe('generated-field-invalid',()=>{set(subject,'stored',{});return true;});
 observe('generated-field-retained',()=>get(subject,'stored')===m);
 observe('generated-field-undefined',()=>{set(subject,'stored',undefined);return get(subject,'stored')===null;});
 return {rows,guards:engine.guards};
}

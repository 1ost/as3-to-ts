
import {BlurFilter} from '@FLASH@/filters/BlurFilter';import {GlowFilter} from '@FLASH@/filters/GlowFilter';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
export async function run(nativeSourceClassModule:any){
 const session=createNativeSourceClassLoadingSession({resolve:()=>nativeSourceClassModule,maxModules:1});
 try{
  const domain=await session.load('filters',new ApplicationDomain(ApplicationDomain.currentDomain)),Subject=domain.getDefinition('FilterSubject') as any,Proxy=domain.getDefinition('cn.kyiax.yare.util.filter.ColorMatrixFilterProxy') as any,subject=new Subject(),rows:any[]=[];
  const f=subject.fresh();rows.push({id:'default',value:f.matrix});rows.push({id:'base-identity',value:subject.accept(f)===f});rows.push({id:'specific',value:subject.specific(f)===f});
  const c=subject.copy(f);rows.push({id:'clone',value:[c!==f,c.matrix]});const a=f.matrix;a[0]=99;rows.push({id:'copy-out',value:f.matrix[0]});
  const blur=new BlurFilter(),glow=new GlowFilter();rows.push({id:'other-subclasses',value:[subject.accept(blur)===blur,subject.accept(glow)===glow]});
  try{subject.accept({});rows.push({id:'reject',value:'accepted'});}catch(error){rows.push({id:'reject',value:[error.name,error.errorID,subject.current===glow]});}
  rows.push({id:'null',value:subject.accept(null)===null});
  rows.push({id:'saturation',value:Proxy.createSaturationFilter(.25).matrix});rows.push({id:'contrast',value:Proxy.createContrastFilter(1.5).matrix});rows.push({id:'brightness',value:Proxy.createBrightnessFilter(-25).matrix});
  rows.push({id:'inversion',value:Proxy.createInversionFilter().matrix});rows.push({id:'hue',value:Proxy.createHueFilter(45).matrix});rows.push({id:'threshold',value:Proxy.createThresholdFilter(.5).matrix});rows.push({id:'grayscale',value:Proxy.toGrayScale().matrix});rows.push({id:'original',value:Proxy.toOriginalColors().matrix});return {rows};
 }finally{session.retire();}
}

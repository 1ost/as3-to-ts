import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {as3GetClassNamespaceProperty,as3SetProperty} from '@FLASH@/utils/AS3Property';
import {QName} from '@FLASH@/utils/QName';
export async function run(module:NativeSourceClassModule) {
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:3});
 let checks=0;const check=(value:boolean)=>{if(!value)throw Error('Class namespace guard '+checks);checks++;};
 const reject=(fn:()=>unknown,code?:number)=>{let failed=false;try{fn();}catch(e){failed=code===undefined||e.errorID===code;}check(failed);};
 const uri='urn:op2:class:alpha';
 try {
  const domain=await session.load('subject',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Probe=domain.getDefinition('ClassNamespaceProbe') as any,result=new Probe().snapshot();
  check(result.ready&&!result.failure);
  const Subject=domain.getDefinition('cases.TargetA') as any;
  check(as3GetClassNamespaceProperty(Subject,uri,'description')==='A');
  check(as3GetClassNamespaceProperty(Subject,uri,'slot')===7);
  reject(()=>as3GetClassNamespaceProperty(null,uri,'description'),1009);
  reject(()=>as3GetClassNamespaceProperty(Subject,uri,'absent'),1069);
  reject(()=>as3GetClassNamespaceProperty(Subject,'urn:missing','description'),1069);
  reject(()=>as3GetClassNamespaceProperty({},uri,'description'));
  reject(()=>as3GetClassNamespaceProperty(()=>{},uri,'description'));
  reject(()=>as3GetClassNamespaceProperty(Subject,'','description'));
  reject(()=>as3GetClassNamespaceProperty(Subject,uri,''));
  const sibling=await session.load('sibling',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Other=sibling.getDefinition('cases.TargetA') as any;check(Subject!==Other);
  as3SetProperty(Subject,new QName(uri,'slot'),13);
  check(as3GetClassNamespaceProperty(Subject,uri,'slot')===13);
  check(as3GetClassNamespaceProperty(Other,uri,'slot')===7);
  const first=as3GetClassNamespaceProperty(Subject,uri,'method'),other=as3GetClassNamespaceProperty(Other,uri,'method');
  check(first!==other);check(first===as3GetClassNamespaceProperty(Subject,uri,'method'));
  const child=await session.load('child',new ApplicationDomain(domain.applicationDomain));
  check(child.getDefinition('cases.TargetA')===Subject);
  return {rows:result.observations,checks};
 }finally{session.retire();}
}

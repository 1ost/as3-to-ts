import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {Capabilities,CapabilitiesDeclaration,readAS3CapabilitiesStatic} from '@FLASH@/utils/AS3CanonicalCapabilitiesReference';
import {isAS3DeclaredInstance} from '@FLASH@/utils/AS3DeclarationType';
import {as3DescribeTypeXML} from '@FLASH@/utils/AS3ReflectionQuery';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 await session.load('caps',domain);const Reader=domain.getDefinition('caps.Reader'),reader=as3ConstructClass(Reader),rows=[],checks=[];
 const call=(method,...args)=>as3CallValue(get(reader,method),()=>args);
 rows.push({id:'read',value:call('read')});rows.push({id:'identity',value:call('identity')});
 rows.push({id:'argument',value:call('accept',Capabilities)});rows.push({id:'null-argument',value:call('accept',null)});
 rows.push({id:'as-class',value:call('from',Capabilities)===Capabilities});rows.push({id:'object-as-class',value:call('from',{})===null});rows.push({id:'null-as-class',value:call('from',null)===null});
 rows.push({id:'reflection',value:as3DescribeTypeXML(Capabilities).toXMLString()});
 const otherDomain=new ApplicationDomain(ApplicationDomain.currentDomain),other=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await other.load('caps',otherDomain);
 checks.push({name:'generated-class-isolation',passed:otherDomain.getDefinition('caps.Reader')!==Reader});
 checks.push({name:'forged-instance-rejected',passed:![{},Object.create(Capabilities.prototype),Capabilities].some(value=>isAS3DeclaredInstance(value,CapabilitiesDeclaration))});
 let held=false;try{as3ConstructClass(Capabilities);}catch(error){held=error.message.includes('lacks a proven constructor context');}
 checks.push({name:'construction-not-admitted',passed:held});
 let unsupported=0;for(const key of ['hasAccessibility','touchscreenType']){try{readAS3CapabilitiesStatic(key);}catch(error){if(error.name==='UnsupportedFlashFeatureError')unsupported++;}}
 checks.push({name:'known-unimplemented-members-remain-held',passed:unsupported===2});
 checks.push({name:'native-runtime-identity-preserved',passed:readAS3CapabilitiesStatic('version')==='LAYA 3,4,0,0'&&readAS3CapabilitiesStatic('playerType')==='Browser'});
 session.retire();other.retire();checks.push({name:'retained-source-class-reference',passed:call('accept',Capabilities)===true});
 return {rows,checks};
}

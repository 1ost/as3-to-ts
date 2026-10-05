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
 await session.load('caps',domain);const Reader=domain.getDefinition('caps.AccessibilityReader'),reader=as3ConstructClass(Reader),rows=[],checks=[];
 const call=(method,...args)=>as3CallValue(get(reader,method),()=>args);
 rows.push({id:'host',value:call('inspect')});
 for(const [id,value]of [['disabled',false],['enabled',true],['disabled-after',false],['enabled-again',true]])rows.push({id,value:call('run',value)});
 checks.push({name:'native-accessibility-host-unavailable',passed:Capabilities.hasAccessibility===false&&readAS3CapabilitiesStatic('hasAccessibility')===false});
 checks.push({name:'configuration-evaluated-once-per-call',passed:get(reader,'evaluations')===4});
 checks.push({name:'no-unsupported-host-attachment',passed:get(reader,'attachments')===0});
 session.retire();return {rows,checks};
}

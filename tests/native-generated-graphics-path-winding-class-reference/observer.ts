import {GraphicsPathWinding,GraphicsPathWindingDeclaration} from '@FLASH@/utils/AS3CanonicalGraphicsPathWindingReference';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty,as3SetProperty} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3Is,as3As} from '@FLASH@/utils/AS3Type';
import {as3DescribeTypeXML} from '@FLASH@/utils/AS3ReflectionQuery';
export async function run(module){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1}),domain=await session.load('path-winding',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Reader=domain.getDefinition('pathprobe.Reader');
 const rows=as3CallValue(as3GetProperty(Reader,'run'),()=>[]) as any[],checks=[];
 const value=as3ConstructClass(GraphicsPathWinding,[]);
 rows.push({id:'construct',value:[as3Is(value,GraphicsPathWindingDeclaration),as3DescribeTypeXML(value).toXMLString()]});
 try{as3ConstructClass(GraphicsPathWinding,[1]);rows.push({id:'construct-extra',value:'accepted'});}catch(e){rows.push({id:'construct-extra',value:[e.name,e.errorID]});}
 try{as3SetProperty(GraphicsPathWinding,'NON_ZERO','changed');rows.push({id:'write',value:'accepted'});}catch(e){rows.push({id:'write',value:[e.name,e.errorID]});}
 rows.push({id:'restored',value:GraphicsPathWinding.NON_ZERO});rows.push({id:'reflection',value:as3DescribeTypeXML(GraphicsPathWinding).toXMLString()});
 for(const [name,test]of [['prototype',GraphicsPathWinding.prototype],['forged',Object.create(GraphicsPathWinding.prototype)],['proxy',new Proxy(value,{})],['class',GraphicsPathWinding]])checks.push({name,passed:!as3Is(test,GraphicsPathWindingDeclaration)&&as3As(test,GraphicsPathWindingDeclaration)===null});
 let wrongArgs=false;try{Reflect.construct(GraphicsPathWinding,[1]);}catch(e){wrongArgs=e.errorID===1063;}checks.push({name:'direct-extra-args',passed:wrongArgs});
 let final=false;try{class Child extends GraphicsPathWinding{};new Child();}catch(e){final=e instanceof TypeError;}checks.push({name:'host-subclass',passed:final});
 session.retire();return {rows,checks};
}

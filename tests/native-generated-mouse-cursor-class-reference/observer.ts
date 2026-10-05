import {MouseCursor,MouseCursorDeclaration} from '@FLASH@/utils/AS3CanonicalMouseCursorReference';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty,as3SetProperty} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3Is,as3As} from '@FLASH@/utils/AS3Type';
import {as3DescribeTypeXML} from '@FLASH@/utils/AS3ReflectionQuery';
export async function run(module){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1}),domain=await session.load('cursor',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Reader=domain.getDefinition('cursorprobe.Reader');
 const rows=as3CallValue(as3GetProperty(Reader,'run'),()=>[]) as any[],checks=[];
 const value=as3ConstructClass(MouseCursor,[]);
 rows.push({id:'construct',value:[as3Is(value,MouseCursorDeclaration),as3DescribeTypeXML(value).toXMLString()]});
 try{as3ConstructClass(MouseCursor,[1]);rows.push({id:'construct-extra',value:'accepted'});}catch(e){rows.push({id:'construct-extra',value:[e.name,e.errorID]});}
 try{as3SetProperty(MouseCursor,'AUTO','changed');rows.push({id:'write',value:'accepted'});}catch(e){rows.push({id:'write',value:[e.name,e.errorID]});}
 rows.push({id:'restored',value:MouseCursor.AUTO});rows.push({id:'reflection',value:as3DescribeTypeXML(MouseCursor).toXMLString()});
 for(const [name,test]of [['prototype',MouseCursor.prototype],['forged',Object.create(MouseCursor.prototype)],['proxy',new Proxy(value,{})],['class',MouseCursor]])checks.push({name,passed:!as3Is(test,MouseCursorDeclaration)&&as3As(test,MouseCursorDeclaration)===null});
 let wrongArgs=false;try{Reflect.construct(MouseCursor,[1]);}catch(e){wrongArgs=e.errorID===1063;}checks.push({name:'direct-extra-args',passed:wrongArgs});
 let final=false;try{class Child extends MouseCursor{};new Child();}catch(e){final=e instanceof TypeError;}checks.push({name:'host-subclass',passed:final});
 session.retire();return {rows,checks};
}

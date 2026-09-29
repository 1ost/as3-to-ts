import {NativeGeneratedInterfaceMember} from './native-generated-interface-contracts';

// Exact AIR IEventDispatcher signatures, authenticated against the shared
// generated-native-interface-inheritance packet by the compiler regression.
// These declarations grant no implementations to structural lookalikes.
const owner='flash.events.IEventDispatcher';
const method=(name:string,returnType:string,parameters:Array<[string,boolean]>):NativeGeneratedInterfaceMember=>
    Object.freeze({owner,name,kind:'method' as 'method',returnType,parameters:Object.freeze(parameters.map(
        entry=>Object.freeze({type:entry[0],optional:entry[1],rest:false})))});
const dispatcher=Object.freeze([
    method('addEventListener','void',[['String',false],['Function',false],['Boolean',true],['int',true],['Boolean',true]]),
    method('dispatchEvent','Boolean',[['flash.events.Event',false]]),
    method('hasEventListener','Boolean',[['String',false]]),
    method('removeEventListener','void',[['String',false],['Function',false],['Boolean',true]]),
    method('willTrigger','Boolean',[['String',false]])
]);

// Captured from AIR describeType(IExternalizable). The native token supplies
// identity; source implementations must satisfy both exact method contracts.
const externalizable=Object.freeze([
    Object.freeze({...method('readExternal','void',[['flash.utils.IDataInput',false]]),owner:'flash.utils.IExternalizable'}),
    Object.freeze({...method('writeExternal','void',[['flash.utils.IDataOutput',false]]),owner:'flash.utils.IExternalizable'})
]);

export function nativeGeneratedInterfaceBoundary(name:string):ReadonlyArray<NativeGeneratedInterfaceMember>|undefined {
    return name===owner?dispatcher:name==='flash.utils.IExternalizable'?externalizable:undefined;
}

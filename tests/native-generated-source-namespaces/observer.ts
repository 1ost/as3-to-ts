import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession,NativeSourceClassModule} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {isAS3SourceNamespace} from '@FLASH@/utils/AS3SourceNamespace';
import {getQualifiedClassName} from '@FLASH@/utils/getQualifiedClassName';
import {getDefinitionByName,hasRegisteredDefinition} from '@FLASH@/utils/DefinitionRegistry';
import {as3String} from '@FLASH@/utils/AS3String';
const names=['flashx.textLayout::tlf_internal','fixture::same_uri','fixture::alias_uri'];
function describe(value:unknown){
 if(!isAS3SourceNamespace(value))throw Error('Not a namespace');
 return {uri:value.uri,prefix:as3String(value.prefix),prefixType:typeof value.prefix,type:typeof value,
  qualified:getQualifiedClassName(value),text:as3String(value)};
}
export async function run(mixed:NativeSourceClassModule,only:NativeSourceClassModule){
 const rows:any[]=[],checks:string[]=[];
 const check=(name:string,ok:boolean)=>{if(!ok)throw Error(name);checks.push(name);};
 const root=ApplicationDomain.currentDomain;
 const session=createNativeSourceClassLoadingSession({resolve:name=>name==='only'?only:mixed,maxModules:4});
 const loaded=await session.load('mixed',root),direct=loaded.getDefinition(names[0]),peer=loaded.getDefinition(names[1]);
 const row=(id:string,value:unknown)=>rows.push({id,value});
 row('direct',describe(direct));row('peer',describe(peer));row('alias',describe(loaded.getDefinition(names[2])));
 for(const name of ['flashx.textLayout.tlf_internal',names[0],'fixture.same_uri','fixture.alias_uri']){
  row(name+'-has',root.hasDefinition(name));row(name+'-read',{same:root.getDefinition(name)===(name==='fixture.same_uri'?peer:direct),value:describe(root.getDefinition(name))});
  row(name+'-global',describe(getDefinitionByName(name)));
 }
 row('names',root.getQualifiedDefinitionNames().filter(name=>names.includes(name)));
 const Box=loaded.getDefinition('fixture.Box') as any;
 check('mixed compiled Class constructs beside namespace values',new Box().value===7);
 const child=new ApplicationDomain(root),inherited=await session.load('mixed',child);
 check('child reuses compiled namespace declarations',names.every(name=>inherited.getDefinition(name)===loaded.getDefinition(name)));
 check('child reuses compiled Class',inherited.getDefinition('fixture.Box')===Box&&child.getQualifiedDefinitionNames().length===0);
 check('alias uses its actual source value',loaded.getDefinition(names[2])===direct);
 let rejected=false;try{root.selectSourceClass(names[0]);}catch{rejected=true;}check('namespace does not become Class header',rejected);
 session.retire();check('retirement clears compiled definitions',names.every(name=>!hasRegisteredDefinition(name))&&!loaded.active&&!inherited.active);
 check('retained compiled namespace stays readable',describe(direct).qualified==='Namespace');
 const next=createNativeSourceClassLoadingSession({resolve:()=>only,maxModules:3}),local=new ApplicationDomain(root),a=await next.load('only',local);
 check('namespace-only cohort publishes complete source set',a.names.length===3&&isAS3SourceNamespace(a.getDefinition(names[0])));
 const sibling=new ApplicationDomain(root),b=await next.load('only',sibling);
 check('separate domain has separate declaration authority',local.selectSourceDefinition(names[0])!.declaration!==sibling.selectSourceDefinition(names[0])!.declaration);
 check('local namespace does not leak into root',!hasRegisteredDefinition(names[0]));
 next.retire();check('both local owners retire',!a.active&&!b.active&&local.getQualifiedDefinitionNames().length===0&&sibling.getQualifiedDefinitionNames().length===0);
 return {rows,checks};
}

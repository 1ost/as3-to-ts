import '@ENGINE@/tests/nativeCanonicalSpriteClass/init-imports';
import {Laya} from '@ENGINE@/src/layaAir/Laya';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {TextBlock,GraphicElement,TextElement} from '@FLASH@/text/engine/ContentTree';
import {ElementFormat} from '@FLASH@/text/engine/ElementFormat';
import {FontDescription} from '@FLASH@/text/engine/FontDescription';
export async function run(module){
 await Laya.init(100,100);
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('textblock-method-read',domain);
 const make=name=>as3ConstructClass(domain.getDefinition('blockread.'+name),[]),r=make('Caller'),s=make('SubCaller'),c=make('Context');
 const call=(target,name,...args)=>as3CallValue(get(target,name),()=>args);
 const rows=[],observe=(id,fn)=>{try{rows.push({id,value:fn()});}catch(e){rows.push({id,value:[e.name,e.errorID]});}};
 call(r,'configure',c);call(s,'configure',c);
 let b=new TextBlock(),other=new TextBlock();
 const names=['findNextAtomBoundary','findPreviousAtomBoundary','findNextWordBoundary','findPreviousWordBoundary','getTextLineAtCharIndex','createTextLine','recreateTextLine','releaseLineCreationData','releaseLines','dump'];
 for(const name of names){
  const f=call(r,'read_'+name,b);
  observe('closure-'+name,()=>[f===call(r,'read_'+name,b),f===call(r,'read_'+name,other),get(f,'length')]);
  observe('null-'+name,()=>call(r,'read_'+name,null));
 }
 set(r,'block',b);observe('field',()=>call(r,'field')===call(r,'read_createTextLine',b));
 observe('inherited',()=>call(s,'inherited',b)===call(r,'read_createTextLine',b));
 observe('own',()=>[call(r,'own'),get(r,'ownCalls')]);
 observe('direct-empty',()=>call(r,'direct',b));
 observe('direct-null',()=>call(r,'direct',null));
 observe('direct-effects',()=>get(r,'effects'));
 observe('context-null-block',()=>call(r,'invoke',null,other,[]));
 observe('context-counts',()=>[get(r,'reads'),get(c,'calls')]);
 b=new TextBlock(new TextElement('word next',new ElementFormat(new FontDescription('Arial'),12)));
 observe('bound-boundary',()=>call(r,'read_findNextWordBoundary',b).apply(other,[0]));
 observe('bound-dump',()=>call(r,'read_dump',b).apply(other,[]));
 b=new TextBlock(new GraphicElement(null,10,10,new ElementFormat(new FontDescription('Arial'),12)));
 const line=call(r,'invoke',b,other,[null,20]);
 observe('context-create',()=>[line.textBlock===b,b.firstLine===line,other.firstLine===null,get(r,'reads'),get(c,'calls')]);
 call(r,'read_releaseLines',b).apply(other,[line,line]);
 observe('bound-release',()=>[b.firstLine===null,line.textBlock===null]);
 const rebuilt=call(r,'read_recreateTextLine',b).apply(other,[line,null,20]);
 observe('bound-recreate',()=>[rebuilt===line,line.textBlock===b]);
 call(r,'configure',null);observe('null-context',()=>call(r,'invoke',b,other,[]));
 observe('final-counts',()=>[get(r,'reads'),get(c,'calls'),get(r,'ownCalls'),get(s,'ownCalls')]);
 return {rows};
}

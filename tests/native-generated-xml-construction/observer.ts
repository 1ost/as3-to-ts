import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {as3XMLConstructionDefaults} from '@FLASH@/utils/AS3XML';
export async function run(parent:any){
 const session=createNativeSourceClassLoadingSession({resolve:()=>parent,maxModules:2});
 const domain=await session.load('builder',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Builder:any=domain.getDefinition('XMLBuilder'),builder=new Builder();
 const matrix=(inputs:string[],codeUnits=false)=>{
  const rows:any[]=[];
  const units=(value:string)=>codeUnits?Array.from({length:value.length},(_,i)=>value.charCodeAt(i)):value;
  const describe=(value:any)=>[value.nodeKind(),value.localName(),units(value.toString()),units(value.toXMLString()),value.children().length];
  const observe=(id:string,read:()=>unknown)=>{try{rows.push({id,value:read()});}catch(e){rows.push({id,error:[(e as any).name,(e as any).errorID??null]});}};
  const s=as3XMLConstructionDefaults;observe('settings',()=>[s.ignoreComments,s.ignoreProcessingInstructions,s.ignoreWhitespace,s.prettyPrinting,s.prettyIndent]);
  inputs.forEach((value,i)=>observe('string-'+i,()=>describe(builder.build(value))));
  [null,undefined,3,true,{},'<r/>'].forEach((value,i)=>observe('cast-'+i,()=>describe(builder.fromData(value))));
  observe('empty',()=>describe(builder.empty()));
  let calls=0;observe('once',()=>[describe(builder.effect(()=>{calls++;return '<r/>';})),calls]);
  let conversions=0;const disguised={toString(){conversions++;return '<r/>';}};
  observe('no-conversion',()=>[describe(builder.fromData(disguised)),conversions]);
  return rows;
 };
 const rows=[...matrix(["", " ", "hello", " a &amp; b ", "<r/>", "<r>text</r>", "<r>  text  </r>", "<r>\n <a/> \n <b/>\n</r>", "<r>a<b/>c</r>", "<!--comment-->", "<?work value?>", "<![CDATA[text]]>", "<r><!--comment--><?work value?><![CDATA[ x ]]></r>", "<?xml version=\"1.0\"?><r/>", "\ufeff<r/>", "<r a=\"&amp;&#65;&#x1f600;\"/>", "<r a=\"x\ty\nz\"/>", "<r xmlns=\"urn:r\"><child/></r>", "<p:r xmlns:p=\"urn:p\" p:a=\"v\"/>", "<!DOCTYPE r><r/>", "<r/><s/>", "text<r/>", "<r/>text", "<r>", "<r></s>", "<r a=\"1\" a=\"2\"/>", "<r>&bogus;</r>", "<r>&amp</r>", "<r><![CDATA[open</r>", "<r><!--open</r>", "<r a=unquoted/>", "<r>]]></r>", "<!--a--b--><r/>", "<r xmlns=\"\"/>"]),...matrix(["<p:r/>", "<r p:a=\"1\"/>", "<?foo", "<!DOCTYPE r", "<r", "<1/>", "<r <x/>", "<r a=\"<\"/>", "<r a=\"x\"b=\"y\"/>", "<r>\r\nx\ry</r>", "<r>&#0;&#xD800;&#xFFFF;&#65536;&#x41;&#X41;</r>", "<r>a<![CDATA[b]]>c</r>", "<r> a <!--ignored--> b </r>", "<r><a> x </a></r>", "<r xmlns=\"u\"><a xmlns=\"\"/></r>", "<r xmlns:p=\"u\"><p:a/></r>", "<r xmlns:p=\"u\"/>", "<r xmlns:p=\"u\" xmlns:q=\"u\" p:a=\"1\" q:a=\"2\"/>", "<r> &#32; x &#32; </r>", "<r>\u00a0 x \u00a0</r>", "<![CDATA[]]>", "<!--x--><?foo?>", "<r><a/></r>", "<r>a&amp;b&amp;</r>", "<r a=\"\r\n\"/>", "<r/>  ", "<r a=\"&#0;\"/>", "<r/><!--ignored-->text", "<r></r >", "<r/>\ufeff"],true).map(row=>({...row,id:'edge-'+row.id}))];
 const other=await session.load('builder',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Other:any=other.getDefinition('XMLBuilder');
 const domainChecks=[Other!==Builder,new Other().build('<r/>')!==builder.build('<r/>')];
 if(domainChecks.some(v=>!v))throw Error('source class/node isolation');
 session.retire();return {rows,domainChecks};
}

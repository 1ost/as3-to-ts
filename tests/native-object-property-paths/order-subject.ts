// Native counterpart for the complete retained cases.Subject. Its anonymous
// getter is still held by generated declaration admission. Do not count this
// adapter as transpiled output; it is the same provider shape qualified by
// LayaAir's nativePropertyCallOrder twelve-row comparison.
import {registerFlashTypeMetadata} from '__FLASH_METADATA__';
import {registerAS3PropertyTraits} from '__AS3_PROPERTY__';
export class Subject {
 log:string[]=null;failure:object=null;
 get callable():Function {
  this.log.push('get');if(this.failure!=null)throw this.failure;
  const owner=this;
  return function(this:Subject,value:object):object {owner.log.push('call:'+(this===owner));return value;};
 }
}
const empty={variables:[] as never[],accessors:[] as never[],methods:[] as never[],constants:[] as never[]};
registerFlashTypeMetadata(Subject,{name:'cases::Subject',base:'Object',isDynamic:false,isFinal:false,statics:empty,
 instance:{...empty,variables:[{name:'log',type:'Array',declaredBy:'cases::Subject'},{name:'failure',type:'Object',declaredBy:'cases::Subject'}],
 accessors:[{name:'callable',access:'readonly',declaredBy:'cases::Subject'}]}});
registerAS3PropertyTraits(Subject,[{name:'log',kind:'variable',type:{name:'Array',reference:Array}},
 {name:'failure',kind:'variable',type:'Object'},{name:'callable',kind:'accessor',type:'Function'}]);

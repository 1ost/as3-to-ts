package {import containercases.Reader;import flash.display.*;import flash.events.EventDispatcher;import flash.text.TextField;
public class ContainerReferenceProbe {public function snapshot():Object {
 var rows:Array=[];
 var values:Array=[new MovieClip(),new Sprite(),new SpriteChild(),new TextField(),new Shape(),new EventDispatcher(),null,undefined,{},[],7,DisplayObjectContainer.prototype];
 for(var i:int=0;i<values.length;i++){var value:*=values[i],r:Reader=new Reader(value),before:int=r.calls;
  var matches:Boolean=r.test(value),cast:DisplayObjectContainer=r.cast(value);
  rows.push({id:'identity-'+i,value:[matches,cast===value,cast===null,r.calls-before,r.saved===value,r.saved===null]});
  try{var slot:DisplayObjectContainer=r.coerce(value);rows.push({id:'coerce-'+i,value:[slot===value,slot===null]});}
  catch(e:Error){rows.push({id:'coerce-'+i,value:[e.name,e.errorID,e is Error]});}
  before=r.calls;
  try{slot=r.explicit(value);rows.push({id:'explicit-'+i,value:[slot===value,slot===null,r.calls-before]});}
  catch(g:Error){rows.push({id:'explicit-'+i,value:[g.name,g.errorID,g is Error,r.calls-before]});}
  before=r.calls;
  try{slot=r.returned(value);rows.push({id:'return-'+i,value:[slot===value,slot===null,r.calls-before]});}
  catch(f:Error){rows.push({id:'return-'+i,value:[f.name,f.errorID,f is Error,r.calls-before]});}
 }
 return {ready:true,failure:'',observations:rows};
}}}
import flash.display.Sprite;
class SpriteChild extends Sprite {}

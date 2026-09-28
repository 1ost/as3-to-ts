package {import displayctor.Reader;import flash.display.*;import flash.events.EventDispatcher;import flash.text.TextField;
public class DisplayConstructorProbe {public function snapshot():Object {
 var rows:Array=[],values:Array=[new MovieClip(),new Sprite(),new Shape(),new TextField(),new EventDispatcher(),null,undefined,{},[],7,DisplayObject.prototype];
 for(var i:int=0;i<values.length;i++){
  var value:*=values[i];try{var r:Reader=new Reader(value);rows.push({id:"value-"+i,value:[r.saved===value,r.saved===null,r.label]});}
  catch(e:Error){rows.push({id:"value-"+i,value:[e.name,e.errorID]});}
 }
 r=new Reader(null,undefined);rows.push({id:"undefined-label",value:[r.saved===null,r.label]});
 var C:Class=Reader;try{new C();}catch(f:Error){rows.push({id:"missing",value:[f.name,f.errorID]});}
 return {ready:true,failure:"",observations:rows};
}}}

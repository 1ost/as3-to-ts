package {import flash.events.EventDispatcher; public class LocalFieldShadowProbe extends EventDispatcher {
 private var value:String="field";
 private var items:Array=["field-array"];
 private static var count:int;
 private var part:ShadowValue=new ShadowValue(8);
 public var constructorState:Array;
 public function LocalFieldShadowProbe(){super();constructorState=[value];var value:String="ctor";constructorState.push(value,this.value);}
 private function reference():Object {var part:ShadowValue=null;var initial:*=part;part=new ShadowValue(3);return [initial,part.id,this.part.id];}
 private function early():Object {var rows:Array=[];rows.push(value);var value:String="local";rows.push(value,this.value);return rows;}
 private function explicit():Object {var value:String=this.value;value+="-local";return [value,this.value];}
 private function skipped():Object {if(false){var value:String="never";}return [value,this.value];}
 private function loop():Object {var items:Array=null;var rows:Array=[];for each(items in [[1],[2]])rows.push(items[0]);return [rows,items,this.items];}
 private static function staticLocal():Object {LocalFieldShadowProbe.count=17;var count:int=4;count++;return [count,LocalFieldShadowProbe.count];}
 public function snapshot():Object {
  var rows:Array=[];
  rows.push({id:"constructor",value:constructorState});
  rows.push({id:"reference",value:this.reference()});
  rows.push({id:"early-read",value:this.early()});
  rows.push({id:"explicit-field",value:this.explicit()});
  rows.push({id:"skipped-declaration",value:this.skipped()});
  rows.push({id:"array-loop",value:this.loop()});
  rows.push({id:"static-local",value:staticLocal()});
  return {ready:true,failure:"",observations:rows};
 }
}}

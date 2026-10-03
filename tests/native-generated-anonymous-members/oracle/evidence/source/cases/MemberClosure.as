package cases {public class MemberClosure extends ClosureBase {
 private var _loading:Boolean;
 private var _pending:uint;
 private var _values:Object={};
 private var _calls:int;
 private function finish(label:String):void{_calls++;record(label);}
 public function begin(name:String):Function {
  _loading=true;_pending=1;
  return function():void {
   _pending=0;
   try {
    if(!name || !name.length)throw new Error("missing");
    var selected:Object=_values[name];
    if(!selected){selected={name:name};_values[name]=selected;}
    finish("ok:"+selected.name);
   }catch(error:Error){_loading=false;record("error:"+error.message);return;}
   _loading=false;
   record("complete");
  };
 }
 public function state():Array{return [_loading,_pending,_calls,records()];}
 public function value(name:String):Object{return _values[name];}
}}

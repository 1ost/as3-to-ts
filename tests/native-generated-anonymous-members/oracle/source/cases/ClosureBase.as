package cases {public class ClosureBase {
 protected var entries:Array=[];
 public function record(value:String):void{entries.push(value);}
 public function records():Array{return entries.slice();}
}}

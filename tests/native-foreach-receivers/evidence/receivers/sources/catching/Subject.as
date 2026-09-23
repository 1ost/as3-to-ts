package catching {
 public class Subject {
  public var calls:int=0;
  public var items:Array=[11,22,33];
  public function get values():Array {calls++;return items;}
  public function obtain():Array {calls++;return items;}
  public function Subject(mode:int){
   var value:*,source:Array=items;
   if(mode===0){for each(value in source){Journal.rows.push(value);}}
   else if(mode===1){for each(value in obtain()){Journal.rows.push(value);}}
   else if(mode===2){for each(value in values){Journal.rows.push(value);}}
   else if(mode===3){for each(value in source){Journal.rows.push(value);source=[44,55,66];}}
   else if(mode===4){for each(value in source){Journal.rows.push(value);source[1]=77;}}
   else if(mode===5){if(true)for each(value in obtain())Journal.rows.push(value);else Journal.rows.push("wrong");}
   else if(mode===6){if(false)for each(value in obtain())Journal.rows.push(value);else Journal.rows.push("else");}
   else if(mode===7){for each(var number:* in [4,5]){Journal.rows.push(number);}}
   else if(mode===8){var __$nflvObject1:String="object",__$nflvKey1:String="key";for each(value in obtain()){Journal.rows.push(value);}Journal.rows.push(__$nflvObject1+":"+__$nflvKey1);}
   Journal.rows.push("calls:"+calls);
  }
 }
}
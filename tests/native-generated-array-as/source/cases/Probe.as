package cases {
 public class Probe {
  private var calls:int=0;
  private function once(value:*):* { calls++;return value; }
  public function cast(value:*):Array { return value as Array; }
  public function snapshot():Object {
   var rows:Array=[],values:Array=[[1,2],[],null,undefined,"s10",0,false,{length:1},function():void{}];
   for(var i:int=0;i<values.length;i++){
    try{
     var input:*=values[i],local:Array=once(input) as Array;
     rows.push({id:"cast-"+i,value:[local===null,local===input,local is Array,cast(input)===local,(once(input) as Array)===local]});
    }catch(e:Error){rows.push({id:"cast-"+i,value:[e.name,e.errorID]});}
   }
   rows.push({id:"evaluation-count",value:calls});
   var nested:Array=(true ? "text" : null) as Array;
   rows.push({id:"conditional",value:nested===null});
   var count:int=0;
   try {var thrown:Array=(function():*{count++;throw new Error("original");})() as Array;}
   catch(e:Error){rows.push({id:"throw",value:[count,e.message]});}
   return {ready:true,failure:"",observations:rows};
  }
 }
}

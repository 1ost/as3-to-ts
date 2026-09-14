package catching {
 public class Subject {
  public var calls:int=0;
  public var items:Array=[11,22,33];
  public function obtain():Array {calls++;return items;}
  public function Subject(mode:int){
   var value:*;
   if(mode===0){if(true)for each(value in obtain())Journal.rows.push(value) ;else Journal.rows.push("else");}
   else if(mode===1){if(false)for each(value in obtain())Journal.rows.push(value) ;else Journal.rows.push("else");}
   else if(mode===2){if(true)for each(value in obtain())Journal.rows.push(value) /* kept */;else Journal.rows.push("else");}
   else if(mode===3){if(false)for each(value in obtain())Journal.rows.push(value) /* kept */;else Journal.rows.push("else");}
   else if(mode===4){if(true)for each(value in obtain())Journal.rows.push(value)
   ;else Journal.rows.push("else");}
   else if(mode===5){if(false)for each(value in obtain())Journal.rows.push(value)
   ;else Journal.rows.push("else");}
   else if(mode===6){if(true)for each(value in obtain())Journal.rows.push(value) // kept line
   ;else Journal.rows.push("else");}
   else if(mode===7){if(false)for each(value in obtain())Journal.rows.push(value) // kept line
   ;else Journal.rows.push("else");}
   else if(mode===8){if(true)for each(value in obtain())Journal.rows.push(value)
   else Journal.rows.push("else");}
   else if(mode===9){if(false)for each(value in obtain())Journal.rows.push(value)
   else Journal.rows.push("else");}
   else if(mode===10){for each(value in obtain())for each(var inner:* in [7,8])Journal.rows.push(value+":"+inner) /* nested */;}
   else if(mode===11){for each(value in obtain())for(var i:int=0;i<2;i++)Journal.rows.push(value+":"+i) ;}
   else if(mode===12){if(true)for each(value in obtain())if(value===22)Journal.rows.push("middle");else Journal.rows.push(value) /* nested if */;else Journal.rows.push("outer-else");}
   else if(mode===13){var __$nflvObject1:String="o1",__$nflvKey1:String="k1",__$nflvObject2:String="o2",__$nflvKey2:String="k2";for each(value in obtain()){for each(var nested:* in [4,5]){Journal.rows.push(value+":"+nested);}}Journal.rows.push(__$nflvObject1+__$nflvKey1+__$nflvObject2+__$nflvKey2);}
   Journal.rows.push("calls:"+calls);
  }
 }
}

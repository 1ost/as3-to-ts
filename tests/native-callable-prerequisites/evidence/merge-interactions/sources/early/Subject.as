package early {
 public class Subject {
  public var stage:int=1;
  public function Subject(x:Number=2.5,mode:int=0) {
   super();
   Journal.rows.push("base:"+x+":"+mode+":"+arguments.length+":"+arguments[0]);
   if(mode==0){this.stage=2;return;}
   try {
    if(mode==1||mode==2){this.stage=3;return;}
   } finally {
    arguments[0]=99;
    Journal.rows.push("base-finally:"+x+":"+arguments[0]);
    if(mode==2){throw Journal.thrown;}
   }
   throw Journal.thrown;
  }
 }
}

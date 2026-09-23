package early {
 public class Subject {
  public var stage:int=1;
  public function Subject(mode:int=0) {
   super();
   Journal.rows.push("enter:"+mode+":"+this.stage);
   if(mode==1){this.stage=2;return;}
   try {
    if(mode==2){this.stage=3;return;}
    if(mode==3){throw Journal.thrown;}
    if(mode==6){return;}
   } catch(e:*) {
    Journal.rows.push("catch:"+(e===Journal.thrown));
    this.stage=4;return;
   } finally {
    Journal.rows.push("finally:"+this.stage);
    if(mode==4){this.stage=5;}
    if(mode==6){throw Journal.thrown;}
   }
   var f:Function=function():int {return 17;};
   Journal.rows.push("nested:"+f());
   if(mode==5){for(var i:int=0;i<2;i++){if(i==1){this.stage=6;return;}}}
   this.stage=7;
   Journal.rows.push("tail");
  }
 }
}

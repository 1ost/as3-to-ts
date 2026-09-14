package early {
 public class Child extends Subject {
  public var ownStage:int=9;
  public function Child(mode:int=0) {
   super(mode);
   Journal.rows.push("child:"+this.stage+":"+this.ownStage);
   if(mode==1){return;}
   this.ownStage=10;
  }
 }
}

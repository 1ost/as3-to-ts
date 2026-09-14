package early {
 public class Child extends Subject {
  public var ownStage:int=9;
  public function Child(x:Number=4.5,mode:int=0) {
   super(arguments[0],(function(value:int):int {Journal.rows.push("super-nested:"+value);return value;})(mode));
   Journal.rows.push("child:"+x+":"+mode+":"+arguments.length+":"+arguments[0]+":"+this.stage);
   try {this.ownStage=10;return;}
   finally {arguments[0]=88;Journal.rows.push("child-finally:"+x+":"+arguments[0]);}
  }
 }
}

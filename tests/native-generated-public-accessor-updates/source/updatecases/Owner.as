package updatecases {
 public class Owner {
  private var value:int=91;
  private var target:Counter;
  public function Owner(value:Counter){target=value;}
  public function up(value:Counter):Number {return ++value.value;}
  public function post(value:Counter):Number {return value.value++;}
  public function down(value:Counter):Number {return --value.value;}
  public function postDown(value:Counter):Number {return value.value--;}
  public function fieldUp(value:Counter):Number {return ++value.field;}
  public function unsignedUp(value:Counter):Number {return ++value.u;}
  public function unsignedPostDown(value:Counter):Number {return value.u--;}
  public function numberUp(value:Counter):Number {return ++value.n;}
  public function numberPost(value:Counter):Number {return value.n++;}
  public function owned():Number {return ++this.target.value;}
  public function singleton():Number {return ++Counter.inst.value;}
  public function untouched():int {return value;}
 }
}

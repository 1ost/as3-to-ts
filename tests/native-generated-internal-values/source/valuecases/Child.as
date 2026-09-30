package valuecases {
 public class Child extends Holder {
  public function Child(){super();}
  override internal function take(input:Object):void{calls+=10;last=input;}
 }
}

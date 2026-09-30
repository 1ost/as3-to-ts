package compoundcases {
 public class Conversion {
  private var owner:Owner;
  private var next:Counter;
  public function Conversion(owner:Owner,next:Counter){this.owner=owner;this.next=next;}
  public function valueOf():Object {owner.events.push("convert");owner.redirectTo(next);return 3;}
 }
}

package second {
 public class Owner {
  public static function make():Object { return new Item(); }
  public static function type():Class { return Item; }
 }
}
class Item {
 public var label:String="second";
 public function Item() {}
}

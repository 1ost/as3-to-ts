package first {
 public class Owner {
  public static function make():Object { return new Item(); }
  public static function type():Class { return Item; }
 }
}
class Item {
 public var label:String="first";
 public function Item() {}
}

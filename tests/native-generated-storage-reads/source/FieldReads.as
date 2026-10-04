package {
 public class FieldReads {
  private var items:Array;
  private var table:Object;
  private static var shared:Array;
  public var effects:int=0;
  public function reset(values:Array,registry:Object):void {items=values;table=registry;shared=values;effects=0;}
  public function size():uint {return items.length;}
  public function explicitSize():uint {return this.items.length;}
  public function sharedSize():uint {return shared.length;}
  public function explicitSharedSize():uint {return FieldReads.shared.length;}
  public function index(key:int):* {return items[key].value;}
  public function named(key:String):* {return table[key].value;}
  public function arrayEffect():* {return items[markIndex()].value;}
  public function objectEffect():* {return table[markName()].value;}
  public function shadow(items:Array):uint {return items.length;}
  private function markIndex():int {effects++;items=null;return 0;}
  private function markName():String {effects++;table=null;return "entry";}
 }
}

package probe {import flash.events.EventDispatcher;
 public class OwnReceiver extends EventDispatcher {
  private static var _inst:OwnReceiver;
  public var total:int=0;
  public var evaluations:Array=[];
  public var replacement:OwnReceiver;
  public static function install(value:OwnReceiver):void {_inst=value;}
  internal function parseData(value:Object):void {total+=int(value.amount);}
  private function argument(value:Object):Object {evaluations.push("argument");if(replacement!=null)_inst=replacement;return value;}
  public function dispatch(value:Object):void {OwnReceiver._inst.parseData(this.argument(value));}
  public function callback():Function {return OwnReceiver._inst.parseData;}
 }
}
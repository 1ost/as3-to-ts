package {
 import flash.events.ErrorEvent;
 public class TraceSubject {
  private var calls:Array = [];
  public function artwork(event:ErrorEvent):void {
   trace("Collection menu artwork: " + event.text);
  }
  public function scalar(value:*, text:String):void {
   trace("scalar:" + value + ":" + text);
   trace("numbers:" + (1 + 2) + 3 + 4);
   trace("nested:" + (1 + 2));
   trace(("inner:" + value) + 5);
  }
  public function coercion():Array {
   var item:Object = {valueOf:function():Object {calls.push("valueOf");return 7;}, toString:function():String {calls.push("toString");return "seven";}};
   trace("left:" + item);
   trace("middle:" + (item + 1) + ":" + item);
   trace("order:" + mark("a") + mark("b"));
   return calls;
  }
  private function mark(value:String):Object {calls.push(value);return value;}
  public function interrupted():void {
   trace("incomplete:" + fail());
  }
  private function fail():Object {throw new Error("trace interrupted");}
 }
}

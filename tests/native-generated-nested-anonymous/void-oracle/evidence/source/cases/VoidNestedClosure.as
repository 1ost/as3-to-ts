package cases {
 public class VoidNestedClosure {
  private var _calls:int;
  public function schedule(target:Object):void {
   target.next=function():void {
    _calls++;
    target.next=function():void {
     _calls++;
     target.next=function():void {
      _calls++;
      target.next=function():void {
       _calls++;
       target.next=function():void {
        _calls++;
        target.value=_calls;
        target.next=null;
       };
      };
     };
    };
   };
  }
  public function typed():Function {
   return function():Object {
    return function():int {return 4294967297;};
   };
  }
  public function calls():int {return _calls;}
 }
}

package typeprobe {
 public class Subject {
  public static var ticks:int=0;
  public static var external:*=null;
  public var value:*=null;
  public static var order:*= [];
  public function Subject(){}
  public function get read():* {ticks++;order.push("getter");return this.value;}
  public static function receiver():* {ticks++;order.push("receiver");return external;}
  public static function receiverType():String {return typeof receiver().read;}
  public static function readonlyWrite():String {var item:*=new Subject();return typeof (item.read=1);}

  public static function classType():String {return typeof Subject;}
  public static function functionType():String {var f:Function=function():void {};return typeof f;}
  public static function primitives():Array {return [typeof undefined,typeof null,typeof true,typeof false,typeof 1,typeof -1,typeof 1.5,typeof "text",typeof "",typeof [],typeof {}];}
  public static function get chosen():* {ticks++;return Subject;}
  public static function getterType():String {return typeof chosen;}
  public static function effect():* {ticks++;return external;}
  public static function effectType():String {return typeof effect();}
  public static function commaType():String {return typeof (ticks++,Subject);}
  public static function suppliedType():String {return typeof external;}
  public static function missingDynamic():String {var value:*={};return typeof value.missing;}
  public static function missingSealed():String {var value:*=new Subject();return typeof value.missing;}
  public static function nullProperty():String {var value:*=null;return typeof value.missing;}
  public static function undefinedProperty():String {var value:*=undefined;return typeof value.missing;}
  public static function shadowClass():String {var Subject:*=17;return typeof Subject;}
  public static function shadowUndefined():String {var undefined:*=17;return typeof undefined;}
  public static function get thrown():* {ticks++;throw external;}
  public static function throwingType():String {return typeof thrown;}
 }
}

package numeric {
 import flash.utils.ByteArray;
 public class Recorder {
  public static var rows:Array=[];
  public static var failure:Object={};
  public static function argument(label:String,value:*):* {rows.push("evaluate:"+label);return value;}
  public static function fromBits(hex:String):Number {var b:ByteArray=new ByteArray();for(var i:int=0;i<hex.length;i+=2)b.writeByte(parseInt(hex.substr(i,2),16));b.position=0;return b.readDouble();}
  public static function bits(value:Number):String { var b:ByteArray=new ByteArray(); b.writeDouble(value); b.position=0; var result:String=""; while(b.bytesAvailable) { var x:String=b.readUnsignedByte().toString(16); result += x.length<2?"0"+x:x; } return result; }
  public static function record(label:String,a:Number,b:Number,args:Object):void {rows.push(label+":"+bits(a)+":"+bits(b)+":"+args.length+":"+(args.length>0?bits(args[0]):"absent")+":"+(args.length>1?bits(args[1]):"absent"));}
 }
}
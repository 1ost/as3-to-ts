package displayctor {import flash.display.DisplayObject;
public class Reader {
 public var saved:DisplayObject;
 public var label:String;
 public function Reader(value:DisplayObject,label:String="default") { super();this.saved=value;this.label=label; }
}}

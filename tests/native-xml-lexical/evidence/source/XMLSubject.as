package {
 public class XMLSubject {
  private var config:XML;
  private var state:String="private-state";
  public function XMLSubject(value:XML){config=value;}
  public function snapshot():Array {
   var rows:Array=[];
   rows.push(state);
   rows.push(String(config.state));
   rows.push(config.state.length());
   rows.push(String(config.@tag));
   var names:Array=[];
   for each(var entry:XML in config.state) names.push(String(entry.@name));
   rows.push(names);
   return rows;
  }
  public function shadow(config:XML):String {return String(config.state);}
  public function missing():String {return String(config.absent);}
 }
}

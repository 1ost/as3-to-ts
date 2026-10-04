package {
 public class TraversalSubject {
  private var config:XML;
  public function TraversalSubject(value:XML) {config=value;}
  public function rewrite():XML {
   var nodes:XMLList=config.descendants();
   for each(var node:XML in nodes)for each(var attribute:XML in node.attributes()){
    var name:String=String(attribute.name());
    if(name.length>3&&name.substr(-3)=="Key")node.@[name.substr(0,name.length-3)]="translation:"+String(attribute);
   }
   if(config.menuButton.label.length())config.menuButton.label.@url="";
   return config;
  }
  public function count(nodes:XMLList):int {var count:int=0;for each(var node:XML in nodes)count++;return count;}
  public function all():XMLList {return config.descendants();}
  public function attrs():XMLList {return config.attributes();}
  public function write(name:String,value:String):String {return config.@[name]=value;}
  public function name(node:XML):String {return String(node.name());}
  public function writeNested(value:String):void {config.outer.inner.@label=value;}
 }
}

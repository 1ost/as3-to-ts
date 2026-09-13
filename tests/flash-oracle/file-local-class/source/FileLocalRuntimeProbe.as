package {
 import first.Owner;
 import second.Owner;
 import flash.utils.getQualifiedClassName;
 import flash.utils.getDefinitionByName;
 public class FileLocalRuntimeProbe {
  public var result:Array=[];
  public function FileLocalRuntimeProbe() {}
  public function exercise():void {
   var a:Object=first.Owner.make(); var b:Object=second.Owner.make();
   var ca:Class=first.Owner.type(); var cb:Class=second.Owner.type();
   result=[getQualifiedClassName(a),getQualifiedClassName(b),getQualifiedClassName(ca),getQualifiedClassName(cb),
    a is ca,b is ca,b is cb,ca===cb,String(a),String(b),String(ca),String(cb),a.label,b.label];
   try { result.push(a.missing); } catch(error:Error) { result.push(error.name,error.errorID,error.message); }
   try { result.push(getDefinitionByName("FilePrivateNS:Owner::Item")); } catch(error:Error) { result.push(error.name,error.errorID,error.message); }
  }
 }
}

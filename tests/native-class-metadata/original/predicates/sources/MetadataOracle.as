package {
 import flash.display.Sprite;
 import flash.external.ExternalInterface;
 import flash.utils.describeType;
 import review.Subject;
 public class MetadataOracle extends Sprite {
  public function MetadataOracle(){
   var rows:Array=[],failure:String="",value:Subject=new Subject();
   try {
    rows.push(["ordinary-is-Class",Subject.functionCheck()]);
    rows.push(["subject-is-Class",Subject.classCheck()]);
    rows.push(["genuine-is",Subject.isSubject(value)]);
    rows.push(["object-is",Subject.isSubject({})]);
    rows.push(["genuine-as",Subject.asSubject(value)===value]);
    rows.push(["object-as",Subject.asSubject({})===null]);
    rows.push(["class-as",Subject.asClass(Subject)===Subject]);
    rows.push(["ordinary-as",Subject.asClass(function():void {})===null]);
    rows.push(["negative-int",Subject.isInt(-1)]);
    rows.push(["negative-uint",Subject.isUint(-1)]);
    rows.push(["large-int",Subject.isInt(2147483648)]);
    rows.push(["large-uint",Subject.isUint(2147483648)]);
   }catch(error:*){failure=String(error);}
   var result:Object={ready:true,failure:failure,rows:rows,reflection:[describeType(Subject).toXMLString()],instances:[describeType(value).toXMLString()]};
   ExternalInterface.addCallback("snapshot",function():String{return encodeURIComponent(JSON.stringify(result));});
  }
 }
}

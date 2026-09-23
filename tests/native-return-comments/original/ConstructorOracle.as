package {
 import flash.display.Sprite;import flash.external.ExternalInterface;import flash.utils.describeType;import probe.CommentReturn;
 public class ConstructorOracle extends Sprite {
 public function ConstructorOracle(){
 var x:CommentReturn=new CommentReturn(),rows:Array=[];
 function tag(value:*):Object {return {kind:typeof value,value:value===undefined?'undefined':value};}
 function row(name:String):void {try{rows.push({id:name,result:tag(name==='identifier'?x[name]('identity'):x[name]())});}catch(error:*){rows.push({id:name,thrown:tag(error)});}}
 row('compact');
 row('block');
 row('doc');
 row('multiple');
 row('multiline');
 row('lineComment');
 row('newline');
 row('afterComment');
 row('noValue');
 row('number');
 row('identifier');
 row('object');
 row('throwArray');
 row('throwDoc');

 var output:Object={rows:rows,classXML:describeType(CommentReturn).toXMLString(),instanceXML:describeType(x).toXMLString()};
 ExternalInterface.addCallback('snapshot',function():String{return encodeURIComponent(JSON.stringify(output));});
 }} }

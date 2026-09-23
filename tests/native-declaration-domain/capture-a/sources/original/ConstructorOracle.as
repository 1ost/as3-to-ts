package {import flash.display.Sprite;import flash.external.ExternalInterface;import flash.utils.describeType;
import domain.a.Node;import domain.b.Node;import domain.Anchor;import domain.CycleA;import domain.CycleB;
public class ConstructorOracle extends Sprite {public function ConstructorOracle(){
var a:domain.a.Node=new domain.a.Node(),b:domain.b.Node=new domain.b.Node(),anchor:Anchor=new Anchor(),rows=[];
function row(id:String,value:*):void {rows.push({id:id,value:value});}
row("a-default",a.next===null);row("b-default",b.next===null);row("anchor-default",anchor.next===null);row("a-static-default",domain.a.Node.defaultNode===null);row("b-static-default",domain.b.Node.defaultNode===null);
row("a-own-reference",new domain.a.Node(a).next===a);row("b-qualified-reference",new domain.b.Node(b).next===b);row("anchor-same-package",new Anchor(anchor).next===anchor);
row("a-link-own",a.link(a)===a);row("a-link-undefined",a.link(undefined)===null);row("b-link-own",b.link(b)===b);
try{a.link(b);}catch(e:*){row("foreign-write-fails",[e.name,e.errorID,a.next===null]);}
try{b.link(a);}catch(e:*){row("other-domain-write-fails",[e.name,e.errorID,b.next===b]);}
row("Class-identities-distinct",domain.a.Node!==domain.b.Node);
row("cycle-A-publishes-B",CycleA.other===CycleB);row("cycle-B-sees-null-A",CycleB.other===null);
var classes=[domain.a.Node,domain.b.Node,Anchor,CycleA,CycleB],instances=[a,b,anchor,new CycleA(),new CycleB()],reflection=[],instanceXML=[];
for(var i:int=0;i<classes.length;i++){reflection.push(describeType(classes[i]).toXMLString());instanceXML.push(describeType(instances[i]).toXMLString());}
var output={rows:rows,reflection:reflection,instances:instanceXML};ExternalInterface.addCallback("snapshot",function():String{return encodeURIComponent(JSON.stringify(output));});
}}}

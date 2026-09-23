package superprobe {
 public class Leaf extends Middle {
  public function Leaf(){super();}
  override public function selected(flag:Boolean,optional:Boolean=false):String {return "leaf";}
  override public function zero():String {return "leaf-zero";}
  public function run():void {
   Journal.rows.push(super.selected(Journal.mark("arg-first",{}),Journal.mark("arg-second",0)));
   Journal.rows.push(super.selected(true));
   Journal.rows.push(super.selected(true,undefined));
   Journal.rows.push("same:"+(super.inherited()===this));
   Journal.rows.push(super.zero());
   try {super.fail();} catch(caught:*) {Journal.rows.push("failure:"+(caught===Journal.failure));}
   Journal.rows.push("nested:"+super.selected(super.inherited()===this));
   Journal.rows.push("protected-return:"+super.hidden());
   Journal.rows.push("protected-null:"+super.hidden(null));
   try {super.selected(Journal.mark("argument-before-throw",true),Journal.failArgument());}
   catch(argumentError:*) {Journal.rows.push("argument-failure:"+(argumentError===Journal.failure));}
  }
 }
}

package {
 import cases.MediatorBase; import cases.Window; import cases.SpecialWindow;
 public class CastProbe extends MediatorBase {
  private var item:Object=new Window(); private var reads:int=0; private var effects:int=0;
  protected var value:int=100; private var amount:int=200;
  override protected function addToStage():String{return "mediator";}
  private function read():Object{reads++;return item;}
  private function next():int{effects++;return effects;}
  private function replace():int{item=new SpecialWindow();return next();}
  public function snapshot():Object {
   var rows:Array=[];
   rows.push({id:"public-method",value:[Window(read()).addToStage(next()),reads,effects]});
   rows.push({id:"public-field",value:[Window(read()).value,reads,value]});
   Window(read()).value=12;
   rows.push({id:"field-write",value:[Window(item).value,reads,value]});
   rows.push({id:"postfix",value:[Window(read()).value++,Window(item).value,reads]});
   Window(read()).amount=9;
   rows.push({id:"accessor",value:[Window(read()).amount,reads,amount]});
   var first:Function=Window(item).addToStage;
   rows.push({id:"closure-identity",value:first===Window(item).addToStage});
   rows.push({id:"closure-call",value:first(8)});
   rows.push({id:"argument-replaces-storage",value:[Window(read()).addToStage(replace()),reads,effects]});
   rows.push({id:"virtual-dispatch",value:Window(read()).addToStage(next())});
   rows.push({id:"retained-closure",value:first(9)});
   item=null;
   try{Window(read()).addToStage(next());}catch(e:Error){rows.push({id:"null-call",value:[e.name,e.errorID,reads,effects]});}
   item={};
   try{Window(read()).addToStage(next());}catch(e2:Error){rows.push({id:"wrong-cast-before-arguments",value:[e2.name,e2.errorID,reads,effects]});}
   item=undefined;
   try{Window(read()).addToStage(next());}catch(e3:Error){rows.push({id:"undefined-call",value:[e3.name,e3.errorID,reads,effects]});}
   rows.push({id:"own-protected",value:addToStage()});
   return {ready:true,failure:"",observations:rows};
  }
 }
}

package {
 import chain.Link;
 import chain.Leaf;
 import chain.Marker;
 import chain.Sink;
 public class ChainProbe {
  private var _ui:Link=new Link();
  private var reads:int=0;
  private var effects:int=0;
  private var logo:int=99;
  public function get ui():Link {reads++;return _ui;}
  private function next():int {effects++;return effects;}
  private function replace():int {_ui.loadPane.prgLoad=new Marker(31);return next();}
  public function snapshot():Object {
   var rows:Array=[];
   var first:Sink=new Sink(this.ui.loadPane.prgLoad,next());
   rows.push({id:"constructor-chain",value:[first.item.value,first.after,reads,effects]});
   var absent:Marker=this.ui.loadPane.logo;
   rows.push({id:"absent-dynamic",value:[absent===null,reads]});
   rows.push({id:"missing-undefined",value:[this.ui.loadPane.logo===undefined,reads]});
   var dynamic:Object=_ui.loadPane;dynamic.logo=new Marker(11);
   absent=this.ui.loadPane.logo;
   rows.push({id:"present-dynamic",value:[absent.value,reads]});
   var local:Link=_ui;
   rows.push({id:"local-chain",value:local.loadPane.prgLoad.value});
   var before:Marker=_ui.loadPane.prgLoad;
   _ui.loadPane.prgLoad=new Marker(19);
   rows.push({id:"changed-storage",value:[this.ui.loadPane.prgLoad.value,before.value,reads]});
   var saved:Leaf=_ui.loadPane;
   _ui.loadPane=null;
   try{first=new Sink(this.ui.loadPane.prgLoad,next());}
   catch(e:Error){rows.push({id:"null-leaf",value:[e.name,e.errorID,reads,effects]});}
   _ui.loadPane=saved;
   var savedLink:Link=_ui;_ui=null;
   try{first=new Sink(this.ui.loadPane.prgLoad,next());}
   catch(e2:Error){rows.push({id:"null-link",value:[e2.name,e2.errorID,reads,effects]});}
   _ui=savedLink;
   dynamic.logo={};
   try{absent=this.ui.loadPane.logo;}
   catch(e3:Error){rows.push({id:"failed-coercion",value:[e3.name,e3.errorID,absent.value,reads]});}
   dynamic.logo=null;
   first=new Sink(this.ui.loadPane.logo,next());
   rows.push({id:"null-argument",value:[first.item===null,first.after,reads,effects]});
   first=new Sink(this.ui.loadPane.prgLoad,replace());
   rows.push({id:"arguments-retain-receiver",value:[first.item.value,_ui.loadPane.prgLoad.value,first.after,reads,effects]});
   return {ready:true,failure:"",observations:rows};
  }
 }
}

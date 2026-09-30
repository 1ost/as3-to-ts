package {import flash.events.EventDispatcher; public class BooleanLogicalProbe extends EventDispatcher {
 public var calls:Array=[];
 public var constructorState:Array;
 public function BooleanLogicalProbe(){super();var initial:Boolean=false;var result:*=initial ||= "ctor";constructorState=[initial,result,typeof result];}
 private function rhs(label:String,value:*):* {calls.push(label);return value;}
 private function explode():* {calls.push("throw");throw new Error("boom");}
 public function snapshot():Object {
  var rows:Array=[],flag:Boolean=false,result:*,input:*,before:int=0;
  rows.push({id:"constructor",value:constructorState});
  for each(input in [false,true,0,1,"","yes",null,undefined,[],{},NaN]) {
   flag=false;before=calls.length;result=(flag ||= this.rhs("or",input));
   rows.push({id:"or-taken-"+rows.length,value:[flag,result,typeof result,calls.length-before]});
   flag=true;before=calls.length;result=(flag &&= this.rhs("and",input));
   rows.push({id:"and-taken-"+rows.length,value:[flag,result,typeof result,calls.length-before]});
  }
  flag=true;before=calls.length;result=(flag ||= this.rhs("skip-or",0));rows.push({id:"or-skip",value:[flag,result,calls.length-before]});
  flag=false;before=calls.length;result=(flag &&= this.rhs("skip-and",1));rows.push({id:"and-skip",value:[flag,result,calls.length-before]});
  flag=false;var caught:String="";try{flag ||= this.explode();}catch(error:Error){caught=error.message;}rows.push({id:"or-throw",value:[flag,caught]});
  flag=true;caught="";try{flag &&= this.explode();}catch(other:Error){caught=other.message;}rows.push({id:"and-throw",value:[flag,caught]});
  flag=false;result=(flag ||= (flag=true,""));rows.push({id:"or-reentrant",value:[flag,result]});
  flag=true;result=(flag &&= (flag=false,"nonempty"));rows.push({id:"and-reentrant",value:[flag,result]});
  var second:Boolean=false;flag=false;result=(flag ||= (second ||= this.rhs("nested",1)));rows.push({id:"nested",value:[flag,second,result]});
  flag=false;before=calls.length;for each(input in [false,false,true,false]){flag ||= this.rhs("loop",input);}rows.push({id:"hero-loop",value:[flag,calls.length-before]});
  flag=false;flag ||= "raw";before=calls.length;result=(flag ||= this.rhs("raw-skip-or",0));rows.push({id:"raw-or-skip",value:[flag,result,typeof flag,calls.length-before]});
  flag=true;flag &&= "";before=calls.length;result=(flag &&= this.rhs("raw-skip-and",1));rows.push({id:"raw-and-skip",value:[flag,result,typeof flag,calls.length-before]});
  flag=false;flag ||= "raw";flag=1;rows.push({id:"ordinary-restores-boolean",value:[flag,typeof flag]});
  return {ready:true,failure:"",observations:rows};
 }
}}

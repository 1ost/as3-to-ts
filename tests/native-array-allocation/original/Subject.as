package{public class Subject{
 public var field:Array=[1,,[2]]; public static var fixed:Array=[3]; public var value:Array; public var count:int=0;
 public function Subject(mode:int){switch(mode){
 case 0:value=field;break;
 case 1:value=Subject.fixed;break;
 case 2:value=[field===field,field===Subject.fixed];break;
 case 3:var token:Object={};value=[token===([token])[0]];break;
 case 4:var n:int=0;value=[n++,[n++],n];break;
 case 5:value=make();break;
 case 6:value=[make()===make()];break;
 case 7:try{value=[fail(),later()];}catch(error:*){value=[error,count];}break;
 case 8:var __as3_source_arrayLiteral:Array=[9];value=[__as3_source_arrayLiteral,[]];break;
 case 9:value=[Subject.fixed===Subject.fixed,field===make()];break;
 }}
 public function make():Array{return [4,,[5]];}
 public function fail():*{count++;throw 'stop';}
 public function later():*{count++;return 8;}
}}
package probe {public class Placement {public static var hook:*;public static var staticValue:*= "s"+[1,2];public var state:*="field";public var field:*= "f"+Placement.hook;public var constructed:*;public function Placement(value:*){super();this.constructed="c"+value;}
public function case0(value:*):*{return "x"+value;}
public function case1(value:*):*{var s:String="x";return s+value;}
public function case2(value:*):*{var s:String="x"+value;return s;}
public function case3(value:*,other:*):*{return "x"+value+other;}
public function case4(value:*,other:*):*{return value-1+other;}
public function case5(value:*):*{var left:*="x";var n:Number=left+value-1;return n!==n;}
public function case6():*{var n:int=0;return ["x"+(n=3.9),n];}
public function case7(value:*):*{return 2+("x"+value);}
public function case8(value:*):*{var __as3_source_add:*=4;return "x"+value+__as3_source_add;}
public function case9(value:*):*{return "x" /*left*/ + // right operand
 value;}
public function case10(value:*):*{var text:*="3";return +text+value;}
public function case11():*{return this.field;}
public function case12():*{return this.constructed;}
public function case13():*{return Placement.staticValue;}
public function case14(value:*):*{var s:*="x";var r:*=s+=value;return [r,s];}
public function case15(s:*,value:*):*{return s+=value;}
public function case16(value:*):*{var s:*="x";var r:*=s+=(s="changed",value);return [r,s];}
public function case17(value:*):*{var s:*="x";try{s+=(s="changed",value);}catch(e:*){return [e,s];}return "no throw";}
public function case18(s:*,value:*):*{try{s+=(s="changed",value);}catch(e:*){return [e,s];}return "no throw";}
public function case19(value:*):*{var s:*="outer";var inside:*;try{throw "x";}catch(s:*){var r:*=s+=value;inside=[r,s];}return [inside,s];}
public function case20(value:*):*{var inside:*;try{throw "x";}catch(caught:*){inside=caught+=value;}return inside;}
public function case21(value:*):*{var state:*="x";var r:*=state+=value;return [r,state,this.state];}
public function case22(state:*,value:*):*{var r:*=state+=value;return [r,state,this.state];}
public function case23():*{var s:*="outer";var inside:*;try{throw "x";}catch(s:*){s="changed";inside=s;}return [inside,s];}
public function case24(value:*):*{var s:*="outer";var inside:*;try{throw "x";}catch(s:*){var r:*=s+=(s="changed",value);inside=[r,s];}return [inside,s];}
public function case25(value:*):*{var s:*="outer";var inside:*;try{throw "x";}catch(s:*){try{s+=(s="changed",value);}catch(e:*){inside=[e,s];}}return [inside,s];}
public function case26(s:*,value:*):*{var inside:*;try{throw "x";}catch(s:*){var r:*=s+=value;inside=[r,s];}return [inside,s];}
public function case27():*{var inside:*;try{throw "x";}catch(caught:*){caught="changed";inside=caught;}return inside;}
public function case28(value:*):*{var s="x";var r=s+=value;return [r,s];}
public function case29(s:*,value:*):*{return s+=value;}
public function case30(other:*):*{var value:*="outer";var inside:*;try{throw "x";}catch(value:*){var r:*=value+=other;inside=[r,value];}return [inside,value];}
}}

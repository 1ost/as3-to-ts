package probe { public class TypedLocals { public var marker:*=9;private var receiverMember:*=11;public var constructorState:*;public function TypedLocals(){super();var i:int=3.9;var n:Number;this.constructorState=[i,TypedLocals.kind(n)];} public static function kind(v:*):*{if(v!==v)return "NaN";if(v===undefined)return "undefined";if(v===null)return "null";if(v===0 && 1/v<0)return "-0";return v;}
public function case0():*{var before:*=[TypedLocals.kind(n),i,u,b,s,o,a];var n:Number;var i:int;var u:uint;var b:Boolean;var s:String;var o:Object;var a:Array;return [before,[TypedLocals.kind(n),i,u,b,s,o,a]];}
public function case1(flag:*):*{if(flag){var n:Number=3;var s:String="x";var i:int=2;}return [TypedLocals.kind(n),s,i];}
public function case2(value:*):*{var log:*=[];log.push(i,TypedLocals.kind(n));var i:int=(log.push("i"),3.9);log.push(i,TypedLocals.kind(n));var n:Number=(log.push("n"),value);return [log,i,n];}
public function case3():*{{var n:int=1;}if(true){n=2;var s:String="shared";}return [n,s];}
public function case4():*{var result:*= [];for(var i:int=0;i<3;i++){var n:int;result.push(n);n++;}return [result,n,i];}
public function case5(value:*):*{var n:Number=value;var i:int=value;var u:uint=-1;var b:Boolean="";return [n,i,u,b];}
public function case6(first:*,second:*):*{var i:int=7;var r:*=i=first;var q:*=i=second;return [r,q,i];}
public function case7(value:*):*{var n:Number=1;var r:*=n=value;return [r===value,n];}
public function case8(value:*):*{var s:String="old";var r:*=s=value;return [r===value,s];}
public function case9():*{var o:Object={};var r:*=o=undefined;return [TypedLocals.kind(r),TypedLocals.kind(o)];}
public function case10():*{var s:String="x";var r:*=s=undefined;var before:*=TypedLocals.kind(s);var q:*=s=null;return [TypedLocals.kind(r),before,TypedLocals.kind(q),TypedLocals.kind(s)];}
public function case11():*{var a:Array=[1];var r:*=a=undefined;var before:*=TypedLocals.kind(a);var q:*=a=null;return [TypedLocals.kind(r),before,TypedLocals.kind(q),TypedLocals.kind(a)];}
public function case12(value:*):*{var o:Object=value;var same:*=o===value;o=3;var before:*=o;o="text";return [same,before,o];}
public function case13(value:*):*{var a:Array=value;var r:*=a=value;return [a===value,r===value];}
public function case14(value:*,inspect:*):*{var a:Array=[1];var old:*=a;try{a=value;}catch(e:*){return [inspect.read(e,"name"),inspect.read(e,"errorID"),a===old];}return "no error";}
public function case15(value:*):*{var b:Boolean=value;return b;}
public function case16(value:*):*{var i:int=0;var n:Number=0;var r:*=i=n=value;return [r===value,i,n];}
public function case17(value:*):*{var i:int=value,s:String=value,n:Number=value;return [i,s,n];}
public function case18(value:*,inspect:*):*{var n:Number=9;try{n=value;}catch(e:*){return [inspect.read(e,"errorID"),n];}return "no error";}
public function case19(value:*):*{try{var n:Number=value;}catch(e:*){}return TypedLocals.kind(n);}
public function case20():*{var i:int;var r:*= [];i=2147483648;r.push(i);i=4294967297;r.push(i);i=-2147483649;r.push(i);i=NaN;r.push(i);return r;}
public function case21():*{var u:uint;var r:*= [];u=-1;r.push(u);u=4294967296;r.push(u);u=-4294967297;r.push(u);u=NaN;r.push(u);return r;}
public function case22():*{var i:int=2147483647;var a:*=++i;var b:*=i;i=2147483647;var c:*=i++;return [a,b,c,i];}
public function case23():*{var i:int=-2147483648;var a:*=--i;var b:*=i;i=-2147483648;var c:*=i--;return [a,b,c,i];}
public function case24():*{var u:uint=4294967295;var a:*=++u;var b:*=u;u=4294967295;var c:*=u++;return [a,b,c,u];}
public function case25():*{var u:uint=0;var a:*=--u;var b:*=u;u=0;var c:*=u--;return [a,b,c,u];}
public function case26(suffix:*):*{var i:int=2147483647;var a:*=i+=1;var b:*=i;i=3;var c:*=i/=2;var d:*=i;i=3;var e:*=i+=suffix;return [a,b,c,d,e,i];}
public function case27():*{var u:uint=0;var a:*=u-=1;var b:*=u;u=4294967295;var c:*=u+=1;return [a,b,c,u];}
public function case28(value:*):*{var n:int=3;var r:*=n+=value;return [r,n];}
public function case29(value:*,inspect:*):*{var n:int=3;try{n+=value;}catch(e:*){return [inspect.read(e,"errorID"),n];}return "no error";}
public function case30():*{var n:Number=-0;var r:*=n++;return [TypedLocals.kind(r),TypedLocals.kind(n)];}
public function case31():*{var n:int=7;var inside:*;try{throw "caught";}catch(n:*){inside=n;}return [inside,n];}
public function case32():*{try{throw "caught";}catch(e:*){var i:int=3.9;}return i;}
public function case33():*{var a:Array=[];var cursor:*=0;while(cursor<3){var index:Number;a[index=cursor++]=index;}return [a,index,cursor];}
public function case34():*{var values:Array=[10,20,30];var count:int=values.length;var result:Array=[];while(--count>-1){var value:Number;value=values[count];result.push(value);}return [result,count,value];}
public function case35(value:*):*{var n:Number=value;var i:int=value;var u:uint=value;var b:Boolean=value;var before:*= [TypedLocals.kind(n),i,u,b];value=null;n=value;i=value;u=value;b=value;return [before,[TypedLocals.kind(n),i,u,b]];}
public function case36(value:*,inspect:*):*{var s:String="old";try{s=value;}catch(e:*){return [inspect.read(e,"errorID"),s];}return "no error";}
public function case37():*{var i:int=-1;var a:*=i>>>=1;var u:uint=4294967295;var b:*=u<<=1;return [a,i,b,u];}
public function case38(flag:*):*{while(flag){var n:Number=8;var i:int=7;}return [TypedLocals.kind(n),i];}
public function case39():*{var i:int=2;var i:int;var n:Number=5;var n:Number;return [i,n];}
public function case40(value:*):*{var n:int=3;var r:*=n+=(n=20,value);return [r,n];}
public function case41(value:*,inspect:*):*{var n:int=3;try{n+=(n=20,value);}catch(e:*){return [inspect.read(e,"errorID"),n];}return "no error";}
public function case42(value:*):*{var r:*=i=value;var i:int;return [r,i];}
public function case43():*{var box:Object={receiverMember:3};box.receiverMember=4;return [box.receiverMember,this.receiverMember];}
public function case44():*{var marker:Object={value:6};marker.value=8;return [marker.value,this.marker];}
public function case45():*{return this.constructorState;}
public function case46():*{var n:Number=12;var a:*=n*=2;var b:*=n-=3;var c:*=n%=4;var i:int=9;var d:*=i&=3;var e:*=i|=4;var f:*=i^=6;var g:*=i>>=1;return [a,b,c,n,d,e,f,g,i];}
}}

package probe { public class PlanSubject {
 public function fail(value:*):Number {throw value;}
 public function defaults(a:*=0,b:*=true,c:*=null,d:*=undefined,e:*='text'):* {return [a,b,c,d,e];}
 public function negative(n:Number=-0,b:Boolean=false):* {return [1/n===-Infinity,b];}
 public function number(value:*):Number {return/*return prefix*/value;}
} }

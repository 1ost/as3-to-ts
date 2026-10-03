package {
 import flash.utils.Timer;
 public class TimerOracle {
  public function snapshot():Object {
   var timer:Timer=new Timer(60000,2),s:TimerSubject=new TimerSubject(timer),rows:Array=[];
   s.begin();rows.push({id:"field-start",value:timer.running});
   s.end();rows.push({id:"field-stop",value:timer.running});
   s.begin();s.clear();rows.push({id:"field-reset",value:[timer.running,timer.currentCount]});
   s.parameter(timer);rows.push({id:"parameter",value:[timer.running,timer.currentCount]});
   s.local();rows.push({id:"local",value:timer.running});
   var a:Array=s.closures(),b:Array=s.closures();rows.push({id:"closure-identity",value:[a[0]===b[0],a[1]===b[1],a[2]===b[2]]});
   a[0].call({});rows.push({id:"closure-start",value:timer.running});
   a[1].apply({},[]);rows.push({id:"closure-stop",value:timer.running});
   a[0]();a[2]();rows.push({id:"closure-reset",value:[timer.running,timer.currentCount]});
   rows.push({id:"private",value:s.own()});
   var nil:TimerSubject=new TimerSubject(null);
   try {nil.begin();}catch(e:Error){rows.push({id:"null-call",value:[e.name,e.errorID]});}
   try {nil.closures();}catch(e:Error){rows.push({id:"null-get",value:[e.name,e.errorID]});}
   s.intrinsic();rows.push({id:"intrinsic",value:timer.running});
   try {s.parameter(null);}catch(e:Error){rows.push({id:"null-parameter",value:[e.name,e.errorID]});}
   var C:Class=TimerSubject;
   try {new C({});}catch(e:Error){rows.push({id:"invalid-constructor",value:[e.name,e.errorID]});}
   return {ready:true,failure:"",observations:rows};
  }
 }
}

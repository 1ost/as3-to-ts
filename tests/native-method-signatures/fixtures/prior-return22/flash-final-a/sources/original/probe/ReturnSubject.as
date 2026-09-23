package probe {
 public class ReturnSubject {
  public var value:*;
  public var marker:String='initial';
  public function numberPlain(v:*):Number {Journal.add('body');return v;}
  public function numberFinally(v:*):Number {try{Journal.add('try');return v;}finally{Journal.add('finally:'+marker);}Journal.add('unreachable');return 0;}
  public function numberCatch(v:*):Number {try{Journal.add('try');return v;}catch(e:Error){Journal.add('catch:'+e.errorID);return 9;}Journal.add('unreachable');return 0;}
  public function numberCatchFinally(v:*):Number {try{Journal.add('try');return v;}catch(e:Error){Journal.add('catch:'+e.errorID);return 9;}finally{Journal.add('finally:'+marker);}Journal.add('unreachable');return 0;}
  public function numberFinallyReturn(v:*,other:*):Number {try{Journal.add('try');return v;}finally{Journal.add('finally');return other;}}
  public function numberFinallyThrow(v:*):Number {try{Journal.add('try');return v;}finally{Journal.add('finally');throw new Error('finally',8001);}}
  public function stringFinally(v:*):String {try{Journal.add('try');return v;}finally{Journal.add('finally:'+marker);}Journal.add('unreachable');return '';}
  public function stringCatchFinally(v:*):String {try{Journal.add('try');return v;}catch(e:Error){Journal.add('catch:'+e.errorID);return 'caught';}finally{Journal.add('finally:'+marker);}Journal.add('unreachable');return '';}
  public function referenceFinally(v:*):ReturnSubject {try{Journal.add('try');return v;}finally{Journal.add('finally:'+marker);}Journal.add('unreachable');return null;}
  public function referenceCatchFinally(v:*):ReturnSubject {try{Journal.add('try');return v;}catch(e:Error){Journal.add('catch:'+e.errorID);return null;}finally{Journal.add('finally:'+marker);}Journal.add('unreachable');return null;}
  public function get numeric():Number {try{Journal.add('getter:try');return value;}finally{Journal.add('getter:finally:'+marker);}Journal.add('unreachable');return 0;}
  public function get caughtNumeric():Number {try{Journal.add('getter:try');return value;}catch(e:Error){Journal.add('getter:catch:'+e.errorID);return 9;}finally{Journal.add('getter:finally:'+marker);}Journal.add('unreachable');return 0;}
 }
}

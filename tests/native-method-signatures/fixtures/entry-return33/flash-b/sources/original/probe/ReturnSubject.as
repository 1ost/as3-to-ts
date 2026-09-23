package probe {
 public class ReturnSubject {
  public var journal:*;
  public function ReturnSubject(j:*) {journal=j;}
  public function number(v:*):Number {journal.push('number:body');return v;}
  protected function boolean(v:*):Boolean {journal.push('boolean:body');return v;}
  private function finish(v:*):void {journal.push('void:body');if(v)return;journal.push('void:fallthrough');}
  public function numberFinally(v:*):Number {try{journal.push('try');return v;}finally{journal.push('finally');}return 0;}
  public function booleanFinally(v:*):Boolean {try{journal.push('boolean:try');return v;}finally{journal.push('boolean:finally');}return false;}
  public function numberCatch(v:*):Number {try{journal.push('try');return v;}catch(e:*){journal.push('catch');return 19;}return 0;}
  public function finalReplacement(v:*,other:*):Number {try{journal.push('try');return v;}finally{journal.push('finally:replacement');return other;}}
  public function pick(n:*):* {if(n=='boolean')return boolean;if(n=='void')return finish;return number;}
 }
}

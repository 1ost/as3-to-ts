package probe { public class OverrideBase {
 public var journal:*;public function OverrideBase(j:*){journal=j;}
 public function renderTime(n:Number,b:Boolean=false):void {journal.push('base:'+n+':'+b);}
 protected function enabled(v:Boolean=true):Boolean {journal.push('base:enabled');return v;}
 public function pick():* {return enabled;}
} }

package probe { public class OverrideChild extends OverrideBase {
 public function OverrideChild(j:*){super(j);}
 override public function renderTime(n:Number,b:Boolean=false):void {journal.push('child:'+n+':'+b);super.renderTime(n,b);}
 override protected function enabled(v:Boolean=true):Boolean {journal.push('child:enabled');return super.enabled(v);}
} }

package adversary {
 public class FailureLeaf extends Root {
 public var ready:int=9; public var self:*=this; public function FailureLeaf(){super();} override public function watch():void { throw this; }
 }
}

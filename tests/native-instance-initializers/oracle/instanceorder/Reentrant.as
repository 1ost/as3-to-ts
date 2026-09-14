package instanceorder {
    public class Reentrant extends Base {
        public var value:int = Journal.recurse(this);
        public function Reentrant() { super(); Journal.rows.push("reentrant:body:" + value); }
        override public function inspect():String { return "reentrant:" + value; }
    }
}

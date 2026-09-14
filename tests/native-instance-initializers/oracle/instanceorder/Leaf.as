package instanceorder {
    public class Leaf extends Implicit {
        public var leaf:int = Journal.mark("leaf:field");
        public function Leaf() { super(); Journal.rows.push("leaf:body"); }
        override public function inspect():String { return "leaf:" + leaf + ":" + value; }
    }
}

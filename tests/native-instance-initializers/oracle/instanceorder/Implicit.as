package instanceorder {
    public class Implicit extends Base {
        public var value:int = Journal.mark("implicit:field");
        public function Implicit() { Journal.rows.push("implicit:body"); }
        override public function inspect():String { return "implicit:" + value; }
    }
}

package callorder {
    public class Plain {
        public var field:int = Journal.mark("plain:field");
        public function Plain(value:int) {Journal.rows.push("plain:" + value);}
    }
}

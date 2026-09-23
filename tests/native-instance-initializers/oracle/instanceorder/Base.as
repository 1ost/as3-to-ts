package instanceorder {
    public class Base {
        public var baseField:int = Journal.mark("base:field");
        public function Base(argument:int = 0) {
            Journal.rows.push("base:constructor:" + argument + ":" + inspect());
        }
        public function inspect():String { return "base"; }
    }
}

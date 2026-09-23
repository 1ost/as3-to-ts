package callorder {
    public class Subject extends Base {
        public var field:int = Journal.mark("field");
        public function Subject(value:uint, optional:int=3) {
            Journal.rows.push("ctor:" + value + ":" + optional + ":" + arguments.length + ":" + (arguments[0] === value));
            super(value,optional);
        }
        override public function describe():String {return "subject:" + field;}
    }
}

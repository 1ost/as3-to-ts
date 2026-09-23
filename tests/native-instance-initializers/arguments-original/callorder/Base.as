package callorder {
    public class Base {
        public function Base(value:uint, optional:int) {
            Journal.rows.push("base:" + value + ":" + optional + ":" + arguments.length + ":" + describe());
        }
        public function describe():String {return "base";}
    }
}

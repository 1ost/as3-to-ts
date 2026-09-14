package instanceorder {
    public class Journal {
        public static var rows:Array = [];
        public static var failure:Object = {message:"sentinel"};
        public static var leaked:Array = [];
        public static var baseLeaked:Object;
        public static var nested:Reentrant;
        public static var depth:int = 0;
        public static function mark(label:String):int { rows.push(label); return 7; }
        public static function observe(value:Object):int {
            rows.push("observe:" + value.first + ":" + value.later + ":" + value.unsetInt + ":" + value.unsetNumber + ":" + value.unsetBoolean + ":" + (value.unsetObject === null) + ":" + (value.unsetAny === undefined));
            return 11;
        }
        public static function fail(value:Object):int {
            leaked.push(value); rows.push("field-failure:throw:" + value.ready); throw failure;
        }
        public static function recurse(value:Object):int {
            rows.push("reentrant:field:" + depth + ":" + value.value);
            if (depth === 0) { depth++; nested = new Reentrant(); depth--; }
            rows.push("reentrant:field-return:" + depth); return depth + 10;
        }
    }
}

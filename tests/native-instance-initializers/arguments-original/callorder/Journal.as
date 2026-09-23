package callorder {
    public class Journal {
        public static var rows:Array = [];
        public static var failure:Object = {message:"sentinel"};
        public static function mark(value:String):int {rows.push(value);return 7;}
        public static function argument(value:*):* {rows.push("argument");return value;}
    }
}

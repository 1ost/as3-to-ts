package instanceorder {
    public class Explicit extends Base {
        public var first:int = Journal.observe(this);
        public var later:int = Journal.mark("explicit:later");
        public var self:Object = this;
        public var unsetInt:int;
        public var unsetNumber:Number;
        public var unsetBoolean:Boolean;
        public var unsetObject:Object;
        public var unsetAny:*;
        public function Explicit() {
            Journal.rows.push("explicit:before-super");
            super(Journal.mark("explicit:super-argument"));
            Journal.rows.push("explicit:after-super");
        }
        override public function inspect():String {
            return "explicit:" + first + ":" + later + ":" + (self === this);
        }
    }
}

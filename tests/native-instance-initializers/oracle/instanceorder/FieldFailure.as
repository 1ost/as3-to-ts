package instanceorder {
    public class FieldFailure extends Base {
        public var ready:int = Journal.mark("field-failure:ready");
        public var value:int = Journal.fail(this);
        public function FieldFailure() { super(); Journal.rows.push("field-failure:body"); }
    }
}

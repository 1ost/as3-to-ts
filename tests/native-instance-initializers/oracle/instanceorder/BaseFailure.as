package instanceorder {
    public class BaseFailure extends ThrowingBase {
        public var ready:int = Journal.mark("base-failure:field");
        public function BaseFailure() { super(); Journal.rows.push("base-failure:body"); }
    }
}

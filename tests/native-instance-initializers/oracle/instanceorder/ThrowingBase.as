package instanceorder {
    public class ThrowingBase {
        public function ThrowingBase() {
            Journal.baseLeaked = this;
            Journal.rows.push("throwing-base:constructor:" + Object(this).ready);
            throw Journal.failure;
        }
    }
}

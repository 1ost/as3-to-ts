package {
    import flash.display.Sprite;
    import flash.external.ExternalInterface;
    import instanceorder.*;
    public class InstanceOracle extends Sprite {
        public function InstanceOracle() {
            Journal.rows.push("explicit:start");
            var explicit:Explicit = new Explicit();
            Journal.rows.push("explicit:end:" + (explicit.self === explicit));
            Journal.rows.push("implicit:start");
            new Implicit();
            Journal.rows.push("implicit:end");
            Journal.rows.push("leaf:start");
            new Leaf();
            Journal.rows.push("leaf:end");
            for (var i:int = 0; i < 2; i++) {
                Journal.rows.push("field-failure:start:" + i);
                try { new FieldFailure(); }
                catch (fieldError:*) { Journal.rows.push("field-failure:caught:" + (fieldError === Journal.failure)); }
            }
            Journal.rows.push("field-failure:fresh:" + (Journal.leaked[0] !== Journal.leaked[1]));
            Journal.rows.push("base-failure:start");
            try { new BaseFailure(); }
            catch (baseError:*) { Journal.rows.push("base-failure:caught:" + (baseError === Journal.failure)); }
            Journal.rows.push("base-failure:leaked:" + Journal.baseLeaked.ready + ":" + (Journal.baseLeaked is BaseFailure));
            Journal.rows.push("reentrant:start");
            var outer:Reentrant = new Reentrant();
            Journal.rows.push("reentrant:end:" + outer.value + ":" + Journal.nested.value + ":" + (outer !== Journal.nested));
            ExternalInterface.addCallback("snapshot", function():String {
                return encodeURIComponent(JSON.stringify(Journal.rows));
            });
        }
    }
}

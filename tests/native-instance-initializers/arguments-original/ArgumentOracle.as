package {
    import flash.display.Sprite;
    import flash.external.ExternalInterface;
    import callorder.*;
    public class ArgumentOracle extends Sprite {
        public function ArgumentOracle() {
            var cls:Class = Subject;
            for each (var args:Array in [[], [5], [4294967297, -1.75], [1,2,3]]) {
                Journal.rows.push("attempt:" + args.length);
                try {
                    if (args.length === 0) new cls();
                    else if (args.length === 1) new cls(args[0]);
                    else if (args.length === 2) new cls(args[0], args[1]);
                    else new cls(args[0], args[1], args[2]);
                } catch (error:Error) { Journal.rows.push("arity-error:" + error.errorID); }
            }
            var convert:Object = {valueOf:function():Number {Journal.rows.push("coerce"); return 4294967297;}};
            Journal.rows.push("conversion:start");
            var subject:Object = new cls(Journal.argument(convert), Journal.argument(-1.75));
            Journal.rows.push("identity:" + (subject.constructor === Subject) + ":" + (subject is Subject) + ":" + (subject is Base));
            var detached:Function = subject.describe;
            Journal.rows.push("bound:" + (detached === subject.describe) + ":" + detached.call({}));
            var failure:Object = {valueOf:function():Number {Journal.rows.push("coerce-throw"); throw Journal.failure;}};
            try { new cls(failure); } catch (caught:*) { Journal.rows.push("coerce-failure:" + (caught === Journal.failure)); }
            Journal.rows.push("explicit-undefined");
            new cls(5,undefined);
            cls = Plain;
            Journal.rows.push("plain-extra");
            try {new cls(1,2);} catch (plainError:Error) {Journal.rows.push("plain-error:" + plainError.errorID);}
            ExternalInterface.addCallback("snapshot", function():String {return encodeURIComponent(JSON.stringify(Journal.rows));});
        }
    }
}

package probe {
    import com.greensock.TweenMax;

    // Wildcard handles intentionally isolate call routing from the still-held
    // TweenMax typed-local/source-Class conversion boundary.
    public class QueryMigration {
        public static function run():Array {
            var target:Object = {x:0};
            var first:* = TweenMax.to(target, 1, {x:1});
            var second:* = TweenMax.to(target, 1, {x:2});
            var found:Array = TweenMax.getTweensOf(target);
            var ordered:Boolean = found[0] === second && found[1] === first;
            found[0].kill();
            found[1].kill();
            return [
                {id:"query-newest-first", value:ordered},
                {id:"snapshot-kill-all", value:TweenMax.getTweensOf(target).length}
            ];
        }
        public static function query(target:Function):Array {
            return TweenMax.getTweensOf(target());
        }
    }
}

package {
    public class CompileDefinitionsProbe {
        public var value:String = "base";
        public function CompileDefinitionsProbe() {
            CONFIG::enabled /* original compiler guard */ {
                var enabledText:String = ":enabled";
                value += enabledText;
                CONFIG::nested { value += ":nested"; }
                CONFIG::disabled { var nestedMissing:MissingInstrumentation; }
            }
            CONFIG::disabled {
                var missing:MissingInstrumentation;
                value = missing.value;
            }
            CONFIG::enabled { value += enabledText; }
            value += ":tail";
        }
        public function run():String {
            CONFIG::enabled { value += ":run"; }
            return value;
        }
    }
}

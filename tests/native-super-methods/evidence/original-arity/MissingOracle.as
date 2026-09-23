package {import flash.display.Sprite; public class MissingOracle extends Sprite {public function MissingOracle(){new Bad().run();}}}
import superprobe.Base;class Bad extends Base {public function run():void {super.selected();}}

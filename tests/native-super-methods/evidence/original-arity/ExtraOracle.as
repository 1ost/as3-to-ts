package {import flash.display.Sprite; public class ExtraOracle extends Sprite {public function ExtraOracle(){new Bad().run();}}}
import superprobe.Base;class Bad extends Base {public function run():void {super.selected(true,false,true);}}

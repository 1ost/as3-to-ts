package {
    import flash.desktop.NativeApplication;
    import flash.display.BitmapData;
    import flash.display.DisplayObject;
    import flash.display.PNGEncoderOptions;
    import flash.display.Sprite;
    import flash.display.StageAlign;
    import flash.display.StageScaleMode;
    import flash.events.Event;
    import flash.events.UncaughtErrorEvent;
    import flash.filesystem.File;
    import flash.filesystem.FileMode;
    import flash.filesystem.FileStream;
    import flash.system.Capabilities;
    import flash.utils.ByteArray;
    import flash.utils.setTimeout;

    public class OracleHost extends Sprite {
        private var fixture:Object;
        public function OracleHost() {
            loaderInfo.uncaughtErrorEvents.addEventListener(UncaughtErrorEvent.UNCAUGHT_ERROR, uncaught);
            stage.scaleMode = StageScaleMode.NO_SCALE;
            stage.align = StageAlign.TOP_LEFT;
            stage.frameRate = 30;
            try {
                fixture = new NamespaceUpdatesOracle();
                if (fixture is DisplayObject) addChild(fixture as DisplayObject);
                addEventListener(Event.ENTER_FRAME, capture);
            } catch (error:Error) { fail(error); }
        }
        private function write(name:String, bytes:ByteArray):void {
            var stream:FileStream = new FileStream();
            stream.open(new File(File.applicationDirectory.nativePath).parent.resolvePath(name), FileMode.WRITE);
            stream.writeBytes(bytes);
            stream.close();
        }
        private function capture(event:Event):void {
            try {
                var state:Object = fixture.snapshot();
                if (state.ready !== true) return;
                removeEventListener(Event.ENTER_FRAME, capture);
                var bitmap:BitmapData = new BitmapData(stage.stageWidth, stage.stageHeight, false, 0xffffff);
                bitmap.draw(this);
                write("frame.png", bitmap.encode(bitmap.rect, new PNGEncoderOptions()));
                bitmap.dispose();
                var payload:ByteArray = new ByteArray();
                payload.writeUTFBytes(JSON.stringify({runtime: {
                    version: Capabilities.version, playerType: Capabilities.playerType,
                    os: Capabilities.os, screenDPI: Capabilities.screenDPI
                }, state: state}));
                write("capture.json", payload);
                // Release the host's display tree before AIR tears down its native window.
                // Exiting from the capture frame can race native display finalization.
                while (numChildren > 0) removeChildAt(numChildren - 1);
                fixture = null;
                setTimeout(finish, 100);
            } catch (error:Error) { fail(error); }
        }
        private function finish():void {
            NativeApplication.nativeApplication.exit(0);
        }
        private function fail(error:Error):void {
            trace("NATIVE_ORACLE_FAILURE: " + error.getStackTrace());
            NativeApplication.nativeApplication.exit(1);
        }
        private function uncaught(event:UncaughtErrorEvent):void {
            event.preventDefault();
            fail(event.error is Error ? event.error as Error : new Error(String(event.error)));
        }
    }
}

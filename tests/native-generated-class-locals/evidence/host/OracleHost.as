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

    public class OracleHost extends flash.display.Sprite {
        private var fixture:Object;
        public function OracleHost() {
            loaderInfo.uncaughtErrorEvents.addEventListener(flash.events.UncaughtErrorEvent.UNCAUGHT_ERROR, uncaught);
            stage.scaleMode = flash.display.StageScaleMode.NO_SCALE;
            stage.align = flash.display.StageAlign.TOP_LEFT;
            stage.frameRate = 30;
            try {
                fixture = new GeneratedClassLocalProbe();
                if (fixture is flash.display.DisplayObject) addChild(fixture as flash.display.DisplayObject);
                addEventListener(flash.events.Event.ENTER_FRAME, capture);
            } catch (error:Error) { fail(error); }
        }
        private function write(name:String, bytes:flash.utils.ByteArray):void {
            var stream:flash.filesystem.FileStream = new flash.filesystem.FileStream();
            stream.open(new flash.filesystem.File(flash.filesystem.File.applicationDirectory.nativePath).parent.resolvePath(name), flash.filesystem.FileMode.WRITE);
            stream.writeBytes(bytes);
            stream.close();
        }
        private function capture(event:flash.events.Event):void {
            try {
                var state:Object = fixture.snapshot();
                if (state.ready !== true) return;
                removeEventListener(flash.events.Event.ENTER_FRAME, capture);
                var bitmap:flash.display.BitmapData = new flash.display.BitmapData(stage.stageWidth, stage.stageHeight, false, 0xffffff);
                bitmap.draw(this);
                write("frame.png", bitmap.encode(bitmap.rect, new flash.display.PNGEncoderOptions()));
                bitmap.dispose();
                var payload:flash.utils.ByteArray = new flash.utils.ByteArray();
                payload.writeUTFBytes(JSON.stringify({runtime: {
                    version: flash.system.Capabilities.version, playerType: flash.system.Capabilities.playerType,
                    os: flash.system.Capabilities.os, screenDPI: flash.system.Capabilities.screenDPI
                }, state: state}));
                write("capture.json", payload);
                // Release the host's display tree before AIR tears down its native window.
                // Exiting from the capture frame can race native display finalization.
                while (numChildren > 0) removeChildAt(numChildren - 1);
                fixture = null;
                flash.utils.setTimeout(finish, 100);
            } catch (error:Error) { fail(error); }
        }
        private function finish():void {
            flash.desktop.NativeApplication.nativeApplication.exit(0);
        }
        private function fail(error:Error):void {
            trace("NATIVE_ORACLE_FAILURE: " + error.getStackTrace());
            flash.desktop.NativeApplication.nativeApplication.exit(1);
        }
        private function uncaught(event:flash.events.UncaughtErrorEvent):void {
            event.preventDefault();
            fail(event.error is Error ? event.error as Error : new Error(String(event.error)));
        }
    }
}

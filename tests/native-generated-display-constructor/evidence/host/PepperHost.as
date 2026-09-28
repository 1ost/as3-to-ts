package {
    
    import flash.display.Sprite;
    import flash.display.DisplayObject;
    import flash.display.StageScaleMode;
    import flash.display.StageAlign;
    import flash.external.ExternalInterface;
    import flash.events.Event;
    import flash.system.Capabilities;
    [SWF(width="320",height="240",frameRate="30",backgroundColor="#FFFFFF")]
    public class PepperHost extends Sprite {
        private var fixture:Object;
        private var capture:Object;
        public function PepperHost() {
            stage.scaleMode=StageScaleMode.NO_SCALE;stage.align=StageAlign.TOP_LEFT;
            capture={state:{ready:false,failure:"",observations:[]},runtime:{version:Capabilities.version,
                playerType:Capabilities.playerType,os:Capabilities.os,screenDPI:Capabilities.screenDPI}};
            try { fixture=new DisplayConstructorProbe(); if(fixture is DisplayObject)addChild(fixture as DisplayObject); takeSnapshot(); }
            catch(error:Error) { capture.state={ready:false,failure:error.toString(),observations:[]}; }
            ExternalInterface.addCallback("snapshot",function():String{return JSON.stringify(capture);});
        }
        private function onFrame(event:Event):void {
            removeEventListener(Event.ENTER_FRAME,onFrame);
            takeSnapshot();
        }
        private function takeSnapshot():void {
            try { capture.state=fixture.snapshot(); }
            catch(error:Error) { capture.state={ready:false,failure:error.toString(),observations:[]}; }
        }
    }
}

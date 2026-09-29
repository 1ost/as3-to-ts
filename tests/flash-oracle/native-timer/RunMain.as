package
{
   import flash.display.Sprite;
   import flash.external.ExternalInterface;
   import flash.utils.clearInterval;
   import flash.utils.clearTimeout;
   import flash.utils.getTimer;
   import flash.utils.setInterval;
   import flash.utils.setTimeout;

   public class RunMain extends Sprite
   {
      private var result:String = "";
      private var timeoutCrossCount:int = 0;
      private var intervalCrossCount:int = 0;
      private var controlCount:int = 0;
      private var controlArgs:String = "";
      private var timeoutCrossId:uint;
      private var intervalCrossId:uint;
      private var controlId:uint;
      private var start:int;

      public function RunMain()
      {
         if(ExternalInterface.available)
         {
            ExternalInterface.addCallback("testFunc",testFunction);
         }
         this.start = getTimer();
         this.timeoutCrossId = setTimeout(this.onTimeoutCross,40);
         clearInterval(this.timeoutCrossId);
         this.intervalCrossId = setInterval(this.onIntervalCross,10);
         clearTimeout(this.intervalCrossId);
         this.controlId = setInterval(this.onControl,10,"alpha",2);
         setTimeout(this.finish,100);
      }

      private function onTimeoutCross():void
      {
         ++this.timeoutCrossCount;
      }

      private function onIntervalCross():void
      {
         ++this.intervalCrossCount;
      }

      private function onControl(first:String, second:int):void
      {
         ++this.controlCount;
         this.controlArgs = first + ":" + second;
         if(this.controlCount == 2)
         {
            clearInterval(this.controlId);
         }
      }

      private function finish():void
      {
         clearTimeout(this.timeoutCrossId);
         clearInterval(this.intervalCrossId);
         clearInterval(this.controlId);
         var elapsed:int = getTimer() - this.start;
         this.result = "cross=" + this.timeoutCrossCount + "," + this.intervalCrossCount
            + "\ncontrol=" + this.controlCount + ":" + this.controlArgs
            + "\nidsDistinct=" + (this.timeoutCrossId != this.intervalCrossId
               && this.timeoutCrossId != this.controlId && this.intervalCrossId != this.controlId)
            + "\ngetTimer=" + (elapsed >= 80) + ":" + (getTimer() >= this.start);
      }

      public function testFunction():String
      {
         return this.result;
      }
   }
}

package {
 import flash.external.ExternalInterface;
 public class SourceCallbackProbe {
  public var callbackCount:int=0;
  private var callbackText:String="bound callback";
  public function register(loadingParams:Object):void {
   try {
    ExternalInterface.available && ExternalInterface.addCallback("CallAsFun",this.jsCallAsFun);
    if(ExternalInterface.available && loadingParams.hasOwnProperty("clientAutomation") && String(loadingParams.clientAutomation)=="1") {
     ExternalInterface.addCallback("apAutomationCommand",this.automationCommand);
    }
   } catch(error:SecurityError) {}
  }
  private function jsCallAsFun():String {callbackCount++;return callbackText;}
  public function automationCommand(arg1:Object):Object {return arg1;}
 }
}

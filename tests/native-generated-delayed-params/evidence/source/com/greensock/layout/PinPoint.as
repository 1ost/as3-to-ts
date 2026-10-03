package com.greensock.layout
{
   import com.greensock.layout.core.LiquidData;
   import flash.display.DisplayObject;
   import flash.display.Stage;
   import flash.events.Event;
   import flash.events.EventDispatcher;
   import flash.events.IEventDispatcher;
   import flash.geom.Point;
   
   public class PinPoint extends Point implements IEventDispatcher
   {
      
      public static const version:Number = 2.2;
      
      protected var _dispatcher:EventDispatcher;
      
      protected var _data:LiquidData;
      
      public function PinPoint(param1:Number, param2:Number, param3:DisplayObject, param4:LiquidStage = null)
      {
         super(param1,param2);
         var _loc5_:DisplayObject = param3 is Stage ? LiquidStage.getByStage(param3 as Stage).stageBox : param3;
         this.init(_loc5_,param4);
      }
      
      protected function init(param1:DisplayObject, param2:LiquidStage) : void
      {
         this._data = new LiquidData(this,param1,0,param2 || LiquidStage.getByStage(param1.stage),false,0,null,false);
         LiquidData.addCacheData(this._data.liquidStage,this._data);
      }
      
      public function attach(param1:DisplayObject, param2:Boolean = false, param3:Boolean = true, param4:Number = 0, param5:Object = null, param6:Boolean = false) : void
      {
         this._data.liquidStage.attach(param1,this,param2,param3,param4,param5,param6);
      }
      
      public function release(param1:DisplayObject) : Boolean
      {
         return this._data.liquidStage.release(param1);
      }
      
      public function toLocal(param1:DisplayObject) : Point
      {
         return param1.globalToLocal(this._data.target.localToGlobal(this));
      }
      
      public function update() : void
      {
         this._data.liquidStage.update(null);
      }
      
      override public function clone() : Point
      {
         return new PinPoint(this.x,this.y,this._data.target,this._data.liquidStage);
      }
      
      public function destroy() : void
      {
         this._data.destroy(false);
         this._data = null;
      }
      
      public function addEventListener(param1:String, param2:Function, param3:Boolean = false, param4:int = 0, param5:Boolean = false) : void
      {
         if(this._dispatcher == null)
         {
            this._dispatcher = new EventDispatcher(this);
         }
         this._data.hasListener = true;
         this._dispatcher.addEventListener(param1,param2,param3,param4,param5);
      }
      
      public function removeEventListener(param1:String, param2:Function, param3:Boolean = false) : void
      {
         if(this._dispatcher)
         {
            this._dispatcher.removeEventListener(param1,param2,param3);
         }
      }
      
      public function hasEventListener(param1:String) : Boolean
      {
         return this._dispatcher == null ? false : this._dispatcher.hasEventListener(param1);
      }
      
      public function willTrigger(param1:String) : Boolean
      {
         return this._dispatcher == null ? false : this._dispatcher.willTrigger(param1);
      }
      
      public function dispatchEvent(param1:Event) : Boolean
      {
         return this._dispatcher == null ? false : this._dispatcher.dispatchEvent(param1);
      }
      
      public function get target() : DisplayObject
      {
         return this._data.target;
      }
      
      public function set target(param1:DisplayObject) : void
      {
         this._data.target = param1;
         if(param1.stage != this._data.liquidStage.stage)
         {
            this._data.liquidStage = LiquidStage.getByStage(param1.stage);
         }
         this._data.refreshPoints();
      }
      
      public function get data() : LiquidData
      {
         return this._data;
      }
   }
}


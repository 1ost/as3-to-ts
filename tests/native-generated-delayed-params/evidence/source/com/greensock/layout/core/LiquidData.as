package com.greensock.layout.core
{
   import com.greensock.TweenLite;
   import com.greensock.layout.LiquidStage;
   import com.greensock.layout.PinPoint;
   import flash.display.DisplayObject;
   import flash.display.Stage;
   import flash.geom.Point;
   
   public class LiquidData
   {
      
      public var level:int;
      
      public var type:uint;
      
      public var pin:PinPoint;
      
      public var global:Point;
      
      public var xRevert:Number;
      
      public var yRevert:Number;
      
      public var reference:Point;
      
      public var strict:Boolean;
      
      public var hasListener:Boolean;
      
      public var getter:Function;
      
      public var tween:TweenLite;
      
      public var roundPosition:Boolean;
      
      public var target:DisplayObject;
      
      public var liquidStage:LiquidStage;
      
      public function LiquidData(param1:PinPoint, param2:DisplayObject, param3:uint, param4:LiquidStage, param5:Boolean, param6:Number, param7:Object, param8:Boolean)
      {
         super();
         this.pin = param1;
         this.target = param2;
         this.strict = param5;
         this.roundPosition = param8;
         if(param6 > 0)
         {
            param7 ||= {};
            param7.x = this.target.x;
            param7.y = this.target.y;
            if(this.roundPosition)
            {
               param7.roundProps = ["x","y"];
            }
            param7.overwrite = false;
            this.tween = new TweenLite(this.target,param6,param7);
            this.tween.setEnabled(false,false);
         }
         this.liquidStage = param4;
         this.type = param3;
         if(param3 < 2)
         {
            this.global = this.target.localToGlobal(this.pin);
            this.reference = this.global.clone();
            this.xRevert = this.global.x;
            this.yRevert = this.global.y;
         }
         else if(param3 != 3)
         {
            this.global = this.pin.data.global;
            if(param5)
            {
               this.reference = this.target.parent.localToGlobal(new Point(this.target.x,this.target.y));
               this.reference.x -= this.global.x;
               this.reference.y -= this.global.y;
            }
            else
            {
               this.reference = this.target.parent.globalToLocal(this.global);
            }
         }
         this.refreshLevel();
      }
      
      public static function searchCache(param1:LiquidStage, param2:DisplayObject) : LiquidData
      {
         var _loc5_:LiquidData = null;
         var _loc3_:Array = param1.cacheData;
         var _loc4_:int = int(_loc3_.length);
         while(--_loc4_ > -1)
         {
            _loc5_ = _loc3_[_loc4_];
            if(_loc5_.target == param2 && _loc5_.type == 2)
            {
               return _loc3_[_loc4_];
            }
         }
         return null;
      }
      
      public static function addCacheData(param1:LiquidStage, param2:LiquidData) : void
      {
         param1.cacheData.push(param2);
         param1.refreshLevels();
      }
      
      public static function removeCacheData(param1:LiquidStage, param2:LiquidData) : Boolean
      {
         var _loc3_:Array = param1.cacheData;
         var _loc4_:int = int(_loc3_.length);
         while(--_loc4_ > -1)
         {
            if(_loc3_[_loc4_] == param2)
            {
               _loc3_.splice(_loc4_,1);
               param2.destroy(true);
               return true;
            }
         }
         return false;
      }
      
      public function refreshLevel() : void
      {
         var _loc3_:DisplayObject = null;
         if(this.target == this.liquidStage.stageBox)
         {
            this.level = -1;
            return;
         }
         var _loc1_:Stage = this.target.stage;
         var _loc2_:Boolean = Boolean(this.type == 3 && _loc1_ == null);
         if(_loc2_)
         {
            (this.target as Object).preview = true;
            _loc1_ = this.target.stage;
         }
         if(_loc1_)
         {
            this.level = this.type < 2 ? 1 : 0;
            _loc3_ = this.target;
            while(_loc3_ != _loc1_)
            {
               this.level += 2;
               _loc3_ = _loc3_.parent;
            }
         }
         if(this.type >= 2 && this.level < this.pin.data.level)
         {
            this.level = this.pin.data.level + 1;
         }
         if(_loc2_)
         {
            (this.target as Object).preview = false;
         }
      }
      
      public function refreshPoints() : void
      {
         var _loc1_:Point = this.target.localToGlobal(this.pin);
         this.global.x = this.reference.x = _loc1_.x;
         this.global.y = this.reference.y = _loc1_.y;
         if(this.strict && Boolean(this.target.parent))
         {
            this.reference = this.target.parent.localToGlobal(new Point(this.target.x,this.target.y));
            this.reference.x -= this.global.x;
            this.reference.y -= this.global.y;
         }
         this.refreshLevel();
      }
      
      public function destroy(param1:Boolean = false) : void
      {
         var _loc2_:Array = null;
         var _loc3_:LiquidData = null;
         var _loc4_:int = 0;
         if(!param1)
         {
            removeCacheData(this.liquidStage,this);
         }
         if(this.type < 2)
         {
            _loc2_ = this.liquidStage.cacheData.slice();
            _loc4_ = int(_loc2_.length);
            while(--_loc4_ > -1)
            {
               _loc3_ = _loc2_[_loc4_];
               if(_loc3_.pin == this.pin)
               {
                  _loc3_.destroy(false);
               }
            }
         }
         this.pin = null;
         this.target = null;
         this.global = this.reference = null;
         if(this.tween)
         {
            this.tween.kill();
            this.tween = null;
         }
      }
   }
}


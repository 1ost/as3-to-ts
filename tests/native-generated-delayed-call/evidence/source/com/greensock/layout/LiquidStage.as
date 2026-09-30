package com.greensock.layout
{
   import com.greensock.TweenLite;
   import com.greensock.layout.core.LiquidData;
   import com.greensock.plugins.RoundPropsPlugin;
   import com.greensock.plugins.TweenPlugin;
   import flash.display.*;
   import flash.events.Event;
   import flash.events.EventDispatcher;
   import flash.geom.Point;
   import flash.utils.Dictionary;
   
   public class LiquidStage extends EventDispatcher
   {
      
      public static var defaultStage:LiquidStage;
      
      public static const VERSION:Number = 2.13;
      
      private static var _instances:Dictionary = new Dictionary(true);
      
      private var _stageBox:Sprite = new Sprite();
      
      private var _items:Array;
      
      private var _xStageAlign:uint;
      
      private var _yStageAlign:uint;
      
      private var _hasListener:Boolean;
      
      private var _stage:Stage;
      
      private var _baseWidth:uint;
      
      private var _baseHeight:uint;
      
      private var _retroMode:Boolean;
      
      public var TOP_LEFT:PinPoint;
      
      public var TOP_CENTER:PinPoint;
      
      public var TOP_RIGHT:PinPoint;
      
      public var BOTTOM_LEFT:PinPoint;
      
      public var BOTTOM_CENTER:PinPoint;
      
      public var BOTTOM_RIGHT:PinPoint;
      
      public var LEFT_CENTER:PinPoint;
      
      public var RIGHT_CENTER:PinPoint;
      
      public var CENTER:PinPoint;
      
      public var minWidth:uint;
      
      public var minHeight:uint;
      
      public var maxWidth:uint;
      
      public var maxHeight:uint;
      
      public var resizing:Boolean;
      
      public function LiquidStage(param1:Stage, param2:uint, param3:uint, param4:uint = 0, param5:uint = 0, param6:uint = 99999999, param7:uint = 99999999)
      {
         super();
         if(TweenLite.version < 11.51)
         {
            throw new Error("LiquidStage warning: please update your TweenLite class to at least version 11.51 at http://www.TweenLite.com.");
         }
         if(param1 == null)
         {
            throw new Error("LiquidStage error: you must define a valid stage instance in the constructor. If the stage is null, please addEventListener(Event.ADDED_TO_STAGE) one of your DisplayObjects and wait to create the LiquidStage instance until AFTER the stage property is not null.");
         }
         TweenPlugin.activate([RoundPropsPlugin]);
         this._stage = param1;
         if(this._stage in _instances)
         {
            _instances[this._stage] = this;
         }
         if(LiquidStage.defaultStage == null)
         {
            LiquidStage.defaultStage = this;
         }
         this.minWidth = param4;
         this.minHeight = param5;
         this.maxWidth = param6;
         this.maxHeight = param7;
         this._stageBox.graphics.beginFill(255,0.5);
         this._stageBox.graphics.drawRect(0,0,param2,param3);
         this._stageBox.graphics.endFill();
         this._stageBox.name = "__stageBox_mc";
         this._stageBox.visible = false;
         this._items = [];
         this._baseWidth = param2;
         this._baseHeight = param3;
         this.TOP_LEFT = new PinPoint(0,0,this._stageBox,this);
         this.TOP_CENTER = new PinPoint(param2 * 0.5,0,this._stageBox,this);
         this.TOP_RIGHT = new PinPoint(param2,0,this._stageBox,this);
         this.RIGHT_CENTER = new PinPoint(param2,param3 * 0.5,this._stageBox,this);
         this.BOTTOM_RIGHT = new PinPoint(param2,param3,this._stageBox,this);
         this.BOTTOM_CENTER = new PinPoint(param2 * 0.5,param3,this._stageBox,this);
         this.BOTTOM_LEFT = new PinPoint(0,param3,this._stageBox,this);
         this.LEFT_CENTER = new PinPoint(0,param3 * 0.5,this._stageBox,this);
         this.CENTER = new PinPoint(param2 * 0.5,param3 * 0.5,this._stageBox,this);
         this._stage.addEventListener(Event.RESIZE,this.update,false,0,true);
         this._stage.scaleMode = StageScaleMode.NO_SCALE;
         switch(this._stage.align)
         {
            case StageAlign.TOP_LEFT:
               this._xStageAlign = 0;
               this._yStageAlign = 0;
               break;
            case "":
               this._xStageAlign = 1;
               this._yStageAlign = 1;
               break;
            case StageAlign.TOP:
               this._xStageAlign = 1;
               this._yStageAlign = 0;
               break;
            case StageAlign.BOTTOM:
               this._xStageAlign = 1;
               this._yStageAlign = 2;
               break;
            case StageAlign.BOTTOM_LEFT:
               this._xStageAlign = 0;
               this._yStageAlign = 2;
               break;
            case StageAlign.BOTTOM_RIGHT:
               this._xStageAlign = 2;
               this._yStageAlign = 2;
               break;
            case StageAlign.LEFT:
               this._xStageAlign = 0;
               this._yStageAlign = 1;
               break;
            case StageAlign.RIGHT:
               this._xStageAlign = 2;
               this._yStageAlign = 1;
               break;
            case StageAlign.TOP_RIGHT:
               this._xStageAlign = 2;
               this._yStageAlign = 0;
         }
         this._stage.addEventListener(Event.ENTER_FRAME,this.onFirstRender,false,0,true);
      }
      
      public static function getByStage(param1:Stage) : LiquidStage
      {
         return _instances[param1] || defaultStage;
      }
      
      protected function onFirstRender(param1:Event) : void
      {
         this._stage.removeEventListener(Event.ENTER_FRAME,this.onFirstRender);
         this.update(param1);
      }
      
      public function attach(param1:DisplayObject, param2:PinPoint, param3:Boolean = false, param4:Boolean = true, param5:Number = 0, param6:Object = null, param7:Boolean = false) : void
      {
         var _loc8_:LiquidStage = LiquidStage.getByStage(param1.stage) || this;
         if(_loc8_ != this)
         {
            _loc8_.release(param1);
         }
         this.release(param1);
         var _loc9_:LiquidData = param2.data;
         var _loc10_:Boolean = Boolean(param4 && !this.isBaseSize);
         if(_loc10_)
         {
            this.retroMode = true;
         }
         LiquidData.addCacheData(this,new LiquidData(param2,param1,2,this,param3,param5,param6,param7));
         if(_loc10_)
         {
            this.retroMode = false;
         }
      }
      
      public function release(param1:DisplayObject) : Boolean
      {
         var _loc3_:LiquidData = null;
         var _loc2_:int = int(this._items.length);
         while(--_loc2_ > -1)
         {
            _loc3_ = this._items[_loc2_];
            if(_loc3_.target == param1 && _loc3_.type == 2)
            {
               this._items.splice(_loc2_,1);
               _loc3_.destroy(true);
               return true;
            }
         }
         return false;
      }
      
      public function update(param1:Event = null, param2:Boolean = false) : void
      {
         var _loc3_:Number = this._retroMode ? this._baseWidth : this._stage.stageWidth;
         var _loc4_:Number = this._retroMode ? this._baseHeight : this._stage.stageHeight;
         if(_loc3_ < this.minWidth)
         {
            _loc3_ = this.minWidth;
         }
         else if(_loc3_ > this.maxWidth)
         {
            _loc3_ = this.maxWidth;
         }
         if(_loc4_ < this.minHeight)
         {
            _loc4_ = this.minHeight;
         }
         else if(_loc4_ > this.maxHeight)
         {
            _loc4_ = this.maxHeight;
         }
         if(this._xStageAlign == 1)
         {
            this._stageBox.x = (this.TOP_RIGHT.x - _loc3_) / 2;
         }
         else if(this._xStageAlign == 2)
         {
            this._stageBox.x = this.TOP_RIGHT.x - _loc3_;
         }
         if(this._yStageAlign == 1)
         {
            this._stageBox.y = (this.BOTTOM_LEFT.y - _loc4_) / 2;
         }
         else if(this._yStageAlign == 2)
         {
            this._stageBox.y = this.BOTTOM_LEFT.y - _loc4_;
         }
         if(param1 != null)
         {
            this.resizing = true;
         }
         this._stageBox.width = _loc3_;
         this._stageBox.height = _loc4_;
         this.updateItems();
         this.resizing = false;
         if(this._hasListener && !param2)
         {
            dispatchEvent(new Event(Event.RESIZE));
         }
      }
      
      private function updateItems() : void
      {
         var _loc2_:LiquidData = null;
         var _loc3_:Point = null;
         var _loc4_:Point = null;
         var _loc5_:Number = NaN;
         var _loc6_:Number = NaN;
         var _loc7_:Number = NaN;
         var _loc8_:Number = NaN;
         this._stage.addChild(this._stageBox);
         var _loc1_:Event = new Event(Event.CHANGE);
         var _loc9_:Array = [];
         var _loc10_:uint = 0;
         var _loc11_:int = int(this._items.length);
         while(--_loc11_ > -1)
         {
            _loc2_ = this._items[_loc11_];
            if(_loc2_.type == 3)
            {
               (_loc2_.target as Object).capturePinData();
            }
            else if(_loc2_.type == 2 && !_loc2_.strict && Boolean(_loc2_.target.parent))
            {
               _loc3_ = _loc2_.target.parent.globalToLocal(_loc2_.global);
               _loc2_.reference.x = int(_loc3_.x);
               _loc2_.reference.y = int(_loc3_.y);
            }
         }
         _loc11_ = int(this._items.length);
         while(--_loc11_ > -1)
         {
            _loc2_ = this._items[_loc11_];
            if(_loc2_.type == 3)
            {
               (_loc2_.target as Object).updatePins();
            }
            else if(_loc2_.type < 2)
            {
               if(_loc2_.type == 1)
               {
                  _loc3_ = _loc2_.getter();
                  _loc2_.pin.x = _loc3_.x;
                  _loc2_.pin.y = _loc3_.y;
               }
               _loc3_ = _loc2_.target.localToGlobal(_loc2_.pin);
               _loc2_.reference.x = _loc2_.global.x;
               _loc2_.reference.y = _loc2_.global.y;
               _loc2_.global.x = int(_loc3_.x);
               _loc2_.global.y = int(_loc3_.y);
               if(_loc2_.hasListener && (_loc2_.global.x != _loc2_.reference.x || _loc2_.global.y != _loc2_.reference.y))
               {
                  _loc2_.pin.dispatchEvent(_loc1_);
               }
            }
            else if(_loc2_.target.parent)
            {
               if(_loc2_.strict)
               {
                  _loc3_ = _loc2_.target.parent.globalToLocal(new Point(_loc2_.global.x + _loc2_.reference.x,_loc2_.global.y + _loc2_.reference.y));
                  _loc5_ = _loc3_.x - _loc2_.target.x;
                  _loc6_ = _loc3_.y - _loc2_.target.y;
               }
               else
               {
                  _loc3_ = _loc2_.target.parent.globalToLocal(_loc2_.global);
                  _loc4_ = _loc2_.reference;
                  _loc5_ = int(_loc3_.x) - int(_loc4_.x);
                  _loc6_ = int(_loc3_.y) - int(_loc4_.y);
               }
               if(_loc2_.tween)
               {
                  if(_loc2_.tween.cachedTime < _loc2_.tween.cachedDuration && !_loc2_.tween.gc)
                  {
                     if(_loc2_.strict)
                     {
                        _loc5_ = _loc3_.x - _loc2_.tween.vars.x;
                        _loc6_ = _loc3_.y - _loc2_.tween.vars.y;
                     }
                     _loc2_.tween.vars.x += _loc5_;
                     _loc2_.tween.vars.y += _loc6_;
                  }
                  else
                  {
                     _loc2_.tween.vars.x = _loc2_.target.x + _loc5_;
                     _loc2_.tween.vars.y = _loc2_.target.y + _loc6_;
                  }
                  _loc2_.xRevert = _loc2_.target.x;
                  _loc2_.yRevert = _loc2_.target.y;
                  var _loc12_:uint;
                  _loc9_[_loc12_ = _loc10_++] = _loc2_;
                  _loc7_ = Number(_loc2_.tween.vars.x);
                  _loc8_ = Number(_loc2_.tween.vars.y);
               }
               else
               {
                  _loc7_ = _loc2_.target.x + _loc5_;
                  _loc8_ = _loc2_.target.y + _loc6_;
               }
               if(_loc2_.roundPosition)
               {
                  _loc7_ = _loc7_ + 0.5 >> 0;
                  _loc8_ = _loc8_ + 0.5 >> 0;
               }
               _loc2_.target.x = _loc7_;
               _loc2_.target.y = _loc8_;
            }
         }
         _loc11_ = int(_loc9_.length);
         while(--_loc11_ > -1)
         {
            _loc2_ = _loc9_[_loc11_];
            _loc2_.tween.restart(true,true);
            _loc2_.target.x = _loc2_.xRevert;
            _loc2_.target.y = _loc2_.yRevert;
            _loc2_.tween.invalidate();
         }
         this._stage.removeChild(this._stageBox);
      }
      
      public function refreshLevels() : void
      {
         var _loc1_:int = int(this._items.length);
         while(--_loc1_ > -1)
         {
            LiquidData(this._items[_loc1_]).refreshLevel();
         }
         this._items.sortOn("level",Array.NUMERIC | Array.DESCENDING);
      }
      
      override public function addEventListener(param1:String, param2:Function, param3:Boolean = false, param4:int = 0, param5:Boolean = false) : void
      {
         this._hasListener = true;
         super.addEventListener(param1,param2,param3,param4,param5);
      }
      
      public function get stage() : Stage
      {
         return this._stage;
      }
      
      public function get stageBox() : Sprite
      {
         return this._stageBox;
      }
      
      public function get cacheData() : Array
      {
         return this._items;
      }
      
      public function get retroMode() : Boolean
      {
         return this._retroMode;
      }
      
      public function set retroMode(param1:Boolean) : void
      {
         if(param1 != this._retroMode)
         {
            this._retroMode = param1;
            this.update(null,true);
         }
      }
      
      public function get isBaseSize() : Boolean
      {
         return Boolean(this._stageBox.width == this._baseWidth && this._stageBox.height == this._baseHeight);
      }
   }
}


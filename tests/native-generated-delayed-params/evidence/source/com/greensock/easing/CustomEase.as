package com.greensock.easing
{
   public class CustomEase
   {
      
      public static const VERSION:Number = 1.01;
      
      private static var _all:Object = {};
      
      private var _segments:Array;
      
      private var _name:String;
      
      public function CustomEase(param1:String, param2:Array)
      {
         super();
         this._name = param1;
         this._segments = [];
         var _loc3_:int = int(param2.length);
         var _loc4_:int = 0;
         while(_loc4_ < _loc3_)
         {
            this._segments[this._segments.length] = new Segment(param2[_loc4_].s,param2[_loc4_].cp,param2[_loc4_].e);
            _loc4_++;
         }
         _all[param1] = this;
      }
      
      public static function create(param1:String, param2:Array) : Function
      {
         var _loc3_:CustomEase = new CustomEase(param1,param2);
         return _loc3_.ease;
      }
      
      public static function byName(param1:String) : Function
      {
         return _all[param1].ease;
      }
      
      public function ease(param1:Number, param2:Number, param3:Number, param4:Number) : Number
      {
         var _loc7_:Number = NaN;
         var _loc8_:Segment = null;
         var _loc5_:Number = param1 / param4;
         var _loc6_:uint = this._segments.length;
         var _loc9_:int = int(_loc6_ * _loc5_);
         _loc7_ = (_loc5_ - _loc9_ * (1 / _loc6_)) * _loc6_;
         _loc8_ = this._segments[_loc9_];
         return param2 + param3 * (_loc8_.s + _loc7_ * (2 * (1 - _loc7_) * (_loc8_.cp - _loc8_.s) + _loc7_ * (_loc8_.e - _loc8_.s)));
      }
      
      public function destroy() : void
      {
         this._segments = null;
         delete _all[this._name];
      }
   }
}

class Segment
{
   
   public var s:Number;
   
   public var cp:Number;
   
   public var e:Number;
   
   public function Segment(param1:Number, param2:Number, param3:Number)
   {
      super();
      this.s = param1;
      this.cp = param2;
      this.e = param3;
   }
}

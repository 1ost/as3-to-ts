package cn.kyiax.yare.util
{
   public final class MathUtil
   {
      
      public function MathUtil()
      {
         super();
      }
      
      public static function limitIn(param1:Number, param2:Number, param3:Number) : Number
      {
         return Math.min(Math.max(param1,param2),param3);
      }
      
      public static function atan2(param1:Number, param2:Number) : Number
      {
         var _loc3_:Number = NaN;
         if(param1 == 0)
         {
            _loc3_ = Math.PI / 2;
         }
         else if(param1 > 0)
         {
            _loc3_ = Math.atan(Math.abs(param2 / param1));
         }
         else
         {
            _loc3_ = Math.PI - Math.atan(Math.abs(param2 / param1));
         }
         if(param2 >= 0)
         {
            return _loc3_;
         }
         return -_loc3_;
      }
      
      public static function sum(param1:Array) : Number
      {
         var _loc3_:Number = NaN;
         var _loc2_:Number = 0;
         for each(_loc3_ in param1)
         {
            _loc2_ += _loc3_;
         }
         return _loc2_;
      }
      
      public static function avg(param1:Array) : Number
      {
         return sum(param1) / param1.length;
      }
      
      public static function max(param1:Array) : Number
      {
         var _loc2_:Number = NaN;
         var _loc3_:int = 0;
         while(_loc3_ < param1.length)
         {
            if(isNaN(_loc2_) || param1[_loc3_] > _loc2_)
            {
               _loc2_ = Number(param1[_loc3_]);
            }
            _loc3_++;
         }
         return _loc2_;
      }
      
      public static function min(param1:Array) : Number
      {
         var _loc2_:Number = NaN;
         var _loc3_:int = 0;
         while(_loc3_ < param1.length)
         {
            if(isNaN(_loc2_) || param1[_loc3_] < _loc2_)
            {
               _loc2_ = Number(param1[_loc3_]);
            }
            _loc3_++;
         }
         return _loc2_;
      }
      
      public static function randomInt(param1:int, param2:int) : int
      {
         return Math.random() * (param2 - param1 + 1) + param1;
      }
   }
}


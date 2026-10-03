package cn.kyiax.yare.util.filter
{
   import flash.filters.ColorMatrixFilter;
   
   public class ColorMatrixFilterProxy
   {
      
      public static const SATURATION:int = 0;
      
      public static const CONTRAST:int = 1;
      
      public static const BRIGHTNESS:int = 2;
      
      public static const INVERSION:int = 3;
      
      public static const HUE:int = 4;
      
      public static const THRESHOLD:int = 5;
      
      public function ColorMatrixFilterProxy()
      {
         super();
      }
      
      public static function createSaturationFilter(param1:Number) : ColorMatrixFilter
      {
         return new ColorMatrixFilter([0.3086 * (1 - param1) + param1,0.6094 * (1 - param1),0.082 * (1 - param1),0,0,0.3086 * (1 - param1),0.6094 * (1 - param1) + param1,0.082 * (1 - param1),0,0,0.3086 * (1 - param1),0.6094 * (1 - param1),0.082 * (1 - param1) + param1,0,0,0,0,0,1,0]);
      }
      
      public static function createContrastFilter(param1:Number) : ColorMatrixFilter
      {
         return new ColorMatrixFilter([param1,0,0,0,128 * (1 - param1),0,param1,0,0,128 * (1 - param1),0,0,param1,0,128 * (1 - param1),0,0,0,1,0]);
      }
      
      public static function createBrightnessFilter(param1:Number) : ColorMatrixFilter
      {
         return new ColorMatrixFilter([1,0,0,0,param1,0,1,0,0,param1,0,0,1,0,param1,0,0,0,1,0]);
      }
      
      public static function createInversionFilter() : ColorMatrixFilter
      {
         return new ColorMatrixFilter([-1,0,0,0,255,0,-1,0,0,255,0,0,-1,0,255,0,0,0,1,0]);
      }
      
      public static function createHueFilter(param1:Number) : ColorMatrixFilter
      {
         var _loc2_:Number = Math.cos(param1 * Math.PI / 180);
         var _loc3_:Number = Math.sin(param1 * Math.PI / 180);
         var _loc4_:Number = 0.213;
         var _loc5_:Number = 0.715;
         var _loc6_:Number = 0.072;
         return new ColorMatrixFilter([_loc4_ + _loc2_ * (1 - _loc4_) + _loc3_ * (0 - _loc4_),_loc5_ + _loc2_ * (0 - _loc5_) + _loc3_ * (0 - _loc5_),_loc6_ + _loc2_ * (0 - _loc6_) + _loc3_ * (1 - _loc6_),0,0,_loc4_ + _loc2_ * (0 - _loc4_) + _loc3_ * 0.143,_loc5_ + _loc2_ * (1 - _loc5_) + _loc3_ * 0.14,_loc6_ + _loc2_ * (0 - _loc6_) + _loc3_ * -0.283,0,0,_loc4_ + _loc2_ * (0 - _loc4_) + _loc3_ * (0 - (1 - _loc4_)),_loc5_ + _loc2_ * (0 - _loc5_) + _loc3_ * _loc5_,_loc6_ + _loc2_ * (1 - _loc6_) + _loc3_ * _loc6_,0,0,0,0,0,1,0]);
      }
      
      public static function createThresholdFilter(param1:Number) : ColorMatrixFilter
      {
         return new ColorMatrixFilter([0.3086 * 256,0.6094 * 256,0.082 * 256,0,-256 * param1,0.3086 * 256,0.6094 * 256,0.082 * 256,0,-256 * param1,0.3086 * 256,0.6094 * 256,0.082 * 256,0,-256 * param1,0,0,0,1,0]);
      }
      
      public static function toGrayScale() : ColorMatrixFilter
      {
         var _loc1_:Array = [0.3,0.59,0.11,0,0,0.3,0.59,0.11,0,0,0.3,0.59,0.11,0,0,0,0,0,1,0];
         return new ColorMatrixFilter(_loc1_);
      }
      
      public static function toOriginalColors() : ColorMatrixFilter
      {
         var _loc1_:Array = [1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0];
         return new ColorMatrixFilter(_loc1_);
      }
   }
}


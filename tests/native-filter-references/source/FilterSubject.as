package {
 import flash.filters.BitmapFilter;
 import flash.filters.ColorMatrixFilter;
 public class FilterSubject {
  private var stored:BitmapFilter;
  public function accept(value:BitmapFilter):BitmapFilter {stored=value;return stored;}
  public function specific(value:ColorMatrixFilter):ColorMatrixFilter {return value;}
  public function get current():BitmapFilter {return stored;}
  public function fresh():ColorMatrixFilter {return new ColorMatrixFilter();}
  public function copy(value:BitmapFilter):BitmapFilter {return value.clone();}
 }
}

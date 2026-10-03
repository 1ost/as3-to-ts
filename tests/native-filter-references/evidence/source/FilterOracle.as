package {
 import cn.kyiax.yare.util.filter.ColorMatrixFilterProxy;
 import flash.filters.ColorMatrixFilter;
 import flash.filters.BlurFilter;
 import flash.filters.GlowFilter;
 public class FilterOracle {
  public function snapshot():Object {
   var subject:FilterSubject=new FilterSubject(),rows:Array=[],f:ColorMatrixFilter=subject.fresh();
   rows.push({id:"default",value:f.matrix});rows.push({id:"base-identity",value:subject.accept(f)===f});rows.push({id:"specific",value:subject.specific(f)===f});
   var c:ColorMatrixFilter=subject.copy(f) as ColorMatrixFilter;rows.push({id:"clone",value:[c!==f,c.matrix]});
   var a:Array=f.matrix;a[0]=99;rows.push({id:"copy-out",value:f.matrix[0]});
   var blur:BlurFilter=new BlurFilter(),glow:GlowFilter=new GlowFilter();rows.push({id:"other-subclasses",value:[subject.accept(blur)===blur,subject.accept(glow)===glow]});
   try {subject.accept.apply(subject,[{}]);rows.push({id:"reject",value:"accepted"});}catch(error:Error){rows.push({id:"reject",value:[error.name,error.errorID,subject.current===glow]});}
   rows.push({id:"null",value:subject.accept(null)===null});
   rows.push({id:"saturation",value:ColorMatrixFilterProxy.createSaturationFilter(.25).matrix});
   rows.push({id:"contrast",value:ColorMatrixFilterProxy.createContrastFilter(1.5).matrix});
   rows.push({id:"brightness",value:ColorMatrixFilterProxy.createBrightnessFilter(-25).matrix});
   rows.push({id:"inversion",value:ColorMatrixFilterProxy.createInversionFilter().matrix});
   rows.push({id:"hue",value:ColorMatrixFilterProxy.createHueFilter(45).matrix});
   rows.push({id:"threshold",value:ColorMatrixFilterProxy.createThresholdFilter(.5).matrix});
   rows.push({id:"grayscale",value:ColorMatrixFilterProxy.toGrayScale().matrix});
   rows.push({id:"original",value:ColorMatrixFilterProxy.toOriginalColors().matrix});
   return {ready:true,failure:"",observations:rows};
  }
 }
}

package entryreview {
 public class Probe {
  public static function bindNew():* {var ctor:*=Subject;var factory:*=ctor.bind(null);return new factory();}
  public static function freshPrototype():* {var ctor:*=Subject;var receiver:*={};receiver["__proto__"]=ctor["prototype"];ctor.call(receiver);return receiver;}
  public static function aliasCoerce():* {var ctor:*=Subject;var value:*=new Subject();return ctor(value);}
 }
}

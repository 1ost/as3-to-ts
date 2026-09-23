package probe {
 public class CommentReturn {
  public function CommentReturn(){super();}
  public function compact():* {return[1];}
  public function block():* {return/*block*/[2];}
  public function doc():* {return/**doc*/[3];}
  public function multiple():* {return/*one*//**two*/[4];}
  public function multiline():* {return/*line
comment*/([5]);}
  public function lineComment():* {return//line
([6]);}
  public function newline():* {return
([7]);}
  public function afterComment():* {return/*block*/
([8]);}
  public function noValue():* {return/*block*/;}
  public function number():* {return/*block*/42;}
  public function identifier(value:*):* {return/*block*/value;}
  public function object():* {return/*block*/({answer:9});}
  public function throwArray():* {throw/*block*/[10];}
  public function throwDoc():* {throw/**doc*/[11];}
 }
}

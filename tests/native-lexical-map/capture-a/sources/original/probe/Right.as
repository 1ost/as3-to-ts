package probe {
 import probe.Left;
 public class Right {
  private var secret:*="right-secret";
  protected var value:*;
  private static var token:*="right-token";
  public static var marker:*="right-marker";
  public function Right(arg:*){super();value=arg;}
  public function read():*{return [secret,value,Right.token,Right.marker];}
  public function write(arg:*):*{value=arg;return this.read();}
  private function hidden(arg:*):*{return [secret,arg];}
  protected function selected():*{return value;}
  public function closure():*{return this.hidden;}
  public function invoke(arg:*):*{return hidden(arg);}
  public function protectedRead():*{return selected();}
  public static function readStatic():*{return token;}
  public function peer(other:*):*{return other.read();}
  public function crossStatic():*{return [Left.marker,Left.readStatic()];}
  public function make(arg:*):*{return new Left(arg);}
 }
}

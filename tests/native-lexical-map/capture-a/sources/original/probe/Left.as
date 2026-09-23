package probe {
 import probe.Right;
 public class Left {
  private var secret:*="left-secret";
  protected var value:*;
  private static var token:*="left-token";
  public static var marker:*="left-marker";
  public function Left(arg:*){super();value=arg;}
  public function read():*{return [secret,value,Left.token,Left.marker];}
  public function write(arg:*):*{value=arg;return this.read();}
  private function hidden(arg:*):*{return [secret,arg];}
  protected function selected():*{return value;}
  public function closure():*{return this.hidden;}
  public function invoke(arg:*):*{return hidden(arg);}
  public function protectedRead():*{return selected();}
  public static function readStatic():*{return token;}
  public function peer(other:*):*{return other.read();}
  public function crossStatic():*{return [Right.marker,Right.readStatic()];}
  public function make(arg:*):*{return new Right(arg);}
 }
}

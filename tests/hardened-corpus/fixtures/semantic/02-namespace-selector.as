package fixtures {
  public namespace state;
  use namespace state;
  public class NamespaceSelector {
    state var value:int;
    public function read():int { return state::value; }
  }
}

package fixtures {
  public class E4XDescendant {
    public function read(xml:XML):void {
      for each (var method:XML in xml..method) { trace(method.@name); }
    }
  }
}

package fixtures {
  public class LabelControlFlow {
    public function run():void {
      outer: while (true) { break outer; }
    }
  }
}

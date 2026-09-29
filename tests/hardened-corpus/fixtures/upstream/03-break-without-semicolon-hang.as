package fixtures {
  public class BreakWithoutSemicolonHang {
    public function run():void {
      while (true) {
        break
      }
    }
  }
}

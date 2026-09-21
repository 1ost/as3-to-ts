package probe {
 public class EntrySubject {
  public var journal:*; public var tag:*;
  public function EntrySubject(j:*,t:*) {journal=j;tag=t;}
  public function publicEntry(a:Number,b:Boolean=true,c:Number=5):* {journal.push('public:'+tag);return [a,b,c];}
  protected function protectedEntry(a:Number,b:Boolean=false):* {journal.push('protected:'+tag);return [a,b];}
  private function privateEntry(a:Number,b:Boolean=true):* {journal.push('private:'+tag);return [a,b];}
  public function pick(n:*):* {if(n=='protected')return protectedEntry;if(n=='private')return privateEntry;return publicEntry;}
 }
}

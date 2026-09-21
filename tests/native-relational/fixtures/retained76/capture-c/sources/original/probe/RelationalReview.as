package probe {
 public class RelationalReview {
 public function RelationalReview(){super();}
 public function lt(left:*,right:*):* {return left<right;}
 public function ltOrder(box:*):* {return box.left()<box.right();}
 public function le(left:*,right:*):* {return left<=right;}
 public function leOrder(box:*):* {return box.left()<=box.right();}
 public function gt(left:*,right:*):* {return left>right;}
 public function gtOrder(box:*):* {return box.left()>box.right();}
 public function ge(left:*,right:*):* {return left>=right;}
 public function geOrder(box:*):* {return box.left()>=box.right();}
 }
}

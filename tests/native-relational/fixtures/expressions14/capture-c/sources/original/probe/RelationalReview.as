package probe {public class RelationalReview {public function RelationalReview(){super();}
public function andExpr(flag:*,box:*):* {return flag && box.left()>box.right();}
public function orExpr(flag:*,box:*):* {return flag || box.left()<=box.right();}
public function conditional(flag:*,box:*):* {return flag ? box.left()>box.right() : box.skipped();}
public function nestedLeft(box:*):* {return (box.left()>box.right())<=box.third();}
public function nestedRight(box:*):* {return box.left()>=(box.right()<box.third());}
public function chain(box:*):* {return box.left()>box.right()<=box.third();}
public function additionOperand(box:*):* {return (box.left()+1)<=box.right();}
public function negateUnordered(box:*):* {return !(box.left()<=box.right());}
public function numericLoop():* {var i:int=0;var result:*= [];while(i<2){result.push(i++);}return result;}
public function assignmentOperand(box:*):* {var first:*;return [(first=box.left())>=box.right(),first===null];}
}}
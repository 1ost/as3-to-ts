package probe {public class RelationalReview {public function RelationalReview(){super();}
public function mixedIs(left:*,right:*):* {return left < right is Boolean;}
public function mixedAs(left:*,right:*):* {return left < right as Object;}
public function mixedIn(left:*,right:*):* {return left < right in {"true":1,"false":2};}
public function mixedInstance(left:*,right:*):* {return left < right instanceof Boolean;}
}}
package probe {public class RelationalReview {public function RelationalReview(){super();}
public function less():*{var __as3_source_as3LessThan:*=9;return [1<2,__as3_source_as3LessThan];}
public function lessEqual():*{var __as3_source_as3LessThanOrEqual:*=8;return [2<=2,__as3_source_as3LessThanOrEqual];}
public function greater():*{var __as3_source_as3GreaterThan_:*=7;return [3>2,__as3_source_as3GreaterThan_];}
public function greaterEqual():*{/* __as3_source_as3GreaterThanOrEqual */return 2>=3;}
public function commentChain():*{return 1 /*one*/ < /*two*/2 <=3;}
public function returnPrefix():*{return/*prefix*/1>=0;}
}}
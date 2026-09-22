package updatecases {
    use namespace slot;
    public class NamespaceUpdatesProbe {
        slot var signed:int = 0;
        slot var unsigned:uint = 0;
        private var storedSigned:int = 0;
        private var storedUnsigned:uint = 0;
        private var effects:Array = [];

        slot function get signedAccessor():int { effects.push("get"); return storedSigned; }
        slot function set signedAccessor(value:int):void { effects.push("set:" + value); storedSigned = value; }
        slot function get unsignedAccessor():uint { effects.push("get"); return storedUnsigned; }
        slot function set unsignedAccessor(value:uint):void { effects.push("set:" + value); storedUnsigned = value; }
        private function receiver():NamespaceUpdatesProbe { effects.push("receiver"); return this; }

        public function signedUpdate(form:int, operation:int, initial:int):Object {
            this.slot::signed = initial;
            storedSigned = initial;
            effects = [];
            var result:*;
            if (form == 0) {
                if (operation == 0) result = ++this.slot::signed;
                if (operation == 1) result = this.slot::signed++;
                if (operation == 2) result = --this.slot::signed;
                if (operation == 3) result = this.slot::signed--;
            } else if (form == 1) {
                if (operation == 0) result = ++this.signed;
                if (operation == 1) result = this.signed++;
                if (operation == 2) result = --this.signed;
                if (operation == 3) result = this.signed--;
            } else if (form == 2) {
                if (operation == 0) result = ++receiver().slot::signed;
                if (operation == 1) result = receiver().slot::signed++;
                if (operation == 2) result = --receiver().slot::signed;
                if (operation == 3) result = receiver().slot::signed--;
            } else {
                if (operation == 0) result = ++receiver().slot::signedAccessor;
                if (operation == 1) result = receiver().slot::signedAccessor++;
                if (operation == 2) result = --receiver().slot::signedAccessor;
                if (operation == 3) result = receiver().slot::signedAccessor--;
            }
            return {result:result, stored:form == 3 ? storedSigned : this.slot::signed, effects:effects};
        }

        public function unsignedUpdate(form:int, operation:int, initial:uint):Object {
            this.slot::unsigned = initial;
            storedUnsigned = initial;
            effects = [];
            var result:*;
            if (form == 0) {
                if (operation == 0) result = ++this.slot::unsigned;
                if (operation == 1) result = this.slot::unsigned++;
                if (operation == 2) result = --this.slot::unsigned;
                if (operation == 3) result = this.slot::unsigned--;
            } else if (form == 1) {
                if (operation == 0) result = ++this.unsigned;
                if (operation == 1) result = this.unsigned++;
                if (operation == 2) result = --this.unsigned;
                if (operation == 3) result = this.unsigned--;
            } else if (form == 2) {
                if (operation == 0) result = ++receiver().slot::unsigned;
                if (operation == 1) result = receiver().slot::unsigned++;
                if (operation == 2) result = --receiver().slot::unsigned;
                if (operation == 3) result = receiver().slot::unsigned--;
            } else {
                if (operation == 0) result = ++receiver().slot::unsignedAccessor;
                if (operation == 1) result = receiver().slot::unsignedAccessor++;
                if (operation == 2) result = --receiver().slot::unsignedAccessor;
                if (operation == 3) result = receiver().slot::unsignedAccessor--;
            }
            return {result:result, stored:form == 3 ? storedUnsigned : this.slot::unsigned, effects:effects};
        }

        public function snapshot():Object {
            var rows:Array = [];
            var signedStarts:Array = [0, 2147483647, -2147483648];
            var unsignedStarts:Array = [0, 4294967295, 1];
            for (var form:int = 0; form < 4; form++) {
                for (var operation:int = 0; operation < 4; operation++) {
                    for (var seed:int = 0; seed < 3; seed++) {
                        rows.push({id:"int-" + form + "-" + operation + "-" + seed,
                            value:signedUpdate(form, operation, signedStarts[seed])});
                        rows.push({id:"uint-" + form + "-" + operation + "-" + seed,
                            value:unsignedUpdate(form, operation, unsignedStarts[seed])});
                    }
                }
            }
            return {ready:true, failure:"", observations:rows};
        }
    }
}

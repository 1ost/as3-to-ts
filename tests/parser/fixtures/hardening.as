package hardening.sample {
    class Bare {
        var first:int = 1, /* between declarations */ second:uint = 2;

        function route(value:flash.display.Sprite):flash.events.Event {
            while (true) {
                break // ASI must terminate break here
                trace(int);
            }
            while (true) {
                continue /* inline before semicolon */ ;
            }
            throw new flash.errors.IllegalOperationError("boom");
        }
    }
}

export default class Token {
    end: number;
    leadingTrivia: Token[] = [];

    constructor(
        public text: string,
        public index: number,
        public isNumeric = false,
        public isXML = false
    ) {
        this.end = index + text.length;
    }
}

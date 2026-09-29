import {NativeLexicalMembers} from './native-lexical-members';
/** Native source expression lowering to common provider APIs; no execution engine. */
export function lowerNativeSourceOperations(source: string, provider: string, compilerHelpers: Set<string>, unique: (name: string) => string, lexical?: NativeLexicalMembers): string {
    const ts = require('typescript-4-9'), S = ts.SyntaxKind;
    const file = ts.createSourceFile('SourceBody.ts', source, ts.ScriptTarget.Latest, true);
    const fail = (reason: string): never => {throw new Error('AS3_SOURCE_OPERATION_UNSUPPORTED: ' + reason);};
    if (file.parseDiagnostics.length) fail('source body syntax');
    const raw = (node: any): string => source.slice(node.getStart(file), node.end);
    const unwrap = (node: any): any => node.kind === S.ParenthesizedExpression ? unwrap(node.expression) : node;
    const property = (node: any): boolean => node.kind === S.PropertyAccessExpression || node.kind === S.ElementAccessExpression;
    const compilerCall = (node: any): boolean => node.kind === S.Identifier && compilerHelpers.has(node.text)
        || node.kind === S.PropertyAccessExpression && node.expression.kind === S.Identifier && compilerHelpers.has(node.expression.text);
    const lexicalTrait = (node: any) => lexical && node.kind === S.ElementAccessExpression && node.argumentExpression.kind === S.Identifier
        && lexical.traits.find(t => t.key === node.argumentExpression.text);
    const key = (node: any): string => node.kind === S.PropertyAccessExpression ? JSON.stringify(node.name.text) : render(node.argumentExpression);
    const render = (node: any): string => {
        if (node.kind === S.ForInStatement || node.kind === S.ForOfStatement)
            return fail('source enumeration requires common trait and key-order authority');
        if (node.kind === S.TypeOfExpression)
            return provider + '.as3TypeOf(' + render(node.expression) + ')';
        if (node.kind === S.Identifier && node.text === 'arguments'
            && !(node.parent.kind === S.PropertyAccessExpression && node.parent.name === node)
            && !(node.parent.kind === S.PropertyAssignment && node.parent.name === node))
            return fail('method/function arguments require source Array and scope lowering');
        if (lexical && (node.kind === S.DeleteExpression || node.kind === S.BinaryExpression && node.operatorToken.kind === S.InKeyword))
            return fail('lexical namespace membership/deletion held');
        if (node.kind === S.DeleteExpression) {
            const target = unwrap(node.expression);
            if (!property(target)) return fail('delete of a non-property source binding');
            return provider + '.as3DeleteProperty(' + render(target.expression) + ',' + key(target) + ')';
        }
        if (node.kind === S.BinaryExpression && node.operatorToken.kind === S.InKeyword)
            return provider + '.as3HasProperty(' + render(node.left) + ',' + render(node.right) + ')';
        if (node.kind === S.ObjectLiteralExpression) {
            const object = unique('objectLiteral');
            return '(()=>{const ' + object + '=' + provider + '.as3CreateDynamicObject();'
                + node.properties.map((item: any) => {
                    if (item.kind !== S.PropertyAssignment || item.name.kind !== S.Identifier && item.name.kind !== S.StringLiteral && item.name.kind !== S.NumericLiteral)
                        return fail('object literal descriptor identity');
                    return provider + '.as3SetProperty(' + object + ',' + JSON.stringify(item.name.text) + ',' + render(item.initializer) + ',"public");';
                }).join('') + 'return ' + object + ';})()';
        }
        if (node.kind === S.CallExpression) {
            if (compilerCall(node.expression)) return raw(node.expression) + '(' + node.arguments.map(render).join(',') + ')';
            const expr = unwrap(node.expression), args = node.arguments.map(render).join(',');
            if (lexical && property(expr)) {
                const trait = lexicalTrait(expr);
                if (trait) return '(<any>' + lexical.provider + '.as3CallLexicalMember(' + render(expr.expression) + ',' + trait.access + ',()=>[' + args + ']))';
                const recv = unique('lexicalCallReceiver');
                return '(()=>{const ' + recv + '=' + render(expr.expression) + ';return <any>' + provider + '.as3CallValue(' + lexical.provider + '.as3GetLexicalProperty(' + lexical.scope + ',' + recv + ',' + key(expr) + '),()=>[' + args + '],' + recv + ');})()';
            }
            if (lexical) return fail('unqualified function call requires source caller context');
            return property(expr) ? provider + '.as3CallProperty(' + render(expr.expression) + ',' + key(expr) + ',()=>[' + args + '])'
                : provider + '.as3CallValue(' + render(node.expression) + ',()=>[' + args + '])';
        }
        if (node.kind === S.NewExpression) return provider + '.as3ConstructValue(' + render(node.expression) + ',()=>[' + (node.arguments || []).map(render).join(',') + '])';
        if (node.kind === S.BinaryExpression && property(unwrap(node.left))) {
            const left = unwrap(node.left);
            if (node.operatorToken.kind === S.EqualsToken) {
                const trait = lexicalTrait(left);
                if (trait) return lexical.provider + '.as3SetLexicalMember(' + render(left.expression) + ',' + trait.access + ',' + render(node.right) + ')';
                if (lexical) return lexical.provider + '.as3SetLexicalProperty(' + lexical.scope + ',' + render(left.expression) + ',' + key(left) + ',' + render(node.right) + ')';
                return provider + '.as3SetProperty(' + render(left.expression) + ',' + key(left) + ',' + render(node.right) + ')';
            }
            if (node.operatorToken.kind >= S.FirstAssignment && node.operatorToken.kind <= S.LastAssignment) fail('compound property assignment lowering pending');
        }
        if ((node.kind === S.PrefixUnaryExpression || node.kind === S.PostfixUnaryExpression) && property(unwrap(node.operand))
            && (node.operator === S.PlusPlusToken || node.operator === S.MinusMinusToken)) {
            if (lexical) return fail('lexical namespace property update held');
            const target = unwrap(node.operand), recv = unique('operationReceiver'), prop = unique('operationKey'), old = unique('operationOld'), next = unique('operationNext');
            return '(()=>{const ' + recv + '=' + render(target.expression) + ', ' + prop + '=' + key(target) + ';const ' + old + '=' + provider + '.as3CoerceNumber(' + provider + '.as3GetProperty(' + recv + ',' + prop + '));const ' + next + '=' + old + (node.operator === S.PlusPlusToken ? '+1' : '-1') + ';' + provider + '.as3SetProperty(' + recv + ',' + prop + ',' + next + ');return ' + (node.kind === S.PrefixUnaryExpression ? next : old) + ';})()';
        }
        if (property(node)) {
            if (compilerCall(node)) return raw(node);
            const trait = lexicalTrait(node);
            if (trait) return '(<any>' + lexical.provider + '.as3GetLexicalMember(' + render(node.expression) + ',' + trait.access + '))';
            if (lexical) return '(<any>' + lexical.provider + '.as3GetLexicalProperty(' + lexical.scope + ',' + render(node.expression) + ',' + key(node) + '))';
            return provider + '.as3GetProperty(' + render(node.expression) + ',' + key(node) + ')';
        }
        if (node.kind === S.TypeAssertionExpression && node.type.kind === S.TypeReference && node.type.typeName.text === 'Class')
            return provider + '.as3AsClass(' + render(node.expression) + ')';
        const edits: {start: number; end: number; value: string}[] = [];
        ts.forEachChild(node, (child: any) => {const value = render(child); if (value !== raw(child)) edits.push({start: child.getStart(file), end: child.end, value});});
        let result = raw(node), start = node.getStart(file);
        edits.sort((a, b) => b.start - a.start).forEach(edit => result = result.slice(0, edit.start - start) + edit.value + result.slice(edit.end - start));
        return result;
    };
    return render(file);
}

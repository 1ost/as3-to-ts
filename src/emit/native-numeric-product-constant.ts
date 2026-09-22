/** AIR-qualified early constants: signed decimal literals joined only by '*'.
 * No identifiers, calls, grouping or other operators are admitted. The emitted
 * Number multiplication is coerced once to the declared numeric slot type.
 */
export function nativeNumericProductConstant(source: string, type: string | object): boolean {
    if (['int', 'uint', 'Number'].indexOf(type as string) < 0 || !source) return false;
    const operand = '[+-]?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?';
    return new RegExp('^' + operand + '(?:\\s*\\*\\s*' + operand + ')+$').test(source);
}

/** Source scope, separate from Flash's possibly non-unique reflection name. */
export interface AS3FileLocalClassScope {
    readonly module: "application" | "bootstrap";
    readonly sourcePath: string;
    readonly ownerQualifiedName: string;
    readonly name: string;
}

export function fileLocalClassIdentity(scope: AS3FileLocalClassScope): Readonly<{
    key: string; reflectionName: string; localName: string;
}> {
    const qname = /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;
    if (!scope || typeof scope !== "object" || Array.isArray(scope)
        || Object.keys(scope).sort().join("\0") !== "module\0name\0ownerQualifiedName\0sourcePath"
        || (scope.module !== "application" && scope.module !== "bootstrap")
        || typeof scope.sourcePath !== "string" || scope.sourcePath.length > 4096
        || !/^(?:[A-Za-z0-9_$.-]+\/)*[A-Za-z_$][A-Za-z0-9_$]*\.as$/.test(scope.sourcePath)
        || scope.sourcePath.split("/").some(part => part === "." || part === "..")
        || typeof scope.ownerQualifiedName !== "string" || !qname.test(scope.ownerQualifiedName)
        || typeof scope.name !== "string" || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(scope.name)) {
        throw new TypeError("AS3 file-local class requires an exact portable source scope");
    }
    const basename = scope.sourcePath.slice(scope.sourcePath.lastIndexOf("/") + 1, -3);
    return Object.freeze({
        key: `FilePrivate(${scope.module}:${scope.sourcePath})::${scope.name}`,
        reflectionName: `FilePrivateNS:${basename}::${scope.name}`,
        localName: scope.name,
    });
}

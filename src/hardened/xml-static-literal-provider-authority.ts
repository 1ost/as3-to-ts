import {createHash} from "node:crypto";
import {HardenedSemanticError} from "./contracts";
import {verifySharedProviderTarget} from "./reflection-provider-authority";

export interface XMLStaticLiteralProviderTarget { readonly module: string; }

const MODULE = "src/layaAir/flash/utils/AS3XML.ts";
const TARGETS = [{module: MODULE, export: "as3XMLStaticLiteral", signature: "(source: string) => XML"}];
// This facade's pinned TypeScript closure reaches these four i18next declaration files.
const DECLARATION_DEPENDENCIES = [
    "node_modules/i18next/index.v4.d.ts",
    "node_modules/i18next/typescript/helpers.d.ts",
    "node_modules/i18next/typescript/options.d.ts",
    "node_modules/i18next/typescript/t.v4.d.ts",
];
const verified = new WeakMap<object, string>();
const hash = (text: string): string => createHash("sha256").update(text).digest("hex");

function fail(message: string): never {
    throw new HardenedSemanticError("HARDENED_XML_STATIC_LITERAL_PROVIDER_AUTHORITY", message);
}

export function loadXMLStaticLiteralProviderTarget(
    proof: string, targetPath: string, targetJson: string,
): XMLStaticLiteralProviderTarget {
    try {
        verifySharedProviderTarget(proof, targetPath, targetJson,
            "as3-xml-static-literal-provider-target@1", TARGETS,
            [], "api.flash.utils", DECLARATION_DEPENDENCIES);
    } catch (error) {
        fail("XML static literal provider: " + (error instanceof Error ? error.message : String(error)));
    }
    const target = Object.freeze({module: MODULE});
    verified.set(target, hash(targetJson));
    return target;
}

export function assertXMLStaticLiteralProviderTarget(
    target: XMLStaticLiteralProviderTarget, targetJson: string,
): void {
    if (!target || verified.get(target) !== hash(targetJson))
        fail("XML static literal provider requires a verified source closure");
}

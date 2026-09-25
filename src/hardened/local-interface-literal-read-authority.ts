import { HardenedSemanticError } from "./contracts";

export const LOCAL_INTERFACE_LITERAL_READ_AUTHORITY = Object.freeze({
    schema: "as3-local-interface-literal-public-trait-read-authority@1" as const,
    evidenceRevision: "0bea00b53688f473a33071c6edf347a32c14e202" as const,
    nativeEvidenceSha256: "5ebbc6d122df4b60ba3e087e171ee473e3fa1fcfa1f275fff470ad4f53b45fb7" as const,
    browserEvidenceSha256: "6ae63ffd5493bf872ee3b963132f7e66df1562d848fb07821f7bb2970559532d" as const,
    browserPinSha256: "45bc73c2940432aab50ad6f916c15c848cc19bae6ff4cc75c5cd0443ac7aa44e" as const,
    browserRunnerSha256: "dec6252f3824601efd50de115e957ad53284450d6187dd560098d6422e5147f3" as const,
    runtimeObjectDispatchSourcePath: "src/hardened-runtime/AS3ObjectDispatch.ts" as const,
    runtimeObjectDispatchSourceSha256: "065dd75c26c6d5cb1160f02d2ae10370e03eccb294b33416e4abd852ecc8aba7" as const,
    runtimeTypeSourcePath: "src/hardened-runtime/AS3Type.ts" as const,
    runtimeTypeSourceSha256: "02f2acb486155e4718075f749cd45056c39175cb58c6c8aaf001af30b7104f60" as const,
    runtimeTypeRegistrySourcePath: "src/hardened-runtime/internal/AS3TypeRegistry.ts" as const,
    runtimeTypeRegistrySourceSha256: "524fe980ec5afc2573cb6a048efdc1bc6da50274073edd99cb65a09bf642b71d" as const,
    authoritySha256: "20cd880e77e3779c95e18ff472fa4946bb6d14ad37b0dadecd1c97c397819929" as const,
});

export interface LocalInterfaceLiteralReadProof {
    readonly schema: "as3-local-interface-literal-public-trait-read@1";
    readonly receiverQName: string;
    readonly propertyName: string;
    readonly evidenceRevision: typeof LOCAL_INTERFACE_LITERAL_READ_AUTHORITY.evidenceRevision;
    readonly authoritySha256: typeof LOCAL_INTERFACE_LITERAL_READ_AUTHORITY.authoritySha256;
}

const QNAME = /^(?:[A-Za-z_$][A-Za-z0-9_$]*\.)*[A-Za-z_$][A-Za-z0-9_$]*$/;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function localInterfaceLiteralReadProof(receiverQName:string,
    propertyName:string):LocalInterfaceLiteralReadProof {
    if(!QNAME.test(receiverQName)||!IDENTIFIER.test(propertyName)) {
        throw new HardenedSemanticError("HARDENED_LOCAL_INTERFACE_LITERAL_READ_AUTHORITY",
            "local interface literal read identity is invalid");
    }
    return Object.freeze({schema:"as3-local-interface-literal-public-trait-read@1" as const,
        receiverQName,propertyName,evidenceRevision:LOCAL_INTERFACE_LITERAL_READ_AUTHORITY.evidenceRevision,
        authoritySha256:LOCAL_INTERFACE_LITERAL_READ_AUTHORITY.authoritySha256});
}

export function assertLocalInterfaceLiteralReadProof(value:unknown,receiverQName:string,
    propertyName:string):asserts value is LocalInterfaceLiteralReadProof {
    const proof=value as Partial<LocalInterfaceLiteralReadProof>|null;
    if(!proof||typeof proof!=="object"||Object.getPrototypeOf(proof)!==Object.prototype
        ||Object.keys(proof).sort().join("\0")!==["authoritySha256","evidenceRevision","propertyName","receiverQName","schema"].join("\0")
        ||proof.schema!=="as3-local-interface-literal-public-trait-read@1"
        ||proof.receiverQName!==receiverQName||proof.propertyName!==propertyName
        ||proof.evidenceRevision!==LOCAL_INTERFACE_LITERAL_READ_AUTHORITY.evidenceRevision
        ||proof.authoritySha256!==LOCAL_INTERFACE_LITERAL_READ_AUTHORITY.authoritySha256) {
        throw new HardenedSemanticError("HARDENED_LOCAL_INTERFACE_LITERAL_READ_AUTHORITY",
            "semantic local-interface read lacks its exact retained evidence authority");
    }
}

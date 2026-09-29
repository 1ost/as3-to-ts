import { HardenedSemanticError } from "./contracts";

export const LOCAL_INTERFACE_COMPUTED_READ_AUTHORITY = Object.freeze({
    schema: "as3-local-interface-computed-public-trait-read-authority@1" as const,
    nativeEvidencePath: "tests/nativeFlashOracle/nested-interface-computed-read/native-air.json" as const,
    nativeEvidenceSha256: "7eb21de75a37e61b7124dc55d937a84f63344f905e05657ff25d3981d364b0ec" as const,
    runtimeObjectDispatchSourcePath: "src/hardened-runtime/AS3ObjectDispatch.ts" as const,
    runtimeObjectDispatchSourceSha256: "065dd75c26c6d5cb1160f02d2ae10370e03eccb294b33416e4abd852ecc8aba7" as const,
    runtimeTypeSourcePath: "src/hardened-runtime/AS3Type.ts" as const,
    runtimeTypeSourceSha256: "02f2acb486155e4718075f749cd45056c39175cb58c6c8aaf001af30b7104f60" as const,
    runtimeTypeRegistrySourcePath: "src/hardened-runtime/internal/AS3TypeRegistry.ts" as const,
    runtimeTypeRegistrySourceSha256: "524fe980ec5afc2573cb6a048efdc1bc6da50274073edd99cb65a09bf642b71d" as const,
    authoritySha256: "0646cb097bfb5567af18fa88b1276c5905bd875a6c61f4c5e0da6cc1a3296839" as const,
});

export type LocalInterfaceComputedKeyBinding = "local" | "parameter";

export interface LocalInterfaceComputedReadProof {
    readonly schema: "as3-local-interface-computed-public-trait-read@1";
    readonly receiverQName: string;
    readonly keyName: string;
    readonly keyBindingKind: LocalInterfaceComputedKeyBinding;
    readonly nativeEvidenceSha256: typeof LOCAL_INTERFACE_COMPUTED_READ_AUTHORITY.nativeEvidenceSha256;
    readonly authoritySha256: typeof LOCAL_INTERFACE_COMPUTED_READ_AUTHORITY.authoritySha256;
}

const QNAME = /^(?:[A-Za-z_$][A-Za-z0-9_$]*\.)*[A-Za-z_$][A-Za-z0-9_$]*$/;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function localInterfaceComputedReadProof(receiverQName: string, keyName: string,
    keyBindingKind: LocalInterfaceComputedKeyBinding): LocalInterfaceComputedReadProof {
    if (!QNAME.test(receiverQName) || !IDENTIFIER.test(keyName)
        || keyBindingKind !== "local" && keyBindingKind !== "parameter") {
        throw new HardenedSemanticError("HARDENED_LOCAL_INTERFACE_COMPUTED_READ_AUTHORITY",
            "computed local-interface read identity is invalid");
    }
    return Object.freeze({
        schema: "as3-local-interface-computed-public-trait-read@1" as const,
        receiverQName, keyName, keyBindingKind,
        nativeEvidenceSha256: LOCAL_INTERFACE_COMPUTED_READ_AUTHORITY.nativeEvidenceSha256,
        authoritySha256: LOCAL_INTERFACE_COMPUTED_READ_AUTHORITY.authoritySha256,
    });
}

export function assertLocalInterfaceComputedReadProof(value: unknown, receiverQName: string,
    keyName: string, keyBindingKind: LocalInterfaceComputedKeyBinding): asserts value is LocalInterfaceComputedReadProof {
    const proof = value as Partial<LocalInterfaceComputedReadProof> | null;
    if (!proof || typeof proof !== "object" || Object.getPrototypeOf(proof) !== Object.prototype
        || Object.keys(proof).sort().join("\0") !== ["authoritySha256", "keyBindingKind", "keyName",
            "nativeEvidenceSha256", "receiverQName", "schema"].sort().join("\0")
        || proof.schema !== "as3-local-interface-computed-public-trait-read@1"
        || proof.receiverQName !== receiverQName || proof.keyName !== keyName
        || proof.keyBindingKind !== keyBindingKind
        || proof.nativeEvidenceSha256 !== LOCAL_INTERFACE_COMPUTED_READ_AUTHORITY.nativeEvidenceSha256
        || proof.authoritySha256 !== LOCAL_INTERFACE_COMPUTED_READ_AUTHORITY.authoritySha256) {
        throw new HardenedSemanticError("HARDENED_LOCAL_INTERFACE_COMPUTED_READ_AUTHORITY",
            "semantic computed local-interface read lacks its exact retained evidence authority");
    }
}

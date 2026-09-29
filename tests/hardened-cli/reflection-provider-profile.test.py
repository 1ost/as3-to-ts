import importlib.util
import json
import os
from pathlib import Path
import tempfile
import types
import subprocess
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("reflection_profile", ROOT / "tools/reflection_provider_profile.py")
producer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(producer)
REAL_RUN = subprocess.run


class ProducerTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.laya, self.profile = self.root / "laya", self.root / "profile"
        self.profile.mkdir()
        rows = []
        for module, exported, signature in producer.TARGETS:
            path = self.laya / module
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("// Test resolver fixture, not native or target implementation\n")
            rows.append(dict(module=module, export=exported, kind="function", signature=signature, sha256=producer.sha(path)))
        self.target = self.laya / "docTool/architecture/authored-content-capabilities.json"
        self.target.parent.mkdir(parents=True)
        self.document = {"capabilities": [{"id": producer.CAPABILITY, "status": "typescript-obligation", "obligations": rows}]}
        self.save()

    def save(self):
        self.target.write_bytes(producer.canonical(self.document))

    def resolve(self, command, **options):
        if command[:2] == ["node", "-e"]:
            return REAL_RUN(command, **options)
        self.assertEqual(command, ["node", str(ROOT / "tools/resolve-laya-export.cjs")])
        request = json.loads(options["input"])
        path = self.laya / request["facade"]["module"]
        return types.SimpleNamespace(returncode=0, stdout=json.dumps({"index": 0, "inputs": {str(path): producer.sha(path)}}), stderr="")

    def produce(self):
        return producer.produce_reflection_provider_profile(profile_root=self.profile, laya_root=self.laya)

    def test_publication_exact_union_and_no_native_mapping(self):
        with patch.object(producer.subprocess, "run", side_effect=self.resolve):
            result = self.produce()
        proof = json.loads((self.profile / result["file"]["path"]).read_text())
        self.assertEqual(result["file"]["sha256"], producer.sha(self.profile / "reflection-provider.json"))
        self.assertEqual(set(proof["targetSources"]), {row[0] for row in producer.TARGETS})
        self.assertEqual(result["manifestPins"], {})
        self.assertNotIn("sourceQName", proof)
        self.assertEqual(proof["targetCapabilitiesSha256"], producer.sha(self.target))
        with patch.object(producer.subprocess, "run", side_effect=self.resolve):
            with self.assertRaises(FileExistsError):
                self.produce()

    def test_duplicate_and_signature_rejected_without_publication(self):
        for mutation in ("duplicate", "signature"):
            rows = self.document["capabilities"][0]["obligations"]
            previous = json.loads(json.dumps(rows))
            if mutation == "duplicate": rows.append(dict(rows[0]))
            else: rows[0]["signature"] = "() => any"
            self.save()
            with self.assertRaisesRegex(ValueError, "exact unique"):
                self.produce()
            self.assertFalse((self.profile / "reflection-provider.json").exists())
            self.document["capabilities"][0]["obligations"] = previous

    def test_changed_hash_and_escaping_source_rejected(self):
        for mode in ("hash", "escape"):
            def resolve(command, **options):
                response = self.resolve(command, **options)
                if command[:2] == ["node", "-e"]: return response
                result = json.loads(response.stdout)
                if mode == "hash": result["inputs"] = {next(iter(result["inputs"])): "0" * 64}
                else: result["inputs"] = {str(ROOT / "tools/reflection_provider_profile.py"): producer.sha(ROOT / "tools/reflection_provider_profile.py")}
                response.stdout = json.dumps(result)
                return response
            with patch.object(producer.subprocess, "run", side_effect=resolve):
                with self.assertRaises(ValueError): self.produce()
            self.assertFalse((self.profile / "reflection-provider.json").exists())

    def test_ledger_drift_during_resolution_rejected(self):
        def resolve(command, **options):
            response = self.resolve(command, **options)
            if command[:2] != ["node", "-e"]:
                self.target.write_bytes(self.target.read_bytes() + b" ")
            return response
        with patch.object(producer.subprocess, "run", side_effect=resolve):
            with self.assertRaisesRegex(ValueError, "changed during"):
                self.produce()
        self.assertFalse((self.profile / "reflection-provider.json").exists())

    def test_tool_dependency_change_changes_inspection_and_midrun_drift_fails(self):
        tool = self.root / "typescript.js"
        tool.write_text("// first fixture tool bytes\n")
        with patch.object(producer, "_tool_inputs", side_effect=lambda: {str(tool): producer.sha(tool)}):
            with patch.object(producer.subprocess, "run", side_effect=self.resolve):
                first = producer.inspect_reflection_provider_inputs(self.laya)
                tool.write_text("// changed fixture tool bytes\n")
                second = producer.inspect_reflection_provider_inputs(self.laya)
            self.assertNotEqual(first[str(tool)], second[str(tool)])
            def mutate(command, **options):
                response = self.resolve(command, **options)
                tool.write_text(tool.read_text() + "// changed during resolution\n")
                return response
            with patch.object(producer.subprocess, "run", side_effect=mutate):
                with self.assertRaisesRegex(ValueError, "changed during"):
                    self.produce()
            self.assertFalse((self.profile / "reflection-provider.json").exists())

    @unittest.skipUnless(os.environ.get("HARDENED_FIXTURE_LAYA"), "actual shared target not supplied")
    def test_actual_resolver_target(self):
        inspected = producer.inspect_reflection_provider_inputs(os.environ["HARDENED_FIXTURE_LAYA"])
        self.assertEqual(list(self.profile.iterdir()), [])
        result = producer.produce_reflection_provider_profile(profile_root=self.profile, laya_root=os.environ["HARDENED_FIXTURE_LAYA"])
        self.assertEqual(result["generatorInputs"], inspected)
        self.assertTrue(any(name.endswith("/typescript.js") for name in inspected))
        self.assertTrue(any(name.endswith("/typescript-4-9/package.json") for name in inspected))
        self.assertFalse(any(Path(name).is_relative_to(self.profile) for name in inspected))
        proof = json.loads((self.profile / result["file"]["path"]).read_text())
        self.assertGreaterEqual(len(proof["targetSources"]), 3)
        self.assertEqual([row["export"] for row in proof["targets"]], [row[1] for row in producer.TARGETS])


if __name__ == "__main__":
    unittest.main()

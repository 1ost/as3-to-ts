import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("profiles", Path(__file__).resolve().parents[2] / "tools/create-fixture-profile.py")
profiles = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profiles)


class NativePropertyAccess(unittest.TestCase):
    def setUp(self):
        self.native = {"Derived": {"properties": [], "baseQName": "Base"}, "Base": {
            "baseQName": None, "properties": [{"name": "visible", "access": access, "type": "Boolean"} for access in ("read", "write")]}}
        self.target = {"module": "Sprite.ts", "export": "Sprite", "kind": "class", "signature": "Sprite",
                       "members": [{"name": "visible", "scope": "instance", "kind": "get+set", "signature": "boolean"}]}

    def mappings(self):
        return profiles.primitive_property_mappings("Derived", ["base-type"], self.target, "sprite", self.native)[0]

    def test_inherited_read_and_write_keep_native_boolean_contract(self):
        rows = self.mappings()
        self.assertEqual([row["sourceMember"]["access"] for row in rows], ["read", "write"])
        self.assertTrue(all("Boolean" in row["sourceMember"]["signature"] for row in rows))

    def test_getter_only_setter_only_and_readonly_are_not_interchangeable(self):
        for kind, readonly, expected in [("get", False, ["read"]), ("set", False, ["write"]), ("get+set", True, ["read"])]:
            with self.subTest(kind=kind, readonly=readonly):
                self.target["members"][0].update(kind=kind, readonly=readonly)
                self.assertEqual([row["sourceMember"]["access"] for row in self.mappings()], expected)

    def test_target_type_mismatch_and_ambiguity_remain_unmapped(self):
        self.target["members"][0]["signature"] = "number"
        self.assertEqual(self.mappings(), [])
        self.target["members"][0]["signature"] = "boolean"
        self.target["members"].append(copy.deepcopy(self.target["members"][0]))
        self.assertEqual(self.mappings(), [])


if __name__ == "__main__":
    unittest.main()

import copy
import importlib.util
from pathlib import Path
import unittest
spec = importlib.util.spec_from_file_location('fixture', Path(__file__).with_name('create-fixture-profile.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ReferenceUnionClosure(unittest.TestCase):
    def document(self):
        def row(name, parents):
            return dict(kind='class', sourceQName='flash.'+name, constructorExport=name,
                        predicateSignature='(value: unknown) => value is '+name,
                        heritageClosure=parents, interfaces=[])
        base, stage = row('Base', []), row('Stage', ['flash.Base'])
        base['predicateSignature'] += ' | Stage'
        return dict(schema='laya-flash-runtime-type-predicates@2', types=[base,stage,row('Other',[])])

    def test_closure_retains_union_descendant_without_mutating_rows(self):
        doc = self.document()
        before = copy.deepcopy(doc)
        self.assertEqual(module.predicate_reference_closure(doc, ['flash.Base']), {'flash.Base','flash.Stage'})
        self.assertEqual(doc, before)
        self.assertEqual(module.predicate_reference_closure(doc, ['flash.Other']), {'flash.Other'})

    def test_malformed_unrelated_ambiguous_and_missing_arms_reject(self):
        for target in ['unknown','null','Other','Missing','Stage[]','Stage | Stage']:
            doc = self.document()
            doc['types'][0]['predicateSignature'] = '(value: unknown) => value is Base | '+target
            with self.assertRaises(ValueError): module.predicate_reference_closure(doc, ['flash.Base'])
        doc = self.document()
        doc['types'].append(dict(doc['types'][1],sourceQName='other.Stage'))
        with self.assertRaises(ValueError): module.predicate_reference_closure(doc, ['flash.Base'])
        doc = self.document()
        doc['types'][1]['heritageClosure'] = ['flash.Missing']
        with self.assertRaises(ValueError): module.predicate_reference_closure(doc, ['flash.Base'])

if __name__ == '__main__': unittest.main()

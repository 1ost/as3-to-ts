# Native Flash timer oracle

`RunMain.as` is a focused Apache Flex 4.16.1 / playerglobal 26 fixture captured
in Pepper Flash 26.0.0.131. The retained output proves that Flash timer IDs
share both one allocation domain and one cancellation domain: calling
`clearInterval` on a timeout ID and `clearTimeout` on an interval ID prevents
both callbacks. It also checks interval argument order, method-closure receiver,
self-clear after the second callback, distinct live IDs, and monotonic
`getTimer` elapsed time.

`pepper-flash-26.json` pins the fixture, output, compiler, playerglobal, Pepper
plug-in, capture runner, SWF, and stable repository-relative paths. The normal
runtime and maintained-source gates authenticate these bytes.

From the Bleach repository root, reproduce the capture with an Electron 10.4.7
binary that supports the pinned PPAPI plug-in:

```powershell
python as3-to-layaair-porting-kit\tests\native-runtime\prepare_xml_node_oracle.py `
  --compiler flex `
  --electron <electron-10.4.7.exe> `
  --fixture <local-tools>\tests\flash-oracle\native-timer\RunMain.as `
  --golden <local-tools>\tests\flash-oracle\native-timer\pepper-flash-26.txt `
  --provenance <temporary-generated-provenance.json> `
  --artifact-name native-flash-utils-timer `
  --normalization exact --capture
```

The generic capture helper records an absolute fixture location in its
temporary provenance. Review compares its semantic hashes, then retains the
portable repository-relative receipt checked in here.

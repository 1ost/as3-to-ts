package {
    import updatecases.NamespaceUpdatesProbe;
    public class NamespaceUpdatesOracle {
        public function snapshot():Object { return new NamespaceUpdatesProbe().snapshot(); }
    }
}

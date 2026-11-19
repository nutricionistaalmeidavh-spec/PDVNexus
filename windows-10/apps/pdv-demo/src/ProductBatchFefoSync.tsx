import { useEffect } from "react";
import { reconcileProductBatchFefoFromCurrentSnapshot } from "./productLabelBatchStore";

export function ProductBatchFefoSync() {
  useEffect(() => {
    let disposed = false;
    let running = false;

    const reconcile = async () => {
      if (disposed || running) return;
      running = true;
      try {
        await reconcileProductBatchFefoFromCurrentSnapshot();
      } catch {
        // FEFO é complementar: uma falha de reconciliação nunca bloqueia o caixa.
      } finally {
        running = false;
        if (queued && !disposed) {
          queued = false;
          queueMicrotask(() => { if (!disposed) void reconcile(); });
        }
      }
    };

    // Reconcile only after canonical commits, and when the app resumes focus.
    // A queued commit during reconciliation is replayed once the current pass ends.
    let queued = false;
    const onCommit = () => {
      if (running) { queued = true; return; }
      void reconcile();
    };
    const onFocus = () => { if (!document.hidden) onCommit(); };
    void reconcile();
    window.addEventListener("nexus-pdv:canonical-commit", onCommit);
    window.addEventListener("nexus-pdv:canonical-external-write", onCommit);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      disposed = true;
      window.removeEventListener("nexus-pdv:canonical-commit", onCommit);
      window.removeEventListener("nexus-pdv:canonical-external-write", onCommit);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  return null;
}

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
      }
    };

    void reconcile();
    const timer = window.setInterval(() => void reconcile(), 1200);
    const onFocus = () => void reconcile();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  return null;
}

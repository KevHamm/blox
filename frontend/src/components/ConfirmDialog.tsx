import { useEffect, useState } from "react";

// A custom, app-styled replacement for window.confirm. Call confirmDialog(...)
// anywhere to get a Promise<boolean>; a single <ConfirmHost/> mounted at the app
// root renders the modal and resolves the promise.

type ConfirmOpts = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type Pending = { opts: ConfirmOpts; resolve: (v: boolean) => void };

// The mounted host registers its setter here so confirmDialog can reach it.
let publish: ((p: Pending) => void) | null = null;

export function confirmDialog(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    if (publish) publish({ opts, resolve });
    else resolve(window.confirm(opts.message)); // fallback if host isn't mounted
  });
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    publish = (p) => setPending(p);
    return () => { publish = null; };
  }, []);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); done(false); }
      else if (e.key === "Enter") { e.preventDefault(); done(true); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  function done(v: boolean) {
    setPending((cur) => { cur?.resolve(v); return null; });
  }

  if (!pending) return null;
  const {
    title = "Are you sure?",
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    danger
  } = pending.opts;

  return (
    <div className="confirm-backdrop" onPointerDown={() => done(false)}>
      <div
        className="ui-panel confirm-card"
        role="alertdialog"
        aria-modal="true"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="confirm-title">{title}</div>
        <div className="confirm-message">{message}</div>
        <div className="confirm-actions">
          <button className="ui-btn" onClick={() => done(false)}>{cancelLabel}</button>
          <button
            className={`ui-btn ${danger ? "danger" : "primary"}`}
            onClick={() => done(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

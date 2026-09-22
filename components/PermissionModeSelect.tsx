"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/hooks/useI18n";

interface PermissionModeState {
  available: boolean;
  yolo: boolean;
}

/**
 * Approval mode of the pi permission extension, shown next to the model and
 * thinking level. This is a global switch: the extension reads one config file
 * for every session, so the control says so rather than pretending to be
 * per-session. Hidden when the extension is not installed.
 *
 * The menu opens upward — the input bar sits at the bottom of the window, so a
 * downward menu would be clipped by the edge.
 */
export function PermissionModeSelect() {
  const { t } = useI18n();
  const [state, setState] = useState<PermissionModeState | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/permission-mode")
      .then((response) => response.json())
      .then((body: PermissionModeState) => {
        if (!cancelled) setState(body);
      })
      .catch(() => {
        if (!cancelled) setState({ available: false, yolo: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const change = useCallback((yolo: boolean) => {
    setOpen(false);
    setState((previous) => (previous ? { ...previous, yolo } : previous));
    void fetch("/api/permission-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yolo }),
    })
      .then((response) => response.json())
      .then((body: PermissionModeState) => setState(body))
      .catch(() => {});
  }, []);

  if (!state?.available) return null;

  const options: Array<{ yolo: boolean; label: string; hint: string }> = [
    { yolo: false, label: t("chat.permissionAsk"), hint: t("chat.permissionAskHint") },
    { yolo: true, label: t("chat.permissionYolo"), hint: t("chat.permissionYoloHint") },
  ];

  return (
    <span ref={rootRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={t("chat.permissionModeTitle")}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: "none",
          border: "none",
          padding: 0,
          color: state.yolo ? "#f0a020" : "var(--text-dim)",
          cursor: "pointer",
          font: "inherit",
          fontSize: 11,
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        {state.yolo ? t("chat.permissionYolo") : t("chat.permissionAsk")}
        <svg
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.12s ease" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            marginBottom: 6,
            minWidth: 190,
            padding: 4,
            border: "1px solid color-mix(in srgb, var(--border) 72%, transparent)",
            borderRadius: 10,
            background: "color-mix(in srgb, var(--bg-panel) 92%, var(--bg))",
            boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
            backdropFilter: "blur(10px)",
            zIndex: 30,
          }}
        >
          {options.map((option) => (
            <button
              key={String(option.yolo)}
              type="button"
              role="option"
              aria-selected={state.yolo === option.yolo}
              onClick={() => change(option.yolo)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 1,
                width: "100%",
                padding: "6px 8px",
                background: state.yolo === option.yolo ? "var(--bg-selected)" : "none",
                border: "none",
                borderRadius: 7,
                color: "var(--text)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 12 }}>{option.label}</span>
              <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{option.hint}</span>
            </button>
          ))}
          <div style={{ padding: "4px 8px 2px", fontSize: 10, color: "var(--text-dim)" }}>
            {t("chat.permissionModeGlobal")}
          </div>
        </div>
      )}
    </span>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/hooks/useI18n";

type PermissionMode = "strict" | "ask" | "yolo";

interface PermissionModeState {
  available: boolean;
  mode: PermissionMode;
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
export function PermissionModeSelect({ disabled = false }: { disabled?: boolean }) {
  const { t } = useI18n();
  const [state, setState] = useState<PermissionModeState | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  // Upstream keeps the neighbouring thinking control mounted but disabled while a
  // turn streams; this control follows the same shape so the row does not jump.
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/permission-mode")
      .then((response) => response.json())
      .then((body: PermissionModeState) => {
        if (!cancelled) setState(body);
      })
      .catch(() => {
        if (!cancelled) setState({ available: false, mode: "ask" });
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

  const change = useCallback((mode: PermissionMode) => {
    setOpen(false);
    setState((previous) => (previous ? { ...previous, mode } : previous));
    void fetch("/api/permission-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    })
      .then((response) => response.json())
      .then((body: PermissionModeState) => setState(body))
      .catch(() => {});
  }, []);

  if (!state?.available) return null;

  const labels: Record<PermissionMode, { label: string; hint: string }> = {
    strict: { label: t("chat.permissionStrict"), hint: t("chat.permissionStrictHint") },
    ask: { label: t("chat.permissionAsk"), hint: t("chat.permissionAskHint") },
    yolo: { label: t("chat.permissionYolo"), hint: t("chat.permissionYoloHint") },
  };
  const order: PermissionMode[] = ["strict", "ask", "yolo"];
  const accent = state.mode === "yolo" ? "#f0a020" : state.mode === "strict" ? "#4ade80" : "var(--text-dim)";

  return (
    <span ref={rootRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={() => {
          if (!disabled) setOpen((value) => !value);
        }}
        disabled={disabled}
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
          color: accent,
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.55 : 1,
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
        {labels[state.mode].label}
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
      {open && !disabled && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            marginBottom: 6,
            minWidth: 210,
            padding: 4,
            border: "1px solid color-mix(in srgb, var(--border) 72%, transparent)",
            borderRadius: 10,
            background: "color-mix(in srgb, var(--bg-panel) 92%, var(--bg))",
            boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
            backdropFilter: "blur(10px)",
            zIndex: 30,
          }}
        >
          {order.map((mode) => (
            <button
              key={mode}
              type="button"
              role="option"
              aria-selected={state.mode === mode}
              onClick={() => change(mode)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 1,
                width: "100%",
                padding: "6px 8px",
                background: state.mode === mode ? "var(--bg-selected)" : "none",
                border: "none",
                borderRadius: 7,
                color: "var(--text)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 12 }}>{labels[mode].label}</span>
              <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{labels[mode].hint}</span>
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

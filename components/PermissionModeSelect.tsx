"use client";

import { useCallback, useEffect, useState } from "react";
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
 */
export function PermissionModeSelect() {
  const { t } = useI18n();
  const [state, setState] = useState<PermissionModeState | null>(null);

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

  const change = useCallback((yolo: boolean) => {
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

  return (
    <span
      title={t("chat.permissionModeTitle")}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        color: state.yolo ? "#f0a020" : "var(--text-dim)",
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
      <select
        value={state.yolo ? "yolo" : "ask"}
        onChange={(event) => change(event.target.value === "yolo")}
        aria-label={t("chat.permissionModeTitle")}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          color: "inherit",
          font: "inherit",
          fontSize: 11,
          cursor: "pointer",
        }}
      >
        <option value="ask">{t("chat.permissionAsk")}</option>
        <option value="yolo">{t("chat.permissionYolo")}</option>
      </select>
    </span>
  );
}

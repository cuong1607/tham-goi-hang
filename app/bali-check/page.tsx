"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { BaliCompareResult, BaliCompareResultItem } from "@/lib/bali-check/types";

// ── Color tokens ─────────────────────────────────────────────
const C = {
  primary:       "#b45309",
  primaryLight:  "#fffbeb",
  primaryBorder: "#fcd34d",
  success:       "#15803d",
  successLight:  "#f0fdf4",
  successBorder: "#86efac",
  danger:        "#dc2626",
  dangerLight:   "#fef2f2",
  dangerBorder:  "#fca5a5",
  warning:       "#d97706",
  warningLight:  "#fef3c7",
  warningBorder: "#fcd34d",
  info:          "#2563eb",
  infoLight:     "#eff6ff",
  infoBorder:    "#93c5fd",
  purple:        "#7c3aed",
  purpleLight:   "#f5f3ff",
  purpleBorder:  "#c4b5fd",
  muted:         "#6b7280",
  mutedBg:       "#f9fafb",
  border:        "#e5e7eb",
  text:          "#111827",
  textLight:     "#374151",
};

type ActiveTab = "needCall" | "alreadyEnough" | "partial" | "diffSize" | "diffGroup";

// ── Helpers ───────────────────────────────────────────────────

// Group items by group → size → items
function groupMatrix(items: BaliCompareResultItem[]): Map<string, Map<string, BaliCompareResultItem[]>> {
  const result = new Map<string, Map<string, BaliCompareResultItem[]>>();
  for (const item of items) {
    if (!result.has(item.group)) result.set(item.group, new Map());
    const sizeMap = result.get(item.group)!;
    if (!sizeMap.has(item.size)) sizeMap.set(item.size, []);
    sizeMap.get(item.size)!.push(item);
  }
  return result;
}

const GROUP_ORDER = ["BACAU","NT","NTNEW","ARAP","VINTAGE","CARO","BALI","TRON","OVAL","HD","PC","GOC","THD"];
const SIZE_ORDER  = ["80x150","80x200","100x100","100x150","120x120","120x160","140x200","160x160","160x230","200x300"];

function sortedGroupKeys(map: Map<string, unknown>): string[] {
  const keys = Array.from(map.keys());
  return keys.sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a);
    const ib = GROUP_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function sortedSizeKeys(map: Map<string, unknown>): string[] {
  const keys = Array.from(map.keys());
  return keys.sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a);
    const ib = SIZE_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function formatNeedCallText(needCall: BaliCompareResultItem[]): string {
  const grouped = groupMatrix(needCall);
  const lines: string[] = [];
  for (const group of sortedGroupKeys(grouped)) {
    const sizeMap = grouped.get(group)!;
    lines.push(group);
    for (const size of sortedSizeKeys(sizeMap)) {
      const items = sizeMap.get(size)!;
      const strs = items.map((item) =>
        item.missingQuantity > 1 ? `${item.cleanPattern}(${item.missingQuantity})` : item.cleanPattern
      );
      lines.push(`${size}: ${strs.join(", ")}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

// ── Spinner ───────────────────────────────────────────────────
function Spinner() {
  return (
    <span style={{
      display: "inline-block", width: 18, height: 18,
      border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff",
      borderRadius: "50%", animation: "spin 0.7s linear infinite",
      verticalAlign: "middle", marginRight: 8,
    }} />
  );
}

// ── Button style helper ───────────────────────────────────────
function btnStyle(color: string, disabled?: boolean): React.CSSProperties {
  return {
    padding: "8px 16px", borderRadius: 7, border: "none",
    background: disabled ? "#d1d5db" : color,
    color: "#fff", fontWeight: 600, fontSize: 13,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex", alignItems: "center", gap: 6,
  };
}

// ── Summary Card ──────────────────────────────────────────────
function SummaryCard({ result }: { result: BaliCompareResult }) {
  const { summary } = result;
  const cards = [
    { label: "Tổng mẫu đầu vào",   value: summary.totalInputItems,      color: C.info,    bg: C.infoLight },
    { label: "Cần gọi hàng",        value: summary.needCallCount,         color: C.danger,  bg: C.dangerLight },
    { label: "Đã có đủ hàng",       value: summary.alreadyEnoughCount,    color: C.success, bg: C.successLight },
    { label: "Có nhưng chưa đủ",    value: summary.partialAvailableCount, color: C.warning, bg: C.warningLight },
    { label: "Khác size",            value: summary.differentSizeCount,    color: C.purple,  bg: C.purpleLight },
    { label: "Khác nhóm",           value: summary.differentGroupCount,   color: C.primary, bg: C.primaryLight },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 20 }}>
      {cards.map((c) => (
        <div key={c.label} style={{
          background: c.bg, borderRadius: 10, padding: "14px 8px", textAlign: "center",
          border: `1px solid ${c.color}30`,
        }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: c.color }}>{c.value}</div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 4, lineHeight: 1.3 }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Tab Button ────────────────────────────────────────────────
function TabBtn({ label, count, active, color, onClick }: {
  label: string; count: number; active: boolean; color: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 12px", borderRadius: "8px 8px 0 0",
      border: `1px solid ${active ? color : C.border}`,
      borderBottom: active ? "1px solid #fff" : `1px solid ${C.border}`,
      background: active ? "#fff" : C.mutedBg,
      color: active ? color : C.muted,
      fontWeight: active ? 700 : 400,
      fontSize: 12, cursor: "pointer", marginBottom: -1,
      display: "inline-flex", alignItems: "center", gap: 5,
      transition: "all 0.15s",
    }}>
      {label}
      <span style={{
        background: active ? color : "#ddd",
        color: active ? "#fff" : "#666",
        borderRadius: 10, padding: "1px 6px", fontSize: 11, fontWeight: 700,
      }}>{count}</span>
    </button>
  );
}

// ── NeedCall Tab ──────────────────────────────────────────────
function NeedCallTab({ items, onCopy, onExport }: {
  items: BaliCompareResultItem[];
  onCopy: () => void;
  onExport: () => void;
}) {
  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>
        🎉 Không có mẫu nào cần gọi thêm!
      </div>
    );
  }

  const grouped = groupMatrix(items);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={onCopy} style={btnStyle(C.success)}>📋 Copy danh sách</button>
        <button onClick={onExport} style={btnStyle(C.info)}>⬇️ Export .txt</button>
      </div>
      {sortedGroupKeys(grouped).map((group) => {
        const sizeMap = grouped.get(group)!;
        return (
          <div key={group} style={{ marginBottom: 20 }}>
            <div style={{
              fontWeight: 800, fontSize: 16, color: C.danger,
              borderBottom: `2px solid ${C.dangerBorder}`,
              paddingBottom: 4, marginBottom: 8,
              textTransform: "uppercase",
            }}>
              🚨 {group}
            </div>
            {sortedSizeKeys(sizeMap).map((size) => {
              const sizeItems = sizeMap.get(size)!;
              return (
                <div key={size} style={{ marginBottom: 6, paddingLeft: 8 }}>
                  <span style={{ fontWeight: 600, color: C.textLight, fontSize: 13 }}>{size}: </span>
                  {sizeItems.map((item: BaliCompareResultItem, i: number) => (
                    <span key={i}>
                      {i > 0 && <span style={{ color: C.muted }}>, </span>}
                      <span style={{ fontWeight: 600, color: C.danger }}>{item.cleanPattern}</span>
                      {item.missingQuantity > 1 && (
                        <span style={{
                          background: C.danger, color: "#fff",
                          borderRadius: 10, padding: "0 6px", fontSize: 11,
                          fontWeight: 700, marginLeft: 2,
                        }}>({item.missingQuantity})</span>
                      )}
                      {item.status === "partial_available" && (
                        <span style={{
                          fontSize: 10, color: C.warning,
                          border: `1px solid ${C.warningBorder}`,
                          borderRadius: 6, padding: "0 4px", marginLeft: 4,
                          background: C.warningLight,
                        }}>kho có {item.availableQuantity}</span>
                      )}
                      {item.status === "need_call_different_size" && (
                        <span style={{
                          fontSize: 10, color: C.purple,
                          border: `1px solid ${C.purpleBorder}`,
                          borderRadius: 6, padding: "0 4px", marginLeft: 4,
                          background: C.purpleLight,
                        }}>khác size</span>
                      )}
                      {item.status === "need_call_different_group" && (
                        <span style={{
                          fontSize: 10, color: C.primary,
                          border: `1px solid ${C.primaryBorder}`,
                          borderRadius: 6, padding: "0 4px", marginLeft: 4,
                          background: C.primaryLight,
                        }}>khác nhóm</span>
                      )}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── AlreadyEnough Tab ─────────────────────────────────────────
function AlreadyEnoughTab({ items }: { items: BaliCompareResultItem[] }) {
  if (items.length === 0) {
    return <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>Không có mẫu nào đã có đủ hàng.</div>;
  }
  const grouped = groupMatrix(items);
  return (
    <div>
      {sortedGroupKeys(grouped).map((group) => {
        const sizeMap = grouped.get(group)!;
        return (
          <div key={group} style={{ marginBottom: 20 }}>
            <div style={{
              fontWeight: 800, fontSize: 15, color: C.success,
              borderBottom: `2px solid ${C.successBorder}`,
              paddingBottom: 4, marginBottom: 8,
            }}>✅ {group}</div>
            {sortedSizeKeys(sizeMap).map((size) => {
              const sizeItems = sizeMap.get(size)!;
              return (
                <div key={size} style={{ marginBottom: 4, paddingLeft: 8, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: C.textLight }}>{size}: </span>
                  {sizeItems.map((item: BaliCompareResultItem, i: number) => (
                    <span key={i}>
                      {i > 0 && <span style={{ color: C.muted }}>, </span>}
                      <span style={{ color: C.success }}>{item.cleanPattern}</span>
                      {item.orderQuantity > 1 && (
                        <span style={{ color: C.muted, fontSize: 12 }}> (cần {item.orderQuantity}, có {item.availableQuantity})</span>
                      )}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Partial Tab ───────────────────────────────────────────────
function PartialTab({ items }: { items: BaliCompareResultItem[] }) {
  if (items.length === 0) {
    return <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>Không có mẫu nào thiếu số lượng.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{
        background: C.warningLight, border: `1px solid ${C.warningBorder}`,
        borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.warning, marginBottom: 4,
      }}>
        ⚠️ Các mẫu này vẫn xuất hiện trong tab &quot;Cần gọi hàng&quot; với số lượng cần gọi thêm.
      </div>
      {items.map((item: BaliCompareResultItem, i: number) => (
        <div key={i} style={{
          background: C.warningLight, border: `1px solid ${C.warningBorder}`,
          borderRadius: 8, padding: "10px 14px", fontSize: 14,
        }}>
          <div style={{ fontWeight: 700, color: C.warning, marginBottom: 4 }}>
            {item.group} / {item.size} / {item.cleanPattern}
          </div>
          <div style={{ color: C.textLight, lineHeight: 1.8 }}>
            Cần: <strong>{item.orderQuantity}</strong> &nbsp;|&nbsp;
            Kho có: <strong>{item.availableQuantity}</strong> &nbsp;|&nbsp;
            Cần gọi thêm: <strong style={{ color: C.danger }}>{item.missingQuantity}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── DiffSize Tab ──────────────────────────────────────────────
function DiffSizeTab({ items }: { items: BaliCompareResultItem[] }) {
  if (items.length === 0) {
    return <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>Không có mẫu nào bị lệch size.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{
        background: C.purpleLight, border: `1px solid ${C.purpleBorder}`,
        borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.purple, marginBottom: 4,
      }}>
        📐 Các mẫu này vẫn cần gọi. Không được trừ tồn kho từ size khác.
      </div>
      {items.map((item: BaliCompareResultItem, i: number) => (
        <div key={i} style={{
          background: C.purpleLight, border: `1px solid ${C.purpleBorder}`,
          borderRadius: 8, padding: "10px 14px", fontSize: 14,
        }}>
          <div style={{ fontWeight: 700, color: C.purple, marginBottom: 4 }}>
            ⚠️ {item.group} / {item.cleanPattern} — size {item.size}
          </div>
          <div style={{ color: C.textLight, lineHeight: 1.6 }}>
            Tìm thấy ở size:{" "}
            {(item.foundAtSizes ?? []).map((s) => (
              <span key={s} style={{
                background: "#fff", border: `1px solid ${C.purpleBorder}`,
                borderRadius: 4, padding: "1px 6px", marginRight: 4,
                fontWeight: 600, color: C.purple,
              }}>{s}</span>
            ))}
            <br />
            <span style={{ color: C.danger }}>Không có ở size {item.size} → vẫn cần gọi.</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── DiffGroup Tab ─────────────────────────────────────────────
function DiffGroupTab({ items }: { items: BaliCompareResultItem[] }) {
  if (items.length === 0) {
    return <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>Không có mẫu nào bị lệch nhóm.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{
        background: C.primaryLight, border: `1px solid ${C.primaryBorder}`,
        borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.primary, marginBottom: 4,
      }}>
        🔄 Các mẫu này vẫn cần gọi. Không được trừ tồn kho từ nhóm khác.
      </div>
      {items.map((item: BaliCompareResultItem, i: number) => (
        <div key={i} style={{
          background: C.primaryLight, border: `1px solid ${C.primaryBorder}`,
          borderRadius: 8, padding: "10px 14px", fontSize: 14,
        }}>
          <div style={{ fontWeight: 700, color: C.primary, marginBottom: 4 }}>
            🔄 {item.cleanPattern} (size {item.size}) — nhóm {item.group}
          </div>
          <div style={{ color: C.textLight, lineHeight: 1.6 }}>
            Tìm thấy ở nhóm:{" "}
            {(item.foundAtGroups ?? []).map((g) => (
              <span key={g} style={{
                background: "#fff", border: `1px solid ${C.primaryBorder}`,
                borderRadius: 4, padding: "1px 6px", marginRight: 4,
                fontWeight: 600, color: C.primary,
              }}>{g}</span>
            ))}
            <br />
            <span style={{ color: C.danger }}>Không có ở nhóm {item.group} → vẫn cần gọi.</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Card helpers ──────────────────────────────────────────────
function cardStyle(): React.CSSProperties {
  return {
    background: "#fff", borderRadius: 12, padding: "20px",
    border: `1px solid ${C.border}`, marginBottom: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: "block", fontSize: 11, fontWeight: 600,
    color: C.muted, textTransform: "uppercase" as const,
    letterSpacing: "0.05em", marginBottom: 6,
  };
}

// ── Main Page ─────────────────────────────────────────────────
export default function BaliCheckPage() {
  const [sheetUrl, setSheetUrl] = useState("");
  const [savedUrl, setSavedUrl] = useState("");
  const [orderText, setOrderText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<BaliCompareResult | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("needCall");
  const [toastMsg, setToastMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Load saved URL
  useEffect(() => {
    fetch("/api/bali-check/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.googleSheetUrl) {
          setSheetUrl(d.googleSheetUrl);
          setSavedUrl(d.googleSheetUrl);
        }
      })
      .catch(() => {});
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  const handleSaveUrl = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/bali-check/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleSheetUrl: sheetUrl }),
      });
      const d = await res.json();
      if (res.ok) {
        setSavedUrl(sheetUrl);
        showToast("✅ Đã lưu Google Sheet URL");
      } else {
        showToast("❌ " + (d.error ?? "Lỗi lưu URL"));
      }
    } catch {
      showToast("❌ Không kết nối được server");
    } finally {
      setSaving(false);
    }
  };

  const handleCompare = async () => {
    if (!orderText.trim()) {
      setError("Vui lòng nhập text gọi hàng.");
      return;
    }
    const hasUrl = sheetUrl.trim().length > 0;
    const hasFile = file !== null;

    if (!hasUrl && !hasFile) {
      setError("Vui lòng cung cấp Google Sheet URL hoặc upload file .xlsx/.csv.");
      return;
    }
    if (hasUrl && hasFile) {
      setError("Vui lòng chỉ chọn một nguồn: Google Sheet URL HOẶC file upload.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("orderText", orderText);
      if (hasUrl) formData.append("googleSheetUrl", sheetUrl);
      if (hasFile) formData.append("file", file!);

      const res = await fetch("/api/bali-check/compare", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Lỗi không xác định");
      } else {
        setResult(data);
        setActiveTab("needCall");
      }
    } catch {
      setError("Không kết nối được server");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = useCallback(() => {
    if (!result) return;
    const text = formatNeedCallText(result.needCall);
    navigator.clipboard.writeText(text).then(() => {
      showToast("✅ Đã copy danh sách cần gọi!");
    });
  }, [result]);

  const handleExport = useCallback(() => {
    if (!result) return;
    const text = formatNeedCallText(result.needCall);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bali-can-goi-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const EXAMPLE_ORDER = `BACAU
80cmx150cm: 17
80cmx200cm: 08
120cmx160cm: 17
140cmx200cm: 47
160cmx230cm: 21
200cmx300cm: 13

NT
120cmx160cm: 02
140cmx200cm: 02, 11

NTNEW
120cmx160cm: 01`;

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }
        * { box-sizing: border-box; }
        body { background: #f3f4f6; margin: 0; }
        textarea:focus, input:focus { outline: 2px solid ${C.primary}; outline-offset: 1px; }
        button:hover { opacity: 0.88; }
        a { color: ${C.primary}; }
      `}</style>

      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: "fixed", top: 16, right: 16, zIndex: 9999,
          background: "#1f2937", color: "#fff",
          padding: "10px 18px", borderRadius: 8, fontSize: 14,
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          animation: "fadeIn 0.2s ease",
        }}>
          {toastMsg}
        </div>
      )}

      <div style={{ minHeight: "100vh", padding: "24px 16px", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <a href="/" style={{
              fontSize: 13, color: C.muted, textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12,
            }}>← Về trang chủ</a>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>
              🟡 Đối soát Gọi Hàng Thảm Bali To
            </h1>
            <p style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>
              So sánh text gọi hàng Bali To với tồn kho từ Google Sheet ma trận — chỉ hiển thị số lượng còn thiếu.
            </p>
          </div>

          {/* Card 1: Nguồn dữ liệu */}
          <div style={cardStyle()}>
            <div style={{
              fontWeight: 700, fontSize: 14, color: C.primary,
              marginBottom: 16, display: "flex", alignItems: "center", gap: 8,
            }}>
              📊 Nguồn dữ liệu tồn kho
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle()}>Google Sheet URL (public)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  id="bali-sheet-url-input"
                  type="text"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  style={{
                    flex: 1, padding: "9px 12px", borderRadius: 7,
                    border: `1px solid ${C.border}`, fontSize: 13, background: "#fff",
                  }}
                />
                <button
                  id="bali-save-url-btn"
                  onClick={handleSaveUrl}
                  disabled={saving || !sheetUrl.trim()}
                  style={btnStyle(C.primary, saving || !sheetUrl.trim())}
                >
                  {saving ? "Đang lưu..." : "💾 Lưu URL"}
                </button>
              </div>
              {savedUrl && sheetUrl === savedUrl && (
                <div style={{ fontSize: 11, color: C.success, marginTop: 4 }}>
                  ✅ URL mặc định đã lưu
                </div>
              )}
            </div>

            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              color: C.muted, fontSize: 12, margin: "12px 0",
            }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              hoặc
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>

            <div>
              <label style={labelStyle()}>Upload file .xlsx / .csv (dự phòng)</label>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${file ? C.success : C.border}`,
                  borderRadius: 8, padding: "14px 16px",
                  background: file ? C.successLight : C.mutedBg,
                  cursor: "pointer", textAlign: "center", transition: "all 0.15s",
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 4 }}>{file ? "✅" : "📂"}</div>
                <div style={{ fontSize: 13, color: file ? C.success : C.muted }}>
                  {file ? file.name : "Click để chọn file .xlsx hoặc .csv"}
                </div>
              </div>
              <input
                ref={fileRef}
                id="bali-inventory-file-input"
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  if (f) setSheetUrl("");
                }}
                style={{ display: "none" }}
              />
              {file && (
                <button
                  onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                  style={{ marginTop: 6, fontSize: 12, color: C.danger, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  ✕ Bỏ file
                </button>
              )}
            </div>

            <div style={{
              marginTop: 12, padding: "10px 14px",
              background: C.primaryLight, borderRadius: 8, fontSize: 12, color: C.primary,
              border: `1px solid ${C.primaryBorder}`,
            }}>
              <strong>Format Sheet:</strong> Cột A = nhóm (BACAU, NT, ...) · Hàng 1 = size (200cmx300cm, ...) · Các ô = danh sách mã cách nhau bằng dấu phẩy (14(3), 45(2), ...)
            </div>
          </div>

          {/* Card 2: Text gọi hàng */}
          <div style={cardStyle()}>
            <div style={{
              fontWeight: 700, fontSize: 14, color: C.primary,
              marginBottom: 12, display: "flex", alignItems: "center", gap: 8,
            }}>
              📝 Text gọi hàng thảm Bali To
            </div>
            <textarea
              id="bali-order-text-input"
              value={orderText}
              onChange={(e) => setOrderText(e.target.value)}
              rows={10}
              placeholder={EXAMPLE_ORDER}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 7,
                border: `1px solid ${C.border}`, fontFamily: "monospace",
                fontSize: 13, lineHeight: 1.6, resize: "vertical",
                background: "#fff",
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                id="bali-compare-btn"
                onClick={handleCompare}
                disabled={loading}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 8, border: "none",
                  background: loading ? "#d1d5db" : C.primary,
                  color: "#fff", fontWeight: 700, fontSize: 15,
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.15s",
                }}
              >
                {loading ? <><Spinner />Đang đối soát...</> : "🔍 Đối soát"}
              </button>
              {(result || error) && (
                <button
                  onClick={() => { setResult(null); setError(""); setOrderText(""); }}
                  style={{
                    padding: "11px 18px", borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: "#fff", color: C.muted,
                    fontSize: 14, cursor: "pointer",
                  }}
                >Xóa</button>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: C.dangerLight, border: `1px solid ${C.dangerBorder}`,
              borderRadius: 8, padding: "12px 16px", color: C.danger,
              fontSize: 14, marginBottom: 16,
            }}>
              ❌ {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <>
              <SummaryCard result={result} />

              {/* Tabs */}
              <div style={{ marginBottom: -1 }}>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <TabBtn label="🚨 Cần gọi hàng"     count={result.needCall.length}         active={activeTab === "needCall"}     color={C.danger}   onClick={() => setActiveTab("needCall")} />
                  <TabBtn label="✅ Đã có đủ"          count={result.alreadyEnough.length}    active={activeTab === "alreadyEnough"} color={C.success}  onClick={() => setActiveTab("alreadyEnough")} />
                  <TabBtn label="⚠️ Có nhưng chưa đủ" count={result.partialAvailable.length} active={activeTab === "partial"}      color={C.warning}  onClick={() => setActiveTab("partial")} />
                  <TabBtn label="📐 Khác size"         count={result.differentSize.length}    active={activeTab === "diffSize"}     color={C.purple}   onClick={() => setActiveTab("diffSize")} />
                  <TabBtn label="🔄 Khác nhóm"         count={result.differentGroup.length}   active={activeTab === "diffGroup"}    color={C.primary}  onClick={() => setActiveTab("diffGroup")} />
                </div>
              </div>
              <div style={{
                background: "#fff", border: `1px solid ${C.border}`,
                borderRadius: "0 8px 8px 8px", padding: 20, marginBottom: 24,
              }}>
                {activeTab === "needCall"      && <NeedCallTab items={result.needCall}          onCopy={handleCopy} onExport={handleExport} />}
                {activeTab === "alreadyEnough" && <AlreadyEnoughTab items={result.alreadyEnough} />}
                {activeTab === "partial"       && <PartialTab items={result.partialAvailable} />}
                {activeTab === "diffSize"      && <DiffSizeTab items={result.differentSize} />}
                {activeTab === "diffGroup"     && <DiffGroupTab items={result.differentGroup} />}
              </div>

              {/* Quick copy bar */}
              {result.needCall.length > 0 && (
                <div style={{
                  background: C.dangerLight, border: `1px solid ${C.dangerBorder}`,
                  borderRadius: 8, padding: "12px 16px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginBottom: 24,
                }}>
                  <span style={{ fontSize: 13, color: C.danger, fontWeight: 600 }}>
                    🚨 {result.summary.needCallCount} mẫu cần gọi hàng
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handleCopy} style={btnStyle(C.success)}>📋 Copy</button>
                    <button onClick={handleExport} style={btnStyle(C.info)}>⬇️ Export</button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <div style={{ textAlign: "center", fontSize: 11, color: C.muted, marginTop: 8, paddingBottom: 24 }}>
            Dữ liệu Google Sheet đọc server-side · Không lưu lịch sử · Format: GROUP → size: mã(qty)
          </div>
        </div>
      </div>
    </>
  );
}

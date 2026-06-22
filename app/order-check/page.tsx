"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { CompareResult, NeedCallItem, AlreadyAvailableItem, DifferentSizeItem, NeedConfirmItem } from "@/lib/order-check/types";

// ── Styles ──────────────────────────────────────────────────
const COLOR = {
  primary: "#16a34a",
  primaryLight: "#dcfce7",
  primaryBorder: "#86efac",
  warning: "#d97706",
  warningLight: "#fef3c7",
  warningBorder: "#fcd34d",
  danger: "#dc2626",
  dangerLight: "#fef2f2",
  dangerBorder: "#fca5a5",
  info: "#2563eb",
  infoLight: "#eff6ff",
  infoBorder: "#93c5fd",
  purple: "#7c3aed",
  purpleLight: "#f5f3ff",
  purpleBorder: "#c4b5fd",
  muted: "#6b7280",
  mutedBg: "#f9fafb",
  border: "#e5e7eb",
  text: "#111827",
  textLight: "#374151",
};

// ── Types ────────────────────────────────────────────────────
type ActiveTab = "needCall" | "available" | "differentSize" | "needConfirm";

// ── Helper: group by size ────────────────────────────────────
function groupBySize<T extends { size: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    if (!map.has(item.size)) map.set(item.size, []);
    map.get(item.size)!.push(item);
  }
  return map;
}

// ── Helper: format kết quả thành text để copy/export ────────
function formatNeedCallText(needCall: NeedCallItem[]): string {
  const grouped = groupBySize(needCall);
  const lines: string[] = [];
  Array.from(grouped.entries()).forEach(([size, items]) => {
    lines.push(`${size}:`);
    items.forEach((item) => {
      const qty = item.quantity > 1 ? ` (${item.quantity})` : "";
      lines.push(`- ${item.rawName}${qty}`);
    });
    lines.push("");
  });
  return lines.join("\n").trim();
}

// ── Spinner ──────────────────────────────────────────────────
function Spinner() {
  return (
    <span style={{
      display: "inline-block",
      width: 18, height: 18,
      border: "2px solid rgba(255,255,255,0.3)",
      borderTopColor: "#fff",
      borderRadius: "50%",
      animation: "spin 0.7s linear infinite",
      verticalAlign: "middle",
      marginRight: 8,
    }} />
  );
}

// ── Summary Card ─────────────────────────────────────────────
function SummaryCard({ result }: { result: CompareResult }) {
  const { summary } = result;
  const cards = [
    { label: "Tổng mẫu đầu vào", value: summary.totalInputItems, color: COLOR.info, bg: COLOR.infoLight },
    { label: "Cần gọi hàng", value: summary.needCallCount, color: COLOR.danger, bg: COLOR.dangerLight },
    { label: "Đã có hàng", value: summary.availableCount, color: COLOR.primary, bg: COLOR.primaryLight },
    { label: "Khác size", value: summary.differentSizeCount, color: COLOR.warning, bg: COLOR.warningLight },
    { label: "Cần xác nhận", value: summary.needConfirmCount, color: COLOR.purple, bg: COLOR.purpleLight },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
      {cards.map((c) => (
        <div key={c.label} style={{
          background: c.bg, borderRadius: 10,
          padding: "14px 8px", textAlign: "center",
          border: `1px solid ${c.color}30`,
        }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: c.color }}>{c.value}</div>
          <div style={{ fontSize: 11, color: COLOR.muted, marginTop: 4, lineHeight: 1.3 }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── NeedCall Tab ─────────────────────────────────────────────
function NeedCallTab({ items, onCopy, onExport }: {
  items: NeedCallItem[];
  onCopy: () => void;
  onExport: () => void;
}) {
  const grouped = groupBySize(items);
  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: COLOR.muted }}>
        🎉 Không có mẫu nào cần gọi thêm!
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={onCopy} style={btnStyle(COLOR.primary)}>📋 Copy danh sách</button>
        <button onClick={onExport} style={btnStyle(COLOR.info)}>⬇️ Export .txt</button>
      </div>
      {Array.from(grouped.entries()).map(([size, sizeItems]: [string, NeedCallItem[]]) => (
        <div key={size} style={{ marginBottom: 16 }}>
          <div style={{
            fontWeight: 700, fontSize: 15,
            color: COLOR.danger,
            borderBottom: `2px solid ${COLOR.dangerBorder}`,
            paddingBottom: 4, marginBottom: 8,
          }}>
            📦 {size}
          </div>
          {sizeItems.map((item: NeedCallItem, i: number) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 10px", borderRadius: 6,
              background: i % 2 === 0 ? COLOR.dangerLight : "#fff",
              fontSize: 14, color: COLOR.text,
            }}>
              <span style={{ color: COLOR.danger }}>•</span>
              <span style={{ flex: 1 }}>{item.rawName}</span>

              {/* Số lượng cần gọi */}
              {item.quantity > 1 && (
                <span style={{
                  background: COLOR.danger, color: "#fff",
                  borderRadius: 12, padding: "1px 8px", fontSize: 12, fontWeight: 700,
                }}>
                  ×{item.quantity}
                </span>
              )}

              {/* Badge: thiếu số lượng */}
              {item.status === "need_call_partial" && item.availableQty !== undefined && (
                <span style={{
                  fontSize: 11, background: "#fff7ed",
                  color: "#c2410c", padding: "2px 7px",
                  borderRadius: 8, border: "1px solid #fed7aa",
                  whiteSpace: "nowrap",
                }}>
                  📦 kho có {item.availableQty}, gọi thêm {item.quantity}
                </span>
              )}

              {/* Badge: khác size */}
              {item.status === "need_call_different_size" && (
                <span style={{
                  fontSize: 10, background: COLOR.warningLight,
                  color: COLOR.warning, padding: "2px 6px",
                  borderRadius: 8, border: `1px solid ${COLOR.warningBorder}`,
                }}>
                  ⚠️ khác size
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Available Tab ────────────────────────────────────────────
function AvailableTab({ items }: { items: AlreadyAvailableItem[] }) {
  const grouped = groupBySize(items);
  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: COLOR.muted }}>
        Không có mẫu nào đã có sẵn.
      </div>
    );
  }
  const matchLabel: Record<string, string> = {
    exact: "khớp chính xác",
    alias: "khớp qua alias",
    fuzzy_high: "khớp tương đồng cao",
  };
  return (
    <div>
      {Array.from(grouped.entries()).map(([size, sizeItems]: [string, AlreadyAvailableItem[]]) => (
        <div key={size} style={{ marginBottom: 16 }}>
          <div style={{
            fontWeight: 700, fontSize: 15, color: COLOR.primary,
            borderBottom: `2px solid ${COLOR.primaryBorder}`,
            paddingBottom: 4, marginBottom: 8,
          }}>
            ✅ {size}
          </div>
          {sizeItems.map((item: AlreadyAvailableItem, i: number) => {
            const isPartial =
              item.availableQty !== undefined &&
              item.orderQty !== undefined &&
              item.orderQty > item.availableQty;
            return (
              <div key={i} style={{
                padding: "6px 10px", borderRadius: 6,
                background: i % 2 === 0 ? (isPartial ? "#fff7ed" : COLOR.primaryLight) : "#fff",
                fontSize: 14, color: COLOR.text,
                display: "flex", alignItems: "center", gap: 8,
                border: isPartial ? "1px solid #fed7aa" : "none",
                marginBottom: isPartial ? 2 : 0,
              }}>
                <span style={{ color: isPartial ? "#c2410c" : COLOR.primary }}>
                  {isPartial ? "⚠️" : "✓"}
                </span>
                <span style={{ flex: 1 }}>
                  <strong>{item.orderRawName}</strong>
                  <span style={{ color: COLOR.muted }}> → khớp với &quot;{item.matchedRawName}&quot;</span>
                  {isPartial && (
                    <span style={{
                      display: "block", fontSize: 12,
                      color: "#c2410c", marginTop: 2,
                    }}>
                      Kho có {item.availableQty}, cần {item.orderQty} → đang gọi thêm {item.orderQty! - item.availableQty!}
                    </span>
                  )}
                </span>
                <span style={{
                  fontSize: 10, padding: "2px 6px", borderRadius: 8,
                  background: isPartial ? "#ffedd5" : COLOR.primaryLight,
                  color: isPartial ? "#c2410c" : COLOR.primary,
                  border: `1px solid ${isPartial ? "#fed7aa" : COLOR.primaryBorder}`,
                  whiteSpace: "nowrap",
                }}>
                  {isPartial ? "⚠️ thiếu số lượng" : (matchLabel[item.matchType] ?? item.matchType)}
                  {item.confidence ? ` (${item.confidence}%)` : ""}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}


// ── DifferentSize Tab ────────────────────────────────────────
function DifferentSizeTab({ items }: { items: DifferentSizeItem[] }) {
  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: COLOR.muted }}>
        Không có mẫu nào bị lệch size.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item, i) => (
        <div key={i} style={{
          background: COLOR.warningLight,
          border: `1px solid ${COLOR.warningBorder}`,
          borderRadius: 8, padding: "10px 14px",
          fontSize: 14,
        }}>
          <div style={{ fontWeight: 700, color: COLOR.warning, marginBottom: 4 }}>
            ⚠️ {item.rawName} — size {item.size}
          </div>
          <div style={{ color: COLOR.textLight, lineHeight: 1.6 }}>
            Tìm thấy mẫu này ở size:{" "}
            {item.foundAtSizes.map((s) => (
              <span key={s} style={{
                background: "#fff", border: `1px solid ${COLOR.warningBorder}`,
                borderRadius: 4, padding: "1px 6px", marginRight: 4,
                fontWeight: 600, color: COLOR.warning,
              }}>
                {s}
              </span>
            ))}
            <br />
            <span style={{ color: COLOR.danger }}>Nhưng không có ở size {item.size} → vẫn cần gọi.</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── NeedConfirm Tab ──────────────────────────────────────────
function NeedConfirmTab({ items, onConfirm }: {
  items: NeedConfirmItem[];
  onConfirm: (item: NeedConfirmItem, confirmed: boolean) => void;
}) {
  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: COLOR.muted }}>
        Không có mục nào cần xác nhận mapping.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{
        background: COLOR.purpleLight, border: `1px solid ${COLOR.purpleBorder}`,
        borderRadius: 8, padding: "10px 14px", fontSize: 13,
        color: COLOR.purple, marginBottom: 8,
      }}>
        💡 Các mục dưới đây có độ tương đồng 75–89%. Xác nhận để lưu alias, giúp tự động nhận diện lần sau.
      </div>
      {items.map((item, i) => (
        <div key={i} style={{
          background: COLOR.purpleLight,
          border: `1px solid ${COLOR.purpleBorder}`,
          borderRadius: 8, padding: "12px 14px",
        }}>
          <div style={{ fontSize: 14, marginBottom: 10, lineHeight: 1.6 }}>
            <span style={{ fontWeight: 700 }}>&quot;{item.orderRawName}&quot;</span>
            <span style={{ color: COLOR.muted }}> (size {item.size}) có thể là </span>
            <span style={{ fontWeight: 700, color: COLOR.purple }}>&quot;{item.candidateRawName}&quot;</span>
            <span style={{ color: COLOR.muted }}> (size {item.candidateSize}) — độ giống{" "}</span>
            <span style={{
              fontWeight: 700, color: COLOR.purple,
              background: "#fff", padding: "1px 6px", borderRadius: 4,
            }}>
              {item.confidence}%
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => onConfirm(item, true)}
              style={{
                padding: "6px 14px", borderRadius: 6,
                border: `1px solid ${COLOR.primary}`,
                background: COLOR.primaryLight, color: COLOR.primary,
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              ✅ Đúng, cùng mẫu
            </button>
            <button
              onClick={() => onConfirm(item, false)}
              style={{
                padding: "6px 14px", borderRadius: 6,
                border: `1px solid ${COLOR.dangerBorder}`,
                background: COLOR.dangerLight, color: COLOR.danger,
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              ❌ Không phải
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Button style helper ──────────────────────────────────────
function btnStyle(color: string) {
  return {
    padding: "8px 16px", borderRadius: 7, border: "none",
    background: color, color: "#fff", fontWeight: 600,
    fontSize: 13, cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: 6,
  } as React.CSSProperties;
}

// ── Tab Button ───────────────────────────────────────────────
function TabBtn({ label, count, active, color, onClick }: {
  label: string; count: number; active: boolean; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 14px", borderRadius: "8px 8px 0 0",
        border: `1px solid ${active ? color : COLOR.border}`,
        borderBottom: active ? "1px solid #fff" : `1px solid ${COLOR.border}`,
        background: active ? "#fff" : COLOR.mutedBg,
        color: active ? color : COLOR.muted,
        fontWeight: active ? 700 : 400,
        fontSize: 13, cursor: "pointer",
        marginBottom: -1,
        display: "inline-flex", alignItems: "center", gap: 6,
        transition: "all 0.15s",
      }}
    >
      {label}
      <span style={{
        background: active ? color : "#ddd",
        color: active ? "#fff" : "#666",
        borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700,
      }}>
        {count}
      </span>
    </button>
  );
}

// ── Main Page ────────────────────────────────────────────────
export default function OrderCheckPage() {
  const [sheetUrl, setSheetUrl] = useState("");
  const [savedUrl, setSavedUrl] = useState("");
  const [orderText, setOrderText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("needCall");
  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [confirmedItems, setConfirmedItems] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  // Load saved URL
  useEffect(() => {
    fetch("/api/order-check/settings")
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
      const res = await fetch("/api/order-check/settings", {
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
      setError("Vui lòng nhập đoạn text gọi hàng.");
      return;
    }

    const hasUrl = sheetUrl.trim().length > 0;
    const hasFile = file !== null;

    if (!hasUrl && !hasFile) {
      setError("Vui lòng cung cấp Google Sheet URL hoặc upload file .xlsx/.csv.");
      return;
    }

    if (hasUrl && hasFile) {
      setError("Vui lòng chỉ chọn một nguồn dữ liệu: Google Sheet URL HOẶC file upload.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setConfirmedItems(new Set());

    try {
      const formData = new FormData();
      formData.append("orderText", orderText);
      if (hasUrl) formData.append("googleSheetUrl", sheetUrl);
      if (hasFile) formData.append("file", file!);

      const res = await fetch("/api/order-check/compare", {
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

  const handleCopyNeedCall = useCallback(() => {
    if (!result) return;
    const text = formatNeedCallText(result.needCall);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result]);

  const handleExport = useCallback(() => {
    if (!result) return;
    const text = formatNeedCallText(result.needCall);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `can-goi-hang-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const handleConfirmAlias = async (item: NeedConfirmItem, confirmed: boolean, idx: number) => {
    try {
      const res = await fetch("/api/order-check/confirm-alias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aliasRawName: item.orderRawName,
          targetRawName: item.candidateRawName,
          confirmed,
          confidence: item.confidence,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        showToast(d.message ?? "Đã lưu");
        setConfirmedItems((prev) => new Set(Array.from(prev).concat(idx)));
      } else {
        showToast("❌ " + (d.error ?? "Lỗi"));
      }
    } catch {
      showToast("❌ Không kết nối được server");
    }
  };

  const pendingConfirmItems = result
    ? result.needConfirm.filter((_, i) => !confirmedItems.has(i))
    : [];

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }
        * { box-sizing: border-box; }
        body { background: #f3f4f6; margin: 0; }
        textarea:focus, input:focus { outline: 2px solid ${COLOR.primary}; outline-offset: 1px; }
        button:hover { opacity: 0.88; }
        a { color: ${COLOR.primary}; }
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
        <div style={{ maxWidth: 800, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <a
              href="/"
              style={{
                fontSize: 13, color: COLOR.muted, textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 4,
                marginBottom: 12,
              }}
            >
              ← Về trang chủ
            </a>
            <h1 style={{
              fontSize: 22, fontWeight: 800, color: COLOR.text, margin: 0,
            }}>
              🔍 Đối soát Gọi Hàng Theo Mẫu Có Sẵn
            </h1>
            <p style={{ color: COLOR.muted, fontSize: 13, marginTop: 6 }}>
              So sánh text gọi hàng với tồn kho từ Google Sheet — loại bỏ mẫu đã có sẵn.
            </p>
          </div>

          {/* Card 1: Nguồn dữ liệu */}
          <div style={cardStyle()}>
            <div style={cardTitle(COLOR.primary)}>📊 Nguồn dữ liệu tồn kho</div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle()}>Google Sheet URL (public)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  id="sheet-url-input"
                  type="text"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  style={{
                    flex: 1, padding: "9px 12px", borderRadius: 7,
                    border: `1px solid ${COLOR.border}`, fontSize: 13,
                    background: "#fff",
                  }}
                />
                <button
                  id="save-url-btn"
                  onClick={handleSaveUrl}
                  disabled={saving || !sheetUrl.trim()}
                  style={{
                    padding: "9px 16px", borderRadius: 7, border: "none",
                    background: saving || !sheetUrl.trim() ? "#d1d5db" : COLOR.primary,
                    color: "#fff", fontWeight: 600, fontSize: 13,
                    cursor: saving || !sheetUrl.trim() ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {saving ? "Đang lưu..." : "💾 Lưu URL"}
                </button>
              </div>
              {savedUrl && sheetUrl === savedUrl && (
                <div style={{ fontSize: 11, color: COLOR.primary, marginTop: 4 }}>
                  ✅ URL mặc định đã lưu
                </div>
              )}
            </div>

            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              color: COLOR.muted, fontSize: 12, margin: "12px 0",
            }}>
              <div style={{ flex: 1, height: 1, background: COLOR.border }} />
              hoặc
              <div style={{ flex: 1, height: 1, background: COLOR.border }} />
            </div>

            <div>
              <label style={labelStyle()}>Upload file .xlsx / .csv (dự phòng)</label>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${file ? COLOR.primary : COLOR.border}`,
                  borderRadius: 8, padding: "14px 16px",
                  background: file ? COLOR.primaryLight : COLOR.mutedBg,
                  cursor: "pointer", textAlign: "center",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 4 }}>
                  {file ? "✅" : "📂"}
                </div>
                <div style={{ fontSize: 13, color: file ? COLOR.primary : COLOR.muted }}>
                  {file ? file.name : "Click để chọn file .xlsx hoặc .csv"}
                </div>
              </div>
              <input
                ref={fileRef}
                id="inventory-file-input"
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  if (f) setSheetUrl(""); // clear URL if file chosen
                }}
                style={{ display: "none" }}
              />
              {file && (
                <button
                  onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                  style={{
                    marginTop: 6, fontSize: 12, color: COLOR.danger,
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                  }}
                >
                  ✕ Bỏ file
                </button>
              )}
            </div>
          </div>

          {/* Card 2: Text gọi hàng */}
          <div style={cardStyle()}>
            <div style={cardTitle(COLOR.primary)}>📝 Text gọi hàng</div>
            <textarea
              id="order-text-input"
              value={orderText}
              onChange={(e) => setOrderText(e.target.value)}
              rows={8}
              placeholder={`Ví dụ:\n50cmx70cm: Tufted Da Báo (3), 10 Tim Nền Trắng\n50cmx120cm: LC_10 Tim Nền Trắng, LC_Mèo 3 Sọc\n120cmx120cm: LC_01`}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 7,
                border: `1px solid ${COLOR.border}`, fontFamily: "monospace",
                fontSize: 13, lineHeight: 1.6, resize: "vertical",
                background: "#fff",
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                id="compare-btn"
                onClick={handleCompare}
                disabled={loading}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 8, border: "none",
                  background: loading ? "#d1d5db" : COLOR.primary,
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
                    border: `1px solid ${COLOR.border}`,
                    background: "#fff", color: COLOR.muted,
                    fontSize: 14, cursor: "pointer",
                  }}
                >
                  Xóa
                </button>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: COLOR.dangerLight, border: `1px solid ${COLOR.dangerBorder}`,
              borderRadius: 8, padding: "12px 16px", color: COLOR.danger,
              fontSize: 14, marginBottom: 16,
            }}>
              ❌ {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <>
              {/* Summary */}
              <SummaryCard result={result} />

              {/* Tabs */}
              <div style={{ marginBottom: -1 }}>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <TabBtn
                    label="🚨 Cần gọi hàng"
                    count={result.needCall.length}
                    active={activeTab === "needCall"}
                    color={COLOR.danger}
                    onClick={() => setActiveTab("needCall")}
                  />
                  <TabBtn
                    label="✅ Đã có hàng"
                    count={result.alreadyAvailable.length}
                    active={activeTab === "available"}
                    color={COLOR.primary}
                    onClick={() => setActiveTab("available")}
                  />
                  <TabBtn
                    label="⚠️ Khác size"
                    count={result.differentSize.length}
                    active={activeTab === "differentSize"}
                    color={COLOR.warning}
                    onClick={() => setActiveTab("differentSize")}
                  />
                  <TabBtn
                    label="❓ Cần xác nhận"
                    count={pendingConfirmItems.length}
                    active={activeTab === "needConfirm"}
                    color={COLOR.purple}
                    onClick={() => setActiveTab("needConfirm")}
                  />
                </div>
              </div>
              <div style={{
                background: "#fff",
                border: `1px solid ${COLOR.border}`,
                borderRadius: "0 8px 8px 8px", padding: 20,
                marginBottom: 24,
              }}>
                {activeTab === "needCall" && (
                  <NeedCallTab
                    items={result.needCall}
                    onCopy={handleCopyNeedCall}
                    onExport={handleExport}
                  />
                )}
                {activeTab === "available" && (
                  <AvailableTab items={result.alreadyAvailable} />
                )}
                {activeTab === "differentSize" && (
                  <DifferentSizeTab items={result.differentSize} />
                )}
                {activeTab === "needConfirm" && (
                  <NeedConfirmTab
                    items={pendingConfirmItems}
                    onConfirm={(item, confirmed) => {
                      const idx = result.needConfirm.indexOf(item);
                      handleConfirmAlias(item, confirmed, idx);
                    }}
                  />
                )}
              </div>

              {/* Quick copy bar */}
              {result.needCall.length > 0 && (
                <div style={{
                  background: COLOR.dangerLight,
                  border: `1px solid ${COLOR.dangerBorder}`,
                  borderRadius: 8, padding: "10px 16px",
                  display: "flex", alignItems: "center", gap: 12,
                  marginBottom: 24,
                }}>
                  <span style={{ fontSize: 14, color: COLOR.danger, fontWeight: 600, flex: 1 }}>
                    🚨 {result.needCall.length} mẫu cần gọi hàng
                  </span>
                  <button
                    id="copy-need-call-btn"
                    onClick={handleCopyNeedCall}
                    style={{
                      padding: "7px 14px", borderRadius: 6, border: "none",
                      background: COLOR.danger, color: "#fff",
                      fontWeight: 600, fontSize: 13, cursor: "pointer",
                    }}
                  >
                    {copied ? "✅ Đã copy!" : "📋 Copy danh sách"}
                  </button>
                  <button
                    id="export-txt-btn"
                    onClick={handleExport}
                    style={{
                      padding: "7px 14px", borderRadius: 6,
                      border: `1px solid ${COLOR.dangerBorder}`,
                      background: "#fff", color: COLOR.danger,
                      fontWeight: 600, fontSize: 13, cursor: "pointer",
                    }}
                  >
                    ⬇️ Export .txt
                  </button>
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <div style={{ textAlign: "center", color: COLOR.muted, fontSize: 12, marginTop: 8 }}>
            Dữ liệu Google Sheet được đọc server-side · Alias mapping được lưu local
          </div>
        </div>
      </div>
    </>
  );
}

// ── Style helpers ────────────────────────────────────────────
function cardStyle(): React.CSSProperties {
  return {
    background: "#fff",
    borderRadius: 10,
    border: `1px solid ${COLOR.border}`,
    padding: 20,
    marginBottom: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  };
}

function cardTitle(color: string): React.CSSProperties {
  return {
    fontWeight: 700, fontSize: 15, color,
    marginBottom: 14,
    paddingBottom: 10,
    borderBottom: `1px solid ${COLOR.border}`,
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: "block",
    fontSize: 12, fontWeight: 600,
    color: COLOR.muted,
    marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em",
  };
}

"use client";

import { useState, useCallback } from "react";

// ── Types (inline để không cần import server-only) ────────────
type SizeEntry = {
  size: string;
  displaySize: string;
  quantity: number;
};

type ParsedItem = {
  group: string;
  pattern: string;
  caption: string;
  sizes: SizeEntry[];
  sizeSummary: string;
};

type ResultItem = {
  group: string;
  pattern: string;
  caption: string;
  sizeSummary: string;
  outputUrl: string | null;
  fileName: string;
  status: "generated" | "missing_source" | "error";
  errorMessage?: string;
};

type MissingItem = { group: string; pattern: string; caption: string };

// ── Color tokens ──────────────────────────────────────────────
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
  muted:         "#6b7280",
  mutedBg:       "#f9fafb",
  border:        "#e5e7eb",
  text:          "#111827",
};

// ── Client-side parse helpers ─────────────────────────────────
// (dùng lại logic parse để hiển thị preview TRƯỚC khi gọi API)

const SIZE_ORDER = ["80x150","100x150","80x200","120x160","140x200","160x230","200x300"];
const SIZE_DISPLAY: Record<string, string> = {
  "80x150":"80cmx150cm","100x150":"100cmx150cm",
  "80x200":"80","120x160":"M2","140x200":"M4","160x230":"M6","200x300":"2M",
};
const GROUP_LABEL: Record<string, string> = {
  BACAU:"Bắc Âu",NT:"NT",NTNEW:"NTNEW",RETRO:"Retro",
  BALI:"Bali",CARO:"Caro",HD:"HD",THD:"THD",ARAP:"Arap",
  VINTAGE:"Vintage",TET:"Tết",TRUUTUONG:"Trừu Tượng",
};

function normSize(s: string): string {
  const m = s.trim().toLowerCase().match(/^(\d+(?:\.\d+)?(?:m\d*)?)(?:cm)?[x×*](\d+(?:\.\d+)?(?:m\d*)?)(?:cm)?$/i);
  if (!m) return s;
  const parsePart = (p: string) => {
    const md = p.match(/^(\d+)m(\d+)$/i);
    if (md) return parseInt(md[1])*100 + parseInt(md[2])*10;
    const mm = p.match(/^(\d+)m$/i);
    if (mm) return parseInt(mm[1])*100;
    return parseInt(p);
  };
  return `${parsePart(m[1])}x${parsePart(m[2])}`;
}

function normGroup(g: string): string {
  return g.trim().toUpperCase().replace(/\s+/g, " ");
}

function extractQty(s: string): number {
  const m = s.trim().match(/\((\d+)\)\s*$/);
  return m ? parseInt(m[1]) : 1;
}

function cleanPat(s: string): string {
  return s.trim().replace(/\s*\(\d+\)\s*$/, "").trim();
}

function normPat(s: string): string {
  let p = s.replace(/\s*\(\d+\)\s*$/, "").trim().toLowerCase();
  p = p.replace(/[_\-]/g, " ").replace(/\s+/g, " ").trim();
  if (/^\d+$/.test(p)) p = String(parseInt(p));
  return p;
}

function sizeIdx(s: string): number {
  const i = SIZE_ORDER.indexOf(s); return i === -1 ? 999 : i;
}

function fmtSizeQty(size: string, qty: number): string {
  const label = SIZE_DISPLAY[size] ?? size;
  return qty > 1 ? `${label}(${qty})` : label;
}

function buildSummary(sizes: Array<{size: string; quantity: number}>): string {
  return [...sizes]
    .sort((a,b) => sizeIdx(a.size) - sizeIdx(b.size))
    .map(s => fmtSizeQty(s.size, s.quantity))
    .join(" + ");
}

function formatName(group: string, pattern: string): string {
  return `${GROUP_LABEL[group] ?? group} ${pattern}`;
}

function splitPats(cell: string): string[] {
  const res: string[] = []; let cur = ""; let depth = 0;
  for (const ch of cell) {
    if (ch === "(") { depth++; cur += ch; }
    else if (ch === ")") { depth = Math.max(0, depth-1); cur += ch; }
    else if (ch === "," && depth === 0) { if (cur.trim()) res.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) res.push(cur.trim());
  return res;
}

function clientParse(text: string): ParsedItem[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rawItems: Array<{group:string;pattern:string;nPat:string;size:string;qty:number}> = [];
  let curGroup = "";

  for (const line of lines) {
    const ci = line.indexOf(":");
    if (ci === -1) { curGroup = normGroup(line); }
    else {
      if (!curGroup) continue;
      const size = normSize(line.slice(0, ci).trim());
      for (const raw of splitPats(line.slice(ci+1))) {
        const clean = cleanPat(raw);
        rawItems.push({ group: curGroup, pattern: clean, nPat: normPat(clean), size, qty: extractQty(raw) });
      }
    }
  }

  // Aggregate by group + nPat
  const map = new Map<string, {group:string;pattern:string;nPat:string;sizeMap:Map<string,number>}>();
  for (const it of rawItems) {
    const key = `${it.group}|||${it.nPat}`;
    let e = map.get(key);
    if (!e) { e = {group:it.group,pattern:it.pattern,nPat:it.nPat,sizeMap:new Map()}; map.set(key, e); }
    e.sizeMap.set(it.size, (e.sizeMap.get(it.size)??0) + it.qty);
  }

  return Array.from(map.values()).map(e => {
    const sizes: SizeEntry[] = Array.from(e.sizeMap.entries())
      .sort(([a],[b]) => sizeIdx(a)-sizeIdx(b))
      .map(([size, quantity]) => ({ size, displaySize: SIZE_DISPLAY[size]??size, quantity }));
    return {
      group: e.group,
      pattern: e.pattern,
      caption: formatName(e.group, e.pattern),
      sizes,
      sizeSummary: buildSummary(sizes.map(s => ({size:s.size,quantity:s.quantity}))),
    };
  });
}

// ── Helpers ───────────────────────────────────────────────────
function cardStyle(): React.CSSProperties {
  return {
    background: "#fff", borderRadius: 12, padding: 20,
    border: `1px solid ${C.border}`, marginBottom: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  };
}

function btnStyle(color: string, disabled?: boolean): React.CSSProperties {
  return {
    padding: "9px 18px", borderRadius: 7, border: "none",
    background: disabled ? "#d1d5db" : color,
    color: "#fff", fontWeight: 600, fontSize: 13,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex", alignItems: "center", gap: 6,
  };
}

function Spinner() {
  return (
    <span style={{
      display: "inline-block", width: 16, height: 16,
      border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff",
      borderRadius: "50%", animation: "spin 0.7s linear infinite",
      verticalAlign: "middle", marginRight: 6,
    }} />
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function BaliImageGeneratorPage() {
  const [orderText, setOrderText] = useState("");
  const [parsed, setParsed] = useState<ParsedItem[] | null>(null);
  const [results, setResults] = useState<ResultItem[] | null>(null);
  const [missingImages, setMissingImages] = useState<MissingItem[]>([]);
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"gallery" | "missing">("gallery");
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const handleParse = useCallback(() => {
    if (!orderText.trim()) { setError("Vui lòng nhập text gọi hàng."); return; }
    try {
      const items = clientParse(orderText);
      if (items.length === 0) { setError("Không parse được text. Kiểm tra format: GROUP\\nsize: mã"); return; }
      setParsed(items);
      setResults(null);
      setError("");
      setZipUrl(null);
    } catch {
      setError("Lỗi parse text.");
    }
  }, [orderText]);

  const handleGenerate = useCallback(async () => {
    if (!orderText.trim()) { setError("Vui lòng nhập text gọi hàng."); return; }
    setLoading(true);
    setError("");
    setResults(null);
    setMissingImages([]);
    setZipUrl(null);

    try {
      const res = await fetch("/api/bali-to-images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderText, options: { showCaption: true } }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Lỗi không xác định");
      } else {
        setResults(data.items);
        setMissingImages(data.missingImages ?? []);
        setZipUrl(data.zipUrl ?? null);
        setActiveTab("gallery");
        showToast(`✅ Đã tạo ${data.totalGenerated} ảnh!${data.totalMissing > 0 ? ` Thiếu ${data.totalMissing} ảnh gốc.` : ""}`);
      }
    } catch {
      setError("Không kết nối được server.");
    } finally {
      setLoading(false);
    }
  }, [orderText]);

  const EXAMPLE = `BACAU
80cmx200cm: 06, 08(2)
120cmx160cm: 08, 17
140cmx200cm: 08

NT
140cmx200cm: 02, 11`;

  const generatedItems = (results ?? []).filter(r => r.status === "generated");
  const errorItems = (results ?? []).filter(r => r.status === "error");

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; } }
        * { box-sizing: border-box; }
        body { background: #f3f4f6; margin: 0; }
        textarea:focus, input:focus { outline: 2px solid ${C.primary}; outline-offset: 1px; }
        button:hover:not(:disabled) { opacity: 0.85; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 16, right: 16, zIndex: 9999,
          background: "#1f2937", color: "#fff",
          padding: "10px 18px", borderRadius: 8, fontSize: 14,
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          animation: "fadeIn 0.2s ease",
        }}>{toast}</div>
      )}

      <div style={{ minHeight: "100vh", padding: "24px 16px", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <a href="/" style={{ fontSize: 13, color: C.muted, textDecoration: "none", marginBottom: 12, display: "inline-block" }}>
              ← Về trang chủ
            </a>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>
                  🖼️ Sinh Ảnh Gọi Hàng Thảm Bali To
                </h1>
                <p style={{ color: C.muted, fontSize: 13, marginTop: 6, marginBottom: 0 }}>
                  1 mẫu = 1 ảnh · Gom theo group+pattern · Overlay size tự động · Export ZIP
                </p>
              </div>
              <a href="/bali-check" style={{
                marginLeft: "auto", padding: "7px 14px", borderRadius: 7,
                background: C.primaryLight, border: `1px solid ${C.primaryBorder}`,
                color: C.primary, fontSize: 12, textDecoration: "none", fontWeight: 600,
                whiteSpace: "nowrap",
              }}>← Quay lại Đối soát</a>
            </div>
          </div>

          {/* Input card */}
          <div style={cardStyle()}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.primary, marginBottom: 12 }}>
              📝 Text gọi hàng sau đối soát
            </div>
            <textarea
              id="bali-image-order-input"
              value={orderText}
              onChange={e => { setOrderText(e.target.value); setParsed(null); setResults(null); setError(""); }}
              rows={9}
              placeholder={EXAMPLE}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 7,
                border: `1px solid ${C.border}`, fontFamily: "monospace",
                fontSize: 13, lineHeight: 1.6, resize: "vertical", background: "#fff",
              }}
            />

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button
                id="bali-image-parse-btn"
                onClick={handleParse}
                disabled={!orderText.trim()}
                style={btnStyle("#6b7280", !orderText.trim())}
              >
                🔍 Parse & Preview
              </button>
              <button
                id="bali-image-generate-btn"
                onClick={handleGenerate}
                disabled={loading || !orderText.trim()}
                style={{
                  ...btnStyle(C.primary, loading || !orderText.trim()),
                  flex: 1, justifyContent: "center", fontSize: 15, padding: "10px 0",
                }}
              >
                {loading ? <><Spinner />Đang tạo ảnh...</> : "🎨 Tạo ảnh"}
              </button>
              {(results || parsed || error) && (
                <button
                  onClick={() => { setParsed(null); setResults(null); setError(""); setOrderText(""); setZipUrl(null); }}
                  style={{ padding: "10px 14px", borderRadius: 7, border: `1px solid ${C.border}`, background: "#fff", color: C.muted, fontSize: 13, cursor: "pointer" }}
                >Xóa</button>
              )}
            </div>

            {/* Format hint */}
            <div style={{
              marginTop: 10, padding: "8px 12px", background: C.primaryLight,
              borderRadius: 7, fontSize: 12, color: C.primary, border: `1px solid ${C.primaryBorder}`,
            }}>
              <strong>Format:</strong> GROUP (BACAU, NT, ...) → <code>size: mã, mã(qty)</code> &nbsp;|&nbsp; Ảnh mẫu: <code>public/assets/bali-to/GROUP/pattern.jpg</code>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: C.dangerLight, border: `1px solid ${C.dangerBorder}`,
              borderRadius: 8, padding: "12px 16px", color: C.danger, fontSize: 14, marginBottom: 16,
            }}>❌ {error}</div>
          )}

          {/* Preview before generate */}
          {parsed && !results && (
            <div style={cardStyle()}>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 12 }}>
                👁️ Preview — {parsed.length} mẫu sẽ sinh ảnh
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {parsed.map((item, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 12px", borderRadius: 7,
                    background: i % 2 === 0 ? C.primaryLight : "#fff",
                    border: `1px solid ${C.primaryBorder}`,
                    fontSize: 13,
                  }}>
                    <span style={{
                      background: C.primary, color: "#fff",
                      borderRadius: 5, padding: "2px 8px", fontWeight: 700, fontSize: 12,
                      whiteSpace: "nowrap",
                    }}>{item.group}</span>
                    <span style={{ fontWeight: 700, color: C.text, minWidth: 30 }}>{item.pattern}</span>
                    <span style={{ color: C.muted, fontSize: 11 }}>→</span>
                    <span style={{ flex: 1, color: C.text, fontWeight: 500 }}>{item.sizeSummary}</span>
                    <span style={{ color: C.muted, fontSize: 11, whiteSpace: "nowrap" }}>{item.caption}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleGenerate}
                disabled={loading}
                style={{ ...btnStyle(C.primary, loading), marginTop: 14, width: "100%", justifyContent: "center", padding: "11px 0", fontSize: 15 }}
              >
                {loading ? <><Spinner />Đang tạo ảnh...</> : `🎨 Tạo ${parsed.length} ảnh`}
              </button>
            </div>
          )}

          {/* Results */}
          {results && (
            <>
              {/* Summary bar */}
              <div style={{
                display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap",
              }}>
                {[
                  { label: "Tổng mẫu", value: results.length, color: "#2563eb", bg: "#eff6ff" },
                  { label: "Đã tạo ảnh", value: generatedItems.length, color: C.success, bg: C.successLight },
                  { label: "Thiếu ảnh gốc", value: missingImages.length, color: C.warning, bg: C.warningLight },
                  { label: "Lỗi render", value: errorItems.length, color: C.danger, bg: C.dangerLight },
                ].map(c => (
                  <div key={c.label} style={{
                    flex: 1, minWidth: 100, background: c.bg, borderRadius: 10,
                    padding: "12px 8px", textAlign: "center",
                    border: `1px solid ${c.color}30`,
                  }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: c.color }}>{c.value}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{c.label}</div>
                  </div>
                ))}

                {zipUrl && (
                  <a
                    href={zipUrl}
                    download
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      gap: 6, padding: "12px 20px", borderRadius: 10,
                      background: C.success, color: "#fff", fontWeight: 700, fontSize: 13,
                      textDecoration: "none", border: "none",
                    }}
                  >
                    📦 Download ZIP ({generatedItems.length} ảnh)
                  </a>
                )}
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 4, marginBottom: -1 }}>
                {[
                  { key: "gallery", label: `🖼️ Gallery`, count: generatedItems.length, color: C.primary },
                  { key: "missing", label: `⚠️ Thiếu ảnh`, count: missingImages.length + errorItems.length, color: C.warning },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as "gallery" | "missing")}
                    style={{
                      padding: "8px 14px", borderRadius: "8px 8px 0 0",
                      border: `1px solid ${activeTab === tab.key ? tab.color : C.border}`,
                      borderBottom: activeTab === tab.key ? "1px solid #fff" : `1px solid ${C.border}`,
                      background: activeTab === tab.key ? "#fff" : C.mutedBg,
                      color: activeTab === tab.key ? tab.color : C.muted,
                      fontWeight: activeTab === tab.key ? 700 : 400,
                      fontSize: 13, cursor: "pointer", marginBottom: -1,
                    }}
                  >
                    {tab.label}
                    <span style={{
                      marginLeft: 5, background: activeTab === tab.key ? tab.color : "#ddd",
                      color: activeTab === tab.key ? "#fff" : "#666",
                      borderRadius: 10, padding: "1px 6px", fontSize: 11, fontWeight: 700,
                    }}>{tab.count}</span>
                  </button>
                ))}
              </div>

              <div style={{
                background: "#fff", border: `1px solid ${C.border}`,
                borderRadius: "0 8px 8px 8px", padding: 20, marginBottom: 24,
              }}>
                {/* Gallery Tab */}
                {activeTab === "gallery" && (
                  generatedItems.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>
                      Chưa có ảnh nào được tạo.<br />
                      <span style={{ fontSize: 12 }}>Hãy đặt ảnh mẫu vào <code>public/assets/bali-to/GROUP/pattern.jpg</code></span>
                    </div>
                  ) : (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                      gap: 16,
                    }}>
                      {generatedItems.map((item, i) => (
                        <div key={i} style={{
                          borderRadius: 10, overflow: "hidden",
                          border: `1px solid ${C.border}`,
                          background: "#fff",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                        }}>
                          {/* Image */}
                          <div style={{ position: "relative", paddingTop: "75%", background: "#f3f4f6" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.outputUrl + "?t=" + Date.now()}
                              alt={item.caption}
                              style={{
                                position: "absolute", top: 0, left: 0,
                                width: "100%", height: "100%", objectFit: "cover",
                              }}
                              onError={e => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          </div>

                          {/* Info */}
                          <div style={{ padding: "10px 12px" }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 2 }}>
                              {item.caption}
                            </div>
                            <div style={{ fontSize: 12, color: C.primary, fontWeight: 600, marginBottom: 8 }}>
                              {item.sizeSummary}
                            </div>
                            <a
                              href={item.outputUrl!}
                              download={item.fileName}
                              style={{
                                display: "block", textAlign: "center",
                                padding: "6px 0", borderRadius: 6,
                                background: C.primaryLight, color: C.primary,
                                fontSize: 12, fontWeight: 600, textDecoration: "none",
                                border: `1px solid ${C.primaryBorder}`,
                              }}
                            >
                              ⬇️ {item.fileName}
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* Missing Tab */}
                {activeTab === "missing" && (
                  <div>
                    {missingImages.length === 0 && errorItems.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>
                        🎉 Tất cả ảnh mẫu đều có sẵn!
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {missingImages.length > 0 && (
                          <>
                            <div style={{ fontWeight: 600, color: C.warning, marginBottom: 4, fontSize: 13 }}>
                              ⚠️ Thiếu ảnh mẫu gốc — cần đặt vào thư mục:
                            </div>
                            {missingImages.map((m, i) => (
                              <div key={i} style={{
                                background: C.warningLight, border: `1px solid ${C.warningBorder}`,
                                borderRadius: 7, padding: "8px 14px",
                                display: "flex", alignItems: "center", gap: 8, fontSize: 13,
                              }}>
                                <span style={{
                                  background: C.warning, color: "#fff",
                                  borderRadius: 4, padding: "1px 8px", fontWeight: 700, fontSize: 11,
                                }}>{m.group}</span>
                                <span style={{ fontWeight: 600 }}>{m.pattern}</span>
                                <span style={{ color: C.muted, fontSize: 11 }}>{m.caption}</span>
                                <code style={{ marginLeft: "auto", fontSize: 11, color: "#555" }}>
                                  public/assets/bali-to/{m.group}/{m.pattern}.jpg
                                </code>
                              </div>
                            ))}
                          </>
                        )}
                        {errorItems.length > 0 && (
                          <>
                            <div style={{ fontWeight: 600, color: C.danger, marginTop: 8, marginBottom: 4, fontSize: 13 }}>
                              ❌ Lỗi render:
                            </div>
                            {errorItems.map((e, i) => (
                              <div key={i} style={{
                                background: C.dangerLight, border: `1px solid ${C.dangerBorder}`,
                                borderRadius: 7, padding: "8px 14px", fontSize: 13,
                              }}>
                                <strong>{e.caption}</strong>: {e.errorMessage}
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom download bar */}
              {zipUrl && generatedItems.length > 0 && (
                <div style={{
                  background: C.successLight, border: `1px solid ${C.successBorder}`,
                  borderRadius: 8, padding: "12px 16px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginBottom: 24,
                }}>
                  <span style={{ fontSize: 13, color: C.success, fontWeight: 600 }}>
                    ✅ {generatedItems.length} ảnh đã sẵn sàng
                  </span>
                  <a href={zipUrl} download style={{ ...btnStyle(C.success), textDecoration: "none" }}>
                    📦 Download tất cả (ZIP)
                  </a>
                </div>
              )}
            </>
          )}

          {/* Setup guide */}
          {!results && !parsed && (
            <div style={{
              ...cardStyle(),
              border: `1px dashed ${C.primaryBorder}`,
              background: C.primaryLight,
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.primary, marginBottom: 10 }}>
                📁 Cấu hình thư mục ảnh mẫu
              </div>
              <pre style={{ fontSize: 12, color: "#374151", lineHeight: 1.8, margin: 0, whiteSpace: "pre-wrap" }}>{`public/
  assets/
    bali-to/
      BACAU/
        06.jpg   ← hoặc .png / .webp
        08.jpg
        17.jpg
      NT/
        02.jpg
        11.jpg
      NTNEW/
        01.jpg`}</pre>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>
                Hỗ trợ: <code>08.jpg</code> và <code>8.jpg</code> (fallback bỏ leading zero) · Định dạng: jpg, jpeg, png, webp
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: "center", fontSize: 11, color: C.muted, paddingBottom: 24 }}>
            Ảnh được render server-side bằng sharp · Overlay SVG tự scale font · 1 mẫu = 1 ảnh
          </div>
        </div>
      </div>
    </>
  );
}

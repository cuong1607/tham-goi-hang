"use client";

import { useState, useRef } from "react";

type Mode = "bali" | "cuu";

const MODES: { key: Mode; label: string; color: string; bg: string; border: string }[] = [
  {
    key: "bali",
    label: "Thảm Bali To",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fcd34d",
  },
  {
    key: "cuu",
    label: "Thảm Cừu To",
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#93c5fd",
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Mode>("bali");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeMode = MODES.find((m) => m.key === activeTab)!;

  const handleTabChange = (tab: Mode) => {
    setActiveTab(tab);
    setFiles([]);
    setResult("");
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    setFiles(selected);
    setResult("");
    setError("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.endsWith(".xlsx")
    );
    setFiles(dropped);
    setResult("");
    setError("");
  };

  const handleProcess = async () => {
    if (files.length === 0) {
      setError("Vui lòng chọn ít nhất 1 file .xlsx");
      return;
    }
    setLoading(true);
    setError("");
    setResult("");

    const formData = new FormData();
    formData.append("mode", activeTab);
    for (const f of files) formData.append("files", f);

    try {
      const res = await fetch("/api/process", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Lỗi không xác định");
      } else {
        setResult(data.result ?? "(Không có dữ liệu phù hợp)");
      }
    } catch {
      setError("Không kết nối được với server");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleClear = () => {
    setFiles([]);
    setResult("");
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div style={{ minHeight: "100vh", padding: "24px 16px", background: "#f5f5f5" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#111", margin: 0 }}>
            Gọi Hàng Thảm
          </h1>
          <p style={{ color: "#666", marginTop: 6, fontSize: 14 }}>
            Upload phiếu đóng gói .xlsx → Xuất text gọi hàng
          </p>
        </div>

        {/* Tab */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => handleTabChange(m.key)}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 8,
                border: `2px solid ${activeTab === m.key ? m.color : "#ddd"}`,
                background: activeTab === m.key ? m.color : "#fff",
                color: activeTab === m.key ? "#fff" : "#555",
                fontWeight: activeTab === m.key ? 700 : 400,
                fontSize: 15,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Main card */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            border: `1px solid ${activeMode.border}`,
            padding: 24,
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${activeMode.border}`,
              borderRadius: 10,
              background: activeMode.bg,
              padding: "28px 16px",
              textAlign: "center",
              cursor: "pointer",
              marginBottom: 16,
              transition: "background 0.15s",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
            <div style={{ fontWeight: 600, color: activeMode.color, marginBottom: 4 }}>
              Kéo thả hoặc click để chọn file
            </div>
            <div style={{ fontSize: 13, color: "#888" }}>
              Hỗ trợ nhiều file .xlsx cùng lúc
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              multiple
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: "#555", marginBottom: 6 }}>
                {files.length} file đã chọn:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {files.map((f, i) => (
                  <span
                    key={i}
                    style={{
                      background: activeMode.bg,
                      border: `1px solid ${activeMode.border}`,
                      borderRadius: 6,
                      padding: "3px 10px",
                      fontSize: 13,
                      color: activeMode.color,
                    }}
                  >
                    {f.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button
              onClick={handleProcess}
              disabled={loading || files.length === 0}
              style={{
                flex: 1,
                padding: "11px 0",
                borderRadius: 8,
                border: "none",
                background: files.length === 0 || loading ? "#ccc" : activeMode.color,
                color: "#fff",
                fontWeight: 700,
                fontSize: 15,
                cursor: files.length === 0 || loading ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
            >
              {loading ? "⏳ Đang xử lý..." : "⚡ Xuất gọi hàng"}
            </button>
            {(files.length > 0 || result) && (
              <button
                onClick={handleClear}
                style={{
                  padding: "11px 18px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "#f9f9f9",
                  color: "#666",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Xóa
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                borderRadius: 8,
                padding: "12px 16px",
                color: "#dc2626",
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              ❌ {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontWeight: 600, color: "#333", fontSize: 15 }}>
                  Kết quả gọi hàng:
                </span>
                <button
                  onClick={handleCopy}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: `1px solid ${activeMode.border}`,
                    background: activeMode.bg,
                    color: activeMode.color,
                    fontSize: 13,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {copied ? "✅ Đã copy!" : "📋 Copy"}
                </button>
              </div>
              <textarea
                readOnly
                value={result}
                rows={Math.min(30, result.split("\n").length + 2)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  fontFamily: "monospace",
                  fontSize: 14,
                  lineHeight: 1.6,
                  padding: "14px",
                  borderRadius: 8,
                  border: `1px solid ${activeMode.border}`,
                  background: activeMode.bg,
                  color: "#111",
                  resize: "vertical",
                  outline: "none",
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 20, color: "#aaa", fontSize: 12 }}>
          Chỉ xử lý file .xlsx · Dữ liệu không được lưu trữ
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gọi Hàng Thảm",
  description: "Đọc phiếu đóng gói và xuất text gọi hàng thảm Bali To / Cừu To",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f5f5f5" }}>
        {children}
      </body>
    </html>
  );
}

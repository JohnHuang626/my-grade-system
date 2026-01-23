import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// 這邊的 metadata 就是控制瀏覽器標題的地方
export const metadata = {
  title: "年級成績管理系統",
  description: "國中校務成績管理系統 - 提供即時排名與分析",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
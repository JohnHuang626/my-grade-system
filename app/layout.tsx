import { Inter } from "next/font/google";
// import "./globals.css";  <-- 移除這行，因為您的專案可能沒有這個檔案，這會導致 Vercel 報錯

const inter = Inter({ subsets: ["latin"] });

// 這邊的 metadata 就是控制瀏覽器標題的地方
export const metadata = {
  title: "校務成績管理系統",
  description: "國中校務成績管理系統 - 提供即時排名與分析",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <head>
        {/* 加入這一行：使用 CDN 方式直接載入 Tailwind CSS */}
        {/* 這樣就不需要 globals.css 也能讓版面變漂亮，且不會報錯 */}
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
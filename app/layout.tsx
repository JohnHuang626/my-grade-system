// 移除了 next/font/google 引用，避免 Vercel 建置時因為下載字型失敗而報錯
// import "./globals.css"; 

export const metadata = {
  title: "校務成績管理系統",
  description: "國中校務成績管理系統 - 提供即時排名與分析",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <head>
        {/* 使用 CDN 方式直接載入 Tailwind CSS，確保樣式正常且不需額外設定 */}
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      {/* 移除 inter.className，改用系統預設字體 */}
      <body>{children}</body>
    </html>
  );
}
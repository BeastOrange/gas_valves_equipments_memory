import './globals.css';
export const metadata = { title: '位号记忆练习', description: '纯前端，导入CSV即可用' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}


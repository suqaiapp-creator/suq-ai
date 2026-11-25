export const metadata = {
  title: "سوق AI",
  description: "من منتجك إلى إعلانك بالذكاء الاصطناعي",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}

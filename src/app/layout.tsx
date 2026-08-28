export const metadata = {
  title: "Gym Backend API",
  description: "API backend for the Gym Management app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

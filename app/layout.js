import "./globals.css";

export const metadata = {
  title: "Fundraising School | Raise capital with the builders behind Rappi",
  description:
    "A six-week, founder-led sprint to sharpen your story, meet tier-1 investors, and build momentum while you close your round.",
  icons: { icon: "/assets/logo-negro.svg" }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

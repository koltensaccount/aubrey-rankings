"use client";

import Link from "next/link";
import styles from "./refinement-styles";
import { TypographyLab } from "./typography-lab";
import "./refinement.css";
import { usePathname } from "next/navigation";

export default function PrototypeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TypographyLab>
      <PrototypeScreensLayout>{children}</PrototypeScreensLayout>
    </TypographyLab>
  );
}

function PrototypeScreensLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const screens = [
    {
      name: "Screen A — Social Home",
      path: "/prototype",
      label: "Home",
    },
    {
      name: "Screen B — Ranking Detail",
      path: "/prototype/ranking",
      label: "Ranking",
    },
    {
      name: "Screen C — User Profile",
      path: "/prototype/profile",
      label: "Profile",
    },
  ];

  return (
    <div className={styles.refinedShell}>
      {/* Unified Prototype Switcher Bar */}
      <div className={styles.previewBar}>
        <span>
          Design preview{" "}
          <span className={styles.previewNote}>/ Cinematic editorial</span>
        </span>
        <nav aria-label="Prototype screens">
          {screens.map((screen) => (
            <Link
              key={screen.path}
              href={screen.path}
              aria-current={pathname === screen.path ? "page" : undefined}
            >
              {screen.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Unified Cinematic Masthead */}
      <header className={styles.masthead}>
        <Link href="/prototype" className={styles.brand}>
          aubrey<span>rankings</span>
          <i />
        </Link>
        <nav aria-label="Main navigation">
          <Link
            href="/prototype"
            aria-current={pathname === "/prototype" ? "page" : undefined}
          >
            Feed
          </Link>
          <Link href="/prototype#discover" className="ar-discoverNav">
            Discover
          </Link>
          <Link
            href="/prototype/ranking"
            aria-current={
              pathname === "/prototype/ranking" ? "page" : undefined
            }
          >
            Rankings
          </Link>
        </nav>
        <Link
          className={styles.avatar}
          href="/prototype/profile"
          aria-label="Aubrey’s profile"
          aria-current={pathname === "/prototype/profile" ? "page" : undefined}
        >
          a
        </Link>
      </header>

      {/* Main Screen Content */}
      <main>{children}</main>

      {/* Unified Masthead Footer */}
      <footer className={styles.footer}>
        Aubrey Rankings <span>Frontend prototype · local interactions</span>
      </footer>
    </div>
  );
}

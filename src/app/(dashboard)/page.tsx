import Link from "next/link";
import styles from "./page.module.scss";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Harbicht Twitch Shows</h1>
      <nav className={styles.links}>
        <Link className={styles.link} href="/host">
          Host dashboard
        </Link>
        {/* Plain anchor: /overlay uses a different root layout (full page load). */}
        <a className={styles.link} href="/overlay">
          OBS overlay
        </a>
      </nav>
    </main>
  );
}

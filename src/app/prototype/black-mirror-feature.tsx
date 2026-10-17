"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUpRight,
  Maximize2,
  Minimize2,
  Bookmark,
  UserPlus,
} from "lucide-react";
import styles from "./refinement-styles";

/** Shared art direction; artwork and its accent are deliberately curated for this prototype. */
export function BlackMirrorFeature({ detail = false }: { detail?: boolean }) {
  const [immersive, setImmersive] = useState(false);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  return (
    <section
      className={`${styles.feature} ${detail ? `${styles.detail} ar-rankingCover ${immersive ? "ar-immersiveCover" : "ar-compactCover"}` : ""}`}
      aria-label={
        detail
          ? "Black Mirror ranking introduction"
          : "Featured Black Mirror ranking"
      }
    >
      <div className={styles.kicker}>
        {detail ? (
          <Link href="/prototype">
            <ArrowLeft size={14} /> Feed
          </Link>
        ) : (
          <span>In focus</span>
        )}
        <span>{detail ? "A ranking by Aubrey" : "The featured ranking"}</span>
        {detail ? (
          <button
            className="ar-coverToggle"
            aria-expanded={immersive}
            onClick={() => setImmersive(!immersive)}
          >
            {immersive ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {immersive ? "Compact cover" : "Immersive cover"}
          </button>
        ) : (
          <span className={styles.issue}>01 / Television</span>
        )}
      </div>
      <div className={styles.composition}>
        <figure className={styles.artwork}>
          <img
            className={styles.wall}
            src="/prototype-art/black-mirror-wall.jpg"
            alt="A wall of glowing televisions showing characters from Black Mirror"
            fetchPriority="high"
          />
          <div className={styles.imageShade} />
          <img
            className={styles.titleArt}
            src="/prototype-art/black-mirror-logo.png"
            alt="Black Mirror"
          />
          <figcaption>Charlie Brooker’s Black Mirror</figcaption>
        </figure>
        <div className={styles.story}>
          <span className={styles.eyebrow}>
            {detail ? "The episode ranking" : "Through the looking glass"}
          </span>
          <h1>
            {detail ? (
              <>
                Black Mirror,
                <br />
                <span>ranked.</span>
              </>
            ) : (
              <>
                Some futures
                <br />
                stay with you.
              </>
            )}
          </h1>
          <p>
            {detail
              ? "My order, from San Junipero to Black Museum. Eight episodes from seasons 1–6."
              : "A little dread. A little humanity. Aubrey ranks the worlds of Black Mirror, one episode at a time."}
          </p>
          <div className={styles.byline}>
            <Link href="/prototype/profile">
              <span className={styles.smallAvatar}>a</span> Aubrey
            </Link>
            <span>Seasons 1–6</span>
          </div>
          {(!detail || immersive) && (
            <Link
              className={styles.primaryLink}
              href={detail ? "#episode-ranking" : "/prototype/ranking"}
            >
              {detail ? "Explore the ranking" : "See the ranking"}
              {detail ? <ArrowDown size={17} /> : <ArrowUpRight size={19} />}
            </Link>
          )}
          {detail && (
            <div className="ar-coverSocial">
              <button
                aria-pressed={following}
                onClick={() => setFollowing(!following)}
              >
                <UserPlus size={14} />
                {following ? "Following Aubrey" : "Follow Aubrey"}
              </button>
              <button
                aria-label="Save ranking"
                aria-pressed={saved}
                onClick={() => setSaved(!saved)}
              >
                <Bookmark size={14} fill={saved ? "currentColor" : "none"} />
                {saved ? "Saved" : "Save ranking"}
              </button>
            </div>
          )}
        </div>
        <div className={styles.featureFoot}>
          {detail ? (
            <>
              <span>8 preview episodes</span>
              <p>5 weighted categories</p>
              <details className={styles.method}>
                <summary>
                  How it’s scored <span>+</span>
                </summary>
                <div>
                  Scores from 1–10, weighted by category.
                  <dl>
                    {[
                      ["Writing", "8×"],
                      ["Acting", "8×"],
                      ["Cinematography", "7×"],
                      ["Music", "3×"],
                      ["Vibes", "8×"],
                    ].map(([label, weight]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{weight}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </details>
            </>
          ) : (
            <>
              <span>Aubrey’s number one</span>
              <p>
                San Junipero <span>A rare light in the dark.</span>
              </p>
              <Link
                href="/prototype/ranking"
                aria-label="Explore Aubrey’s Black Mirror ranking"
              >
                <ArrowUpRight size={22} />
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

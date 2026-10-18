"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Share2, UserPlus } from "lucide-react";
import { PostActions } from "../community-controls";

const curatedRankings = [
  {
    id: "bm",
    title: "Black Mirror, ranked",
    type: "Anthology Series",
    items: "8 key episodes",
    avg: "9.2",
    image: "/prototype-art/black-mirror-wall.jpg",
    logo: "/prototype-art/black-mirror-logo.png",
    description:
      "The complete mathematical ranking of Charlie Brooker's dystopian anthology, graded on writing, acting, cinematography, sound, and resonant dread.",
    topThree: [
      { rank: "01", title: "San Junipero", score: "9.6", image: "/prototype-art/san-junipero.jpg" },
      { rank: "02", title: "White Christmas", score: "9.5", image: "/prototype-art/white-christmas.jpg" },
      { rank: "03", title: "USS Callister", score: "9.4", image: "/prototype-art/uss-callister.jpg" },
    ],
    href: "/prototype/ranking",
  },
  {
    id: "fincher",
    title: "David Fincher: Filmography Ranked",
    type: "Director Canon",
    items: "11 films",
    avg: "9.2",
    image: "/prototype-art/fincher.jpg",
    description:
      "From Se7en and Fight Club to Zodiac and The Social Network. Evaluated for surgical editing, sound design, and controlled paranoia.",
    topThree: [
      { rank: "01", title: "Zodiac", score: "9.8" },
      { rank: "02", title: "The Social Network", score: "9.7" },
      { rank: "03", title: "Se7en", score: "9.5" },
    ],
    href: "/prototype/ranking",
  },
  {
    id: "scifi",
    title: "Modern Dystopian Sci-Fi",
    type: "Curated Index",
    items: "24 titles",
    avg: "9.0",
    image: "/prototype-art/interstellar.jpg",
    description:
      "Blending television milestones with feature monoliths: Blade Runner 2049, Children of Men, Severance, and Ex Machina.",
    topThree: [
      { rank: "01", title: "Children of Men", score: "9.7" },
      { rank: "02", title: "Blade Runner 2049", score: "9.6" },
      { rank: "03", title: "Severance", score: "9.5" },
    ],
    href: "/prototype/ranking",
  },
  {
    id: "nolan",
    title: "Christopher Nolan: Sagas in 70mm",
    type: "Director Canon",
    items: "12 films",
    avg: "8.9",
    image: "/prototype-art/nolan.jpg",
    description:
      "Examined for narrative puzzle architecture, practical mechanical scale, and relentless propulsive momentum.",
    topThree: [
      { rank: "01", title: "Interstellar", score: "9.6" },
      { rank: "02", title: "The Prestige", score: "9.5" },
      { rank: "03", title: "Oppenheimer", score: "9.4" },
    ],
    href: "/prototype/ranking",
  },
];

const recentReviews = [
  {
    id: "rev-1",
    title: "San Junipero",
    seasonEpisode: "S3, Ep 4",
    year: "2016",
    score: "9.6",
    still: "/prototype-art/san-junipero.jpg",
    date: "2 days ago",
    body: "A rare transcendent romance in an otherwise bleak anthology. Clint Mansell's synth score and Gugu Mbatha-Raw's performance elevate it to sublime art.",
  },
  {
    id: "rev-2",
    title: "White Christmas",
    seasonEpisode: "S2, Ep 4",
    year: "2014",
    score: "9.5",
    still: "/prototype-art/white-christmas.jpg",
    date: "5 days ago",
    body: "Three interwoven horrors culminating in the most terrifying existential punishment ever conceived on television. Jon Hamm at his absolute best.",
  },
  {
    id: "rev-3",
    title: "USS Callister",
    seasonEpisode: "S4, Ep 1",
    year: "2017",
    score: "9.4",
    still: "/prototype-art/uss-callister.jpg",
    date: "1 week ago",
    body: "Toby Haynes balances high-camp technicolor pastiche with genuinely chilling psychological workplace tyranny.",
  },
];

const topAuteurs = [
  {
    name: "Charlie Brooker",
    works: "Black Mirror (33 episodes)",
    avg: "8.7",
    image: "/prototype-art/black-mirror-wall.jpg",
  },
  {
    name: "David Fincher",
    works: "11 films ranked",
    avg: "9.2",
    image: "/prototype-art/fincher.jpg",
  },
  {
    name: "Christopher Nolan",
    works: "12 films ranked",
    avg: "8.9",
    image: "/prototype-art/nolan.jpg",
  },
  {
    name: "Denis Villeneuve",
    works: "6 films ranked",
    avg: "9.4",
    image: "/prototype-art/interstellar.jpg",
  },
];

export default function PrototypeProfilePage() {
  const [following, setFollowing] = useState(true);
  const [followerCount, setFollowerCount] = useState(842);
  const [activeTab, setActiveTab] = useState<"rankings" | "reviews" | "auteurs">(
    "rankings",
  );

  const toggleFollow = () => {
    if (following) {
      setFollowing(false);
      setFollowerCount((c) => c - 1);
    } else {
      setFollowing(true);
      setFollowerCount((c) => c + 1);
    }
  };

  const pinned = curatedRankings[0];

  return (
    <div className="ar-homeContent ar-profilePage">
      <div className="ar-contentSection">
        {/* =========================================================================
            1. COMPACT PROFILE HEADER (Letterboxd + Apple Simplicity)
            ========================================================================= */}
        <header className="ar-profileHeader">
          <div className="ar-profileBioRow">
            <div className="ar-profileAvatar">a</div>
            <div className="ar-profileIdentity">
              <div className="ar-profileNameLine">
                <h1>Aubrey</h1>
                <span className="ar-profileHandle">@aubrey</span>
                <span className="ar-profileBadge">Curator</span>
              </div>
              <p className="ar-profileBio">
                Evaluating media by narrative rigor, visual texture, and weighted rubrics.
              </p>
              <div className="ar-profileFollowStats">
                <span>
                  <strong>{followerCount}</strong> followers
                </span>
                <span>·</span>
                <span>
                  <strong>120</strong> following
                </span>
              </div>
            </div>
            <div className="ar-profileActions">
              <button
                className="ar-profileFollowBtn"
                aria-pressed={following}
                onClick={toggleFollow}
              >
                {following ? "Following" : "Follow"}
              </button>
            </div>
          </div>

          {/* =========================================================================
              2. SUBTLE HORIZONTAL METADATA BAR (Replacing large dashboard boxes)
              ========================================================================= */}
          <div className="ar-profileMetaBar">
            <span>
              <strong>482</strong> rated
            </span>
            <span className="ar-dot">·</span>
            <span>
              <strong>14</strong> rankings
            </span>
            <span className="ar-dot">·</span>
            <span>
              <strong>8.7</strong> mean score
            </span>
            <span className="ar-dot">·</span>
            <span className="ar-profileRubricSummary">5-part weighted rubric</span>
          </div>
        </header>

        {/* =========================================================================
            PROFILE TAB NAVIGATION
            ========================================================================= */}
        <div className="ar-feedNavigation">
          <nav aria-label="Profile views">
            <button
              aria-pressed={activeTab === "rankings"}
              onClick={() => setActiveTab("rankings")}
            >
              Rankings (4)
            </button>
            <button
              aria-pressed={activeTab === "reviews"}
              onClick={() => setActiveTab("reviews")}
            >
              Recent reviews (3)
            </button>
            <button
              aria-pressed={activeTab === "auteurs"}
              onClick={() => setActiveTab("auteurs")}
            >
              Auteurs (4)
            </button>
          </nav>
        </div>

        {/* =========================================================================
            TAB 1: RANKINGS (Default View)
            ========================================================================= */}
        {activeTab === "rankings" && (
          <div className="ar-profileSection">
            {/* PINNED RANKING FEATURE CARD (Same artwork presentation as Feed Screen A) */}
            <div className="ar-profileSectionHeading">
              <h2>Pinned ranking</h2>
              <span>Updated recently</span>
            </div>

            <article className="ar-profilePinnedCard">
              <Link href={pinned.href} className="ar-feedCover">
                <img
                  src={pinned.image}
                  alt="Black Mirror wall of screens"
                />
                <div className="ar-feedCoverShade" />
                <div>
                  <span>{pinned.items} · Seasons 1–6</span>
                  <h2>{pinned.title}</h2>
                </div>
                <img
                  className="ar-feedCoverLogo"
                  src={pinned.logo}
                  alt="Black Mirror transparent title logo"
                />
              </Link>
              <Link
                className="ar-rankingPeek"
                href={pinned.href}
                aria-label="Preview Aubrey’s Black Mirror ranking"
              >
                {pinned.topThree?.map((ep: { rank: string; title: string; score: string; image?: string }) => (
                  <div key={ep.title}>
                    <span>{ep.rank}</span>
                    {ep.image && <img src={ep.image} alt={ep.title} />}
                    <strong>{ep.title}</strong>
                    <small>{ep.score}</small>
                  </div>
                ))}
              </Link>
              <p className="ar-pinnedDesc">{pinned.description}</p>
              <div className="ar-socialActions">
                <Link
                  href={pinned.href}
                  className="ar-textButton"
                  style={{ textDecoration: "none" }}
                >
                  View complete ranking <ArrowRight size={14} />
                </Link>
                <button aria-pressed={false} className="ar-savePost">
                  Bookmark
                </button>
              </div>
            </article>

            {/* CURATED RANKINGS LIST */}
            <div className="ar-profileSectionHeading">
              <h2>Aubrey&apos;s rankings</h2>
              <span>3 published lists</span>
            </div>

            <div className="ar-feedStream">
              {curatedRankings.slice(1).map((list) => (
                <article key={list.id} className="ar-ordinaryPost" style={{ paddingTop: 20 }}>
                  <Link
                    href={list.href}
                    className="ar-smallRanking"
                    style={{ textDecoration: "none" }}
                  >
                    <img src={list.image} alt={list.title} />
                    <div>
                      <span>
                        {list.type} · {list.items} · ★ {list.avg}
                      </span>
                      <h2>{list.title}</h2>
                      <p style={{ fontSize: 13, color: "#9caea2", lineHeight: 1.6, margin: "6px 0 10px" }}>
                        {list.description}
                      </p>
                      <ol>
                        {list.topThree?.map((t) => (
                          <li key={t.title}>
                            {t.title} ({t.score})
                          </li>
                        ))}
                      </ol>
                    </div>
                    <ArrowRight size={18} style={{ color: "#8fa597", flexShrink: 0 }} />
                  </Link>
                  <PostActions name={list.title} count={28} comments={7} />
                </article>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: RECENT REVIEWS
            ========================================================================= */}
        {activeTab === "reviews" && (
          <div className="ar-profileSection">
            <div className="ar-profileSectionHeading">
              <h2>Recent reviews</h2>
              <span>From Aubrey&apos;s critical journal</span>
            </div>

            <div className="ar-feedStream">
              {recentReviews.map((rev) => (
                <article key={rev.id} className="ar-ordinaryPost">
                  <header className="ar-postAuthor">
                    <span className="ar-personAvatar">a</span>
                    <div>
                      <strong>Aubrey</strong>
                      <span>
                        reviewed {rev.title} ({rev.seasonEpisode}) · {rev.date}
                      </span>
                    </div>
                  </header>
                  <div className="ar-reviewBody">
                    <div>
                      <h3>
                        {rev.title}
                        <span>{rev.seasonEpisode} · {rev.year}</span>
                      </h3>
                      <p>{rev.body}</p>
                      <div className="ar-postScore">
                        <span>★ {rev.score}</span>
                        <i />
                        <small>5-part weighted score</small>
                      </div>
                    </div>
                    <img src={rev.still} alt={rev.title} />
                  </div>
                  <PostActions name={rev.title} count={19} comments={4} />
                </article>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: AUTEURS OBSESSIONS
            ========================================================================= */}
        {activeTab === "auteurs" && (
          <div className="ar-profileSection">
            <div className="ar-profileSectionHeading">
              <h2>Auteur obsessions</h2>
              <span>Highest weighted averages</span>
            </div>

            <div className="ar-auteursGrid">
              {topAuteurs.map((auteur) => (
                <div key={auteur.name} className="ar-auteurCard">
                  <div className="ar-auteurImage">
                    <img src={auteur.image} alt={auteur.name} />
                    <span className="ar-auteurScore">★ {auteur.avg}</span>
                  </div>
                  <div className="ar-auteurDetails">
                    <h4>{auteur.name}</h4>
                    <p>{auteur.works}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

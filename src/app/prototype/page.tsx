"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Plus, X } from "lucide-react";
import {
  NewRanking,
  PostActions,
  type RankingDraft,
} from "./community-controls";

const suggestions = [
  {
    id: "julian",
    name: "Julian Vance",
    handle: "@julianv",
    initial: "j",
    subject: "Science fiction & big screens",
  },
  {
    id: "marcus",
    name: "Marcus Chen",
    handle: "@marcus_c",
    initial: "m",
    subject: "Thrillers, frame by frame",
  },
];
const lists = {
  nolan: {
    title: "The worlds of Christopher Nolan",
    creator: "Julian Vance",
    image: "nolan",
    entries: [
      "Interstellar",
      "The Prestige",
      "Oppenheimer",
      "Inception",
      "Dunkirk",
    ],
  },
  fincher: {
    title: "Fincher, in order",
    creator: "Marcus Chen",
    image: "fincher",
    entries: [
      "Zodiac",
      "The Social Network",
      "Fight Club",
      "Gone Girl",
      "Se7en",
    ],
  },
};

export default function PrototypeHomePage() {
  const [feedFilter, setFeedFilter] = useState<"all" | "rankings" | "reviews">(
    "all",
  );
  const [scope, setScope] = useState<"everyone" | "following">("everyone");
  const [following, setFollowing] = useState<Record<string, boolean>>({
    aubrey: true,
  });
  const [draft, setDraft] = useState<RankingDraft | null>(null);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<keyof typeof lists | null>(null);
  const show = (creator: string, type: "rankings" | "reviews") =>
    (scope === "everyone" || following[creator]) &&
    (feedFilter === "all" || feedFilter === type);
  const selectedList = preview ? lists[preview] : null;

  return (
    <div className="ar-homeContent ar-communityHome">
      <section className="ar-contentSection" id="community-feed">
        <header className="ar-communityHeading">
          <div>
            <span className="ar-sectionLabel">Community</span>
            <h1>Your feed</h1>
          </div>
          <button
            className="ar-neutralButton"
            onClick={() => setCreating(true)}
          >
            <Plus size={16} />
            {draft ? "Edit draft" : "New ranking"}
          </button>
        </header>
        <div className="ar-feedNavigation">
          <nav aria-label="Feed audience">
            <button
              aria-pressed={scope === "everyone"}
              onClick={() => setScope("everyone")}
            >
              For you
            </button>
            <button
              aria-pressed={scope === "following"}
              onClick={() => setScope("following")}
            >
              Following
            </button>
          </nav>
          <nav aria-label="Filter activity">
            {(["all", "rankings", "reviews"] as const).map((filter) => (
              <button
                key={filter}
                aria-pressed={feedFilter === filter}
                onClick={() => setFeedFilter(filter)}
              >
                {filter === "all"
                  ? "All activity"
                  : filter === "rankings"
                    ? "Rankings"
                    : "Reviews"}
              </button>
            ))}
          </nav>
        </div>
        <div className="ar-feedLayout">
          <div className="ar-feedStream">
            {draft && (
              <article className="ar-draftNotice">
                <span className="ar-sectionLabel">
                  Your draft · not published
                </span>
                <h2>{draft.title}</h2>
                <p>
                  {draft.entries
                    .map((item, index) => `${index + 1}. ${item}`)
                    .join(" · ")}
                </p>
                <button
                  className="ar-textButton"
                  onClick={() => setCreating(true)}
                >
                  Edit draft
                </button>
              </article>
            )}
            {show("aubrey", "rankings") && (
              <article className="ar-featuredPost ar-feedRanking">
                <header className="ar-postAuthor">
                  <Link
                    href="/prototype/profile"
                    className="ar-personAvatar"
                    aria-label="Aubrey’s profile"
                  >
                    a
                  </Link>
                  <div>
                    <Link href="/prototype/profile">Aubrey</Link>
                    <span>updated a ranking · 2h</span>
                  </div>
                  <button
                    className="ar-followInline"
                    aria-pressed={!!following.aubrey}
                    onClick={() =>
                      setFollowing({ ...following, aubrey: !following.aubrey })
                    }
                  >
                    {following.aubrey ? "Following" : "Follow"}
                  </button>
                </header>
                <Link href="/prototype/ranking" className="ar-feedCover">
                  <img
                    src="/prototype-art/black-mirror-wall.jpg"
                    alt="Black Mirror’s wall of television screens"
                  />
                  <div className="ar-feedCoverShade" />
                  <div>
                    <span>8 episodes · Seasons 1–6</span>
                    <h2>
                      Black Mirror,
                      <br />
                      ranked.
                    </h2>
                  </div>
                  <img
                    className="ar-feedCoverLogo"
                    src="/prototype-art/black-mirror-logo.png"
                    alt=""
                  />
                </Link>
                <Link
                  className="ar-rankingPeek"
                  href="/prototype/ranking"
                  aria-label="Preview Aubrey’s Black Mirror ranking"
                >
                  {[
                    ["San Junipero", "san-junipero", "9.6"],
                    ["White Christmas", "white-christmas", "9.5"],
                    ["USS Callister", "uss-callister", "9.4"],
                  ].map(([title, image, score], index) => (
                    <div key={title}>
                      <span>0{index + 1}</span>
                      <img src={`/prototype-art/${image}.jpg`} alt="" />
                      <strong>{title}</strong>
                      <small>{score}</small>
                    </div>
                  ))}
                </Link>
                <PostActions name="Aubrey’s ranking" count={42} comments={14} />
              </article>
            )}
            {show("julian", "rankings") && (
              <article className="ar-practicalPost">
                <header className="ar-postAuthor">
                  <span className="ar-personAvatar">j</span>
                  <div>
                    <strong>Julian Vance</strong>
                    <span>published a ranking · 3h</span>
                  </div>
                  <button
                    className="ar-followInline"
                    aria-pressed={!!following.julian}
                    onClick={() =>
                      setFollowing({ ...following, julian: !following.julian })
                    }
                  >
                    {following.julian ? "Following" : "Follow"}
                  </button>
                </header>
                <button
                  className="ar-smallRanking"
                  onClick={() => setPreview("nolan")}
                >
                  <img src="/prototype-art/nolan.jpg" alt="Oppenheimer" />
                  <div>
                    <span>5 films in this preview</span>
                    <h2>The worlds of Christopher Nolan</h2>
                    <ol>
                      <li>Interstellar</li>
                      <li>The Prestige</li>
                      <li>Oppenheimer</li>
                    </ol>
                  </div>
                  <ArrowUpRight size={18} />
                </button>
                <PostActions name="Julian’s ranking" count={28} comments={6} />
              </article>
            )}
            {show("julian", "reviews") && (
              <article className="ar-ordinaryPost">
                <header className="ar-postAuthor">
                  <span className="ar-personAvatar">j</span>
                  <div>
                    <strong>Julian Vance</strong>
                    <span>reviewed a film · 5h</span>
                  </div>
                  <span className="ar-reviewScore">
                    9.5 <small>/ 10</small>
                  </span>
                </header>
                <div className="ar-reviewBody">
                  <div>
                    <h3>
                      Interstellar <span>2014</span>
                    </h3>
                    <p>
                      “The docking sequence still gets me. Zimmer’s organ score
                      makes something impossibly vast feel completely human.”
                    </p>
                  </div>
                  <img
                    src="/prototype-art/interstellar.jpg"
                    alt="Interstellar"
                    loading="lazy"
                  />
                </div>
                <PostActions name="Julian’s review" count={19} comments={8} />
              </article>
            )}
            {show("marcus", "rankings") && (
              <article className="ar-practicalPost">
                <header className="ar-postAuthor">
                  <span className="ar-personAvatar">m</span>
                  <div>
                    <strong>Marcus Chen</strong>
                    <span>updated a ranking · 6h</span>
                  </div>
                </header>
                <button
                  className="ar-smallRanking"
                  onClick={() => setPreview("fincher")}
                >
                  <img src="/prototype-art/fincher.jpg" alt="Fight Club" />
                  <div>
                    <span>5 films in this preview</span>
                    <h2>Fincher, in order</h2>
                    <ol>
                      <li>Zodiac</li>
                      <li>The Social Network</li>
                      <li>Fight Club</li>
                    </ol>
                  </div>
                  <ArrowUpRight size={18} />
                </button>
                <PostActions name="Marcus’s ranking" count={31} comments={4} />
              </article>
            )}
            {![
              show("aubrey", "rankings"),
              show("julian", "rankings"),
              show("julian", "reviews"),
              show("marcus", "rankings"),
            ].some(Boolean) && (
              <div className="ar-feedEmpty">
                <h2>No activity here yet.</h2>
                <p>
                  Follow a creator or switch to For you to discover more
                  rankings.
                </p>
                <button
                  className="ar-textButton"
                  onClick={() => {
                    setScope("everyone");
                    setFeedFilter("all");
                  }}
                >
                  See all activity
                </button>
              </div>
            )}
          </div>
          <aside
            className="ar-discoverAside"
            id="discover"
            aria-label="Community discovery"
          >
            <span className="ar-sectionLabel">Find your people</span>
            <h3>People to follow</h3>
            {suggestions.map((person) => (
              <div className="ar-personSuggestion" key={person.id}>
                <span className="ar-personAvatar">{person.initial}</span>
                <div>
                  <strong>{person.name}</strong>
                  <span>{person.handle}</span>
                  <p>{person.subject}</p>
                </div>
                <button
                  aria-label={`Follow ${person.name}`}
                  aria-pressed={!!following[person.id]}
                  onClick={() =>
                    setFollowing({
                      ...following,
                      [person.id]: !following[person.id],
                    })
                  }
                >
                  {following[person.id] ? "Following" : "Follow"}
                </button>
              </div>
            ))}
            <div className="ar-discoveryLists">
              <span className="ar-sectionLabel">Around the community</span>
              <h3>Popular rankings</h3>
              {(Object.keys(lists) as (keyof typeof lists)[]).map((id) => (
                <button
                  className="ar-discoverItem"
                  key={id}
                  onClick={() => setPreview(id)}
                >
                  <div className="ar-discoverImage">
                    <img src={`/prototype-art/${lists[id].image}.jpg`} alt="" />
                  </div>
                  <div>
                    <h4>{lists[id].title}</h4>
                    <p>{lists[id].creator} · 5 films</p>
                  </div>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>
            <Link href="/prototype/profile" className="ar-asideProfileLink">
              Your profile & rankings <ArrowUpRight size={15} />
            </Link>
          </aside>
        </div>
      </section>
      {creating && (
        <NewRanking
          draft={draft}
          onSave={setDraft}
          onClose={() => setCreating(false)}
        />
      )}
      {selectedList && (
        <div
          className="ar-communityDialogBackdrop"
          onClick={() => setPreview(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setPreview(null);
          }}
        >
          <section
            className="ar-communityDialog ar-listPreview"
            role="dialog"
            aria-modal="true"
            aria-label={selectedList.title}
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <span className="ar-sectionLabel">
                Ranking preview · {selectedList.creator}
              </span>
              <button
                autoFocus
                aria-label="Close ranking preview"
                onClick={() => setPreview(null)}
              >
                <X size={20} />
              </button>
            </header>
            <h2>{selectedList.title}</h2>
            <ol>
              {selectedList.entries.map((entry, index) => (
                <li key={entry}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {entry}
                </li>
              ))}
            </ol>
            <PostActions name={selectedList.title} count={28} comments={6} />
            <p className="ar-localNote">Sample ranking · frontend preview</p>
          </section>
        </div>
      )}
    </div>
  );
}

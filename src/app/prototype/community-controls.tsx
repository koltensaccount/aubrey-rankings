"use client";

import { useState } from "react";
import {
  Bookmark,
  Heart,
  MessageCircle,
  X,
  Plus,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

export function PostActions({
  name,
  count,
  comments = 0,
}: {
  name: string;
  count: number;
  comments?: number;
}) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="ar-socialActions">
        <button
          aria-label={`Like ${name}`}
          aria-pressed={liked}
          onClick={() => setLiked(!liked)}
        >
          <Heart size={16} fill={liked ? "currentColor" : "none"} />
          {count + (liked ? 1 : 0)}
        </button>
        <button
          aria-label={`Comments on ${name}`}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <MessageCircle size={16} />
          {comments}
        </button>
        <button
          className="ar-savePost"
          aria-label={`Save ${name}`}
          aria-pressed={saved}
          onClick={() => setSaved(!saved)}
        >
          <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
          <span>{saved ? "Saved" : "Save"}</span>
        </button>
      </div>
      {open && (
        <div className="ar-commentPreview">
          <strong>In the conversation</strong>
          <p>
            <b>Elena</b> I love seeing how everyone’s order differs.
          </p>
          <p>
            <b>Marcus</b> What made your top pick stand out?
          </p>
          <span>Sample conversation · frontend preview</span>
        </div>
      )}
    </>
  );
}

export type RankingDraft = { title: string; entries: string[] };

export function NewRanking({
  onClose,
  draft,
  onSave,
}: {
  onClose: () => void;
  draft: RankingDraft | null;
  onSave: (draft: RankingDraft) => void;
}) {
  const [title, setTitle] = useState(draft?.title ?? "");
  const [entry, setEntry] = useState("");
  const [entries, setEntries] = useState<string[]>(draft?.entries ?? []);
  const [saved, setSaved] = useState(false);
  function addEntry() {
    if (entry.trim()) {
      setEntries([...entries, entry.trim()]);
      setEntry("");
    }
  }
  function move(index: number, delta: number) {
    const next = [...entries];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setEntries(next);
  }
  return (
    <div
      className="ar-communityDialogBackdrop"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-heading"
        className="ar-communityDialog"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <span className="ar-sectionLabel">Local prototype</span>
            <h2 id="draft-heading">New ranking</h2>
          </div>
          <button aria-label="Close new ranking" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {saved ? (
          <div className="ar-draftSaved">
            <h3>Draft saved for this preview.</h3>
            <p>
              {title} · {entries.length} entries
            </p>
            <ol>
              {entries.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ol>
            <button className="ar-neutralButton" onClick={onClose}>
              Back to the feed
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim() && entries.length) {
                onSave({ title: title.trim(), entries });
                setSaved(true);
              }
            }}
          >
            <label htmlFor="ranking-title">Ranking title</label>
            <input
              id="ranking-title"
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. My favourite Black Mirror episodes"
            />
            <label htmlFor="ranking-entry">Add an entry</label>
            <div className="ar-draftAdd">
              <input
                id="ranking-entry"
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addEntry();
                  }
                }}
                placeholder="Film, series, or episode"
              />
              <button type="button" onClick={addEntry} aria-label="Add entry">
                <Plus size={19} />
              </button>
            </div>
            <ol className="ar-draftEntries">
              {entries.map((item, index) => (
                <li key={index}>
                  <span>{index + 1}</span>
                  <strong>{item}</strong>
                  <button
                    type="button"
                    aria-label={`Move ${item} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${item} down`}
                    disabled={index === entries.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${item}`}
                    onClick={() =>
                      setEntries(entries.filter((_, i) => i !== index))
                    }
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ol>
            <p className="ar-localNote">
              A local draft only. Nothing is published or sent to a server.
            </p>
            <button
              className="ar-neutralButton"
              disabled={!title.trim() || !entries.length}
              type="submit"
            >
              Save draft
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Loader2, Check } from "lucide-react";

export function NotificationsTab() {
  const [notifPrefs, setNotifPrefs] = useState({
    notifyFollows: true,
    notifyLikes: true,
    notifyComments: true,
    notifyReplies: true,
    notifyTvReleases: true,
    notifyMovieReleases: true,
  });
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState(false);

  useEffect(() => {
    fetchNotifPrefs();
  }, []);

  const fetchNotifPrefs = async () => {
    setLoadingNotifs(true);
    try {
      const res = await fetch("/api/notifications/preferences");
      if (res.ok) {
        const data = await res.json();
        if (data.preferences) {
          setNotifPrefs(data.preferences);
        }
      }
    } catch {
      // Ignore
    } finally {
      setLoadingNotifs(false);
    }
  };

  const handleTogglePref = async (key: keyof typeof notifPrefs) => {
    const nextVal = !notifPrefs[key];
    const nextPrefs = { ...notifPrefs, [key]: nextVal };
    setNotifPrefs(nextPrefs);
    setSavingNotifs(true);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: nextVal }),
      });
      if (res.ok) {
        setNotifSuccess(true);
        setTimeout(() => setNotifSuccess(false), 2500);
      }
    } catch {
      // Rollback on error
      setNotifPrefs((prev) => ({ ...prev, [key]: !nextVal }));
    } finally {
      setSavingNotifs(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="p-6 rounded-card border border-border-card bg-card space-y-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <h3 className="font-display text-lg font-bold uppercase tracking-tight text-foreground">
              In-App Notification Preferences
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose which community interactions and tracked release alerts trigger notifications.
            </p>
          </div>

          {savingNotifs ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              <span>Saving…</span>
            </div>
          ) : notifSuccess ? (
            <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
              <Check className="w-3.5 h-3.5" />
              <span>Preferences saved</span>
            </div>
          ) : null}
        </div>

        <div className="divide-y divide-border/40">
          <div className="py-4 flex items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground">New Followers</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Receive an alert when another curator or member begins following your profile.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleTogglePref("notifyFollows")}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                notifPrefs.notifyFollows ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                  notifPrefs.notifyFollows ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="py-4 flex items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Ranking Likes</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Receive an alert when someone likes one of your public or unlisted rankings.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleTogglePref("notifyLikes")}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                notifPrefs.notifyLikes ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                  notifPrefs.notifyLikes ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="py-4 flex items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Comments</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Receive an alert when another user leaves a comment on your rankings.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleTogglePref("notifyComments")}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                notifPrefs.notifyComments ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                  notifPrefs.notifyComments ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="py-4 flex items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Comment Replies</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Receive an alert when someone replies to a comment you wrote.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleTogglePref("notifyReplies")}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                notifPrefs.notifyReplies ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                  notifPrefs.notifyReplies ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="py-4 flex items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground">New TV Episodes</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Get alerted when newly qualifying episodes air for television series you are tracking.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleTogglePref("notifyTvReleases")}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                notifPrefs.notifyTvReleases ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                  notifPrefs.notifyTvReleases ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="py-4 flex items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground">New Franchise Movies</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Get notified when new franchise installments are officially released for collections you track.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleTogglePref("notifyMovieReleases")}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                notifPrefs.notifyMovieReleases ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                  notifPrefs.notifyMovieReleases ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

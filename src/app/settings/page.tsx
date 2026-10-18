"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Palette,
  Bell,
  Sliders,
  User,
  FileSpreadsheet,
  Shield,
} from "lucide-react";
import { AppearanceTab } from "./components/appearance-tab";
import { NotificationsTab } from "./components/notifications-tab";
import { RatingSystemsTab } from "./components/rating-systems-tab";
import { AccountTab } from "./components/account-tab";
import { DataTab } from "./components/data-tab";
import { PrivacyTab } from "./components/privacy-tab";

type SettingsTab =
  | "appearance"
  | "notifications"
  | "privacy_safety"
  | "rating_systems"
  | "account"
  | "data";

const VALID_TABS: SettingsTab[] = [
  "appearance",
  "notifications",
  "privacy_safety",
  "rating_systems",
  "account",
  "data",
];

function SettingsContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as SettingsTab | null;
  const systemIdParam = searchParams.get("systemId") || undefined;

  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (tabParam && VALID_TABS.includes(tabParam)) {
      return tabParam;
    }
    return "appearance";
  });

  useEffect(() => {
    if (tabParam && VALID_TABS.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div>
        <span className="text-[11px] text-muted-foreground uppercase tracking-wider block">
          Platform Configuration
        </span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-tight text-foreground mt-1">
          Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage personalized weighted rubrics, critique preferences, and account security.
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border pb-px overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("appearance")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
            activeTab === "appearance"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Palette size={14} className={activeTab === "appearance" ? "text-primary" : ""} />
          <span>Appearance</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("notifications")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
            activeTab === "notifications"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Bell size={14} className={activeTab === "notifications" ? "text-primary" : ""} />
          <span>Notifications</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("privacy_safety")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
            activeTab === "privacy_safety"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Shield size={14} className={activeTab === "privacy_safety" ? "text-primary" : ""} />
          <span>Privacy & Safety</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("rating_systems")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
            activeTab === "rating_systems"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sliders size={14} className={activeTab === "rating_systems" ? "text-primary" : ""} />
          <span>Weighted Rubrics</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("account")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
            activeTab === "account"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <User size={14} className={activeTab === "account" ? "text-primary" : ""} />
          <span>Account & Security</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("data")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
            activeTab === "data"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileSpreadsheet size={14} className={activeTab === "data" ? "text-primary" : ""} />
          <span>Data & Import</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "appearance" && <AppearanceTab />}
      {activeTab === "notifications" && <NotificationsTab />}
      {activeTab === "privacy_safety" && <PrivacyTab />}
      {activeTab === "rating_systems" && <RatingSystemsTab initialSystemId={systemIdParam} />}
      {activeTab === "account" && <AccountTab />}
      {activeTab === "data" && <DataTab />}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-10 text-muted-foreground text-xs">Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}

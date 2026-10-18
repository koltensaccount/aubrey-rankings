"use client";

import { useState } from "react";
import { FollowListDialog } from "./follow-list-dialog";
import { FollowButton } from "./follow-button";

interface ProfileSocialStatsProps {
  userId: string;
  username?: string | null;
  targetName?: string | null;
  initialFollowersCount: number;
  initialFollowingCount: number;
  initialIsFollowing?: boolean;
  isOwnProfile?: boolean;
  accentColor?: string;
  accentFg?: string;
  showFollowButton?: boolean;
}

export function ProfileSocialStats({
  userId,
  username,
  targetName,
  initialFollowersCount,
  initialFollowingCount,
  initialIsFollowing = false,
  isOwnProfile = false,
  accentColor,
  accentFg,
  showFollowButton = false,
}: ProfileSocialStatsProps) {
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);
  const [followingCount, setFollowingCount] = useState(initialFollowingCount);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"followers" | "following">("followers");

  const refreshCounts = async () => {
    try {
      const res = await fetch(`/api/social/follow?targetUserId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.followersCount === "number") {
          setFollowersCount(data.followersCount);
        }
        if (typeof data.followingCount === "number") {
          setFollowingCount(data.followingCount);
        }
      }
    } catch {
      // Ignore count fetch errors
    }
  };

  const openFollowers = () => {
    setDialogType("followers");
    setDialogOpen(true);
  };

  const openFollowing = () => {
    setDialogType("following");
    setDialogOpen(true);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="ar-profileFollowStats flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={openFollowers}
            className="group cursor-pointer hover:text-foreground transition-colors p-0 border-0 bg-transparent text-left"
            title="View followers"
          >
            <strong className="group-hover:text-primary transition-colors text-foreground font-semibold mr-1">
              {followersCount}
            </strong>
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">
              followers
            </span>
          </button>

          <span className="text-muted-foreground/60">·</span>

          <button
            type="button"
            onClick={openFollowing}
            className="group cursor-pointer hover:text-foreground transition-colors p-0 border-0 bg-transparent text-left"
            title="View following"
          >
            <strong className="group-hover:text-primary transition-colors text-foreground font-semibold mr-1">
              {followingCount}
            </strong>
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">
              following
            </span>
          </button>
        </div>

        {showFollowButton && (
          <div className="ml-auto">
            <FollowButton
              targetUserId={userId}
              targetUsername={username || ""}
              initialIsFollowing={initialIsFollowing}
              initialFollowersCount={followersCount}
              initialFollowingCount={followingCount}
              isOwnProfile={isOwnProfile}
              accentColor={accentColor}
              accentFg={accentFg}
              showStats={false}
            />
          </div>
        )}
      </div>

      <FollowListDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        userId={userId}
        username={username}
        targetName={targetName}
        initialType={dialogType}
        onFollowChange={refreshCounts}
      />
    </>
  );
}

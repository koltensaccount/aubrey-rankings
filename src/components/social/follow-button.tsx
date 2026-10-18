"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus, UserCheck, Settings, Loader2 } from "lucide-react";

interface FollowButtonProps {
  targetUserId: string;
  targetUsername: string;
  initialIsFollowing: boolean;
  initialFollowersCount: number;
  initialFollowingCount: number;
  isOwnProfile?: boolean;
}

export function FollowButton({
  targetUserId,
  targetUsername,
  initialIsFollowing,
  initialFollowersCount,
  initialFollowingCount,
  isOwnProfile = false,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);
  const [followingCount, setFollowingCount] = useState(initialFollowingCount);
  const [loading, setLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  if (isOwnProfile) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 text-xs text-[#8fa095]">
          <span>
            <strong className="text-[#f1f0e9] font-medium">{followersCount}</strong> followers
          </span>
          <span className="text-[#3b4c40]">·</span>
          <span>
            <strong className="text-[#f1f0e9] font-medium">{followingCount}</strong> following
          </span>
        </div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#3b4c40] bg-[#17201c] hover:bg-[#1f2b26] text-xs font-semibold text-[#f1f0e9] transition-colors"
        >
          <Settings size={13} className="text-[#89d5d5]" />
          <span>Edit Profile</span>
        </Link>
      </div>
    );
  }

  const handleToggleFollow = async () => {
    if (loading) return;
    setLoading(true);

    const nextState = !isFollowing;
    const nextCount = nextState ? followersCount + 1 : Math.max(0, followersCount - 1);

    // Optimistic update
    setIsFollowing(nextState);
    setFollowersCount(nextCount);

    try {
      const res = await fetch("/api/social/follow", {
        method: nextState ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });

      if (!res.ok) {
        throw new Error("Failed to update follow status");
      }

      const data = await res.json();
      setIsFollowing(data.isFollowing);
      setFollowersCount(data.followersCount);
      setFollowingCount(data.followingCount);
    } catch (err) {
      // Rollback on error
      setIsFollowing(!nextState);
      setFollowersCount(followersCount);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-3 text-xs text-[#8fa095]">
        <span>
          <strong className="text-[#f1f0e9] font-medium">{followersCount}</strong> followers
        </span>
        <span className="text-[#3b4c40]">·</span>
        <span>
          <strong className="text-[#f1f0e9] font-medium">{followingCount}</strong> following
        </span>
      </div>

      <button
        onClick={handleToggleFollow}
        disabled={loading}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all min-w-[105px] ${
          isFollowing
            ? isHovered
              ? "bg-[#331c1e] text-[#f87171] border border-[#7f1d1d]"
              : "bg-[#17201c] text-[#89d5d5] border border-[#3b4c40]"
            : "bg-[#89d5d5] hover:bg-[#a2e5e5] text-[#102523] border border-transparent shadow-sm shadow-[#89d5d5]/20"
        }`}
      >
        {loading ? (
          <Loader2 size={13} className="animate-spin" />
        ) : isFollowing ? (
          isHovered ? (
            <span>Unfollow</span>
          ) : (
            <>
              <UserCheck size={13} />
              <span>Following</span>
            </>
          )
        ) : (
          <>
            <UserPlus size={13} />
            <span>Follow</span>
          </>
        )}
      </button>
    </div>
  );
}

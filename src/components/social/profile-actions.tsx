"use client";

import { useState } from "react";
import { MoreHorizontal, UserX, Flag, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ReportDialog } from "./report-dialog";

interface ProfileActionsProps {
  targetUserId: string;
  targetUsername: string;
  initialIsBlocked?: boolean;
}

export function ProfileActions({
  targetUserId,
  targetUsername,
  initialIsBlocked = false,
}: ProfileActionsProps) {
  const [isBlocked, setIsBlocked] = useState(initialIsBlocked);
  const [loading, setLoading] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const handleToggleBlock = async () => {
    setLoading(true);
    try {
      const method = isBlocked ? "DELETE" : "POST";
      const res = await fetch("/api/social/block", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });

      if (res.ok) {
        setIsBlocked(!isBlocked);
        setPopoverOpen(false);
        // Refresh page to update view
        window.location.reload();
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="p-2 rounded-lg border border-border bg-surface hover:bg-surface-raised text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label="Profile safety actions"
          >
            <MoreHorizontal size={14} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={6}
          className="w-48 p-1 rounded-card border border-border bg-card shadow-dialog"
        >
          <div className="space-y-0.5 text-xs">
            <button
              type="button"
              onClick={handleToggleBlock}
              disabled={loading}
              className="w-full text-left px-2.5 py-1.5 rounded-sm hover:bg-destructive/10 flex items-center gap-2 text-destructive transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <UserX size={13} />
              )}
              <span>{isBlocked ? `Unblock @${targetUsername}` : `Block @${targetUsername}`}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPopoverOpen(false);
                setReportOpen(true);
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-sm hover:bg-surface flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Flag size={13} />
              <span>Report @{targetUsername}</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <ReportDialog
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="user"
        targetId={targetUserId}
        targetTitle={`@${targetUsername}`}
      />
    </>
  );
}

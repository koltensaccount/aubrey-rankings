"use client";

import React, { RefObject } from "react";
import { Check, Image as ImageIcon, Loader2, X } from "lucide-react";

interface CollectionBannerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  bannerUrlInput: string;
  onBannerUrlInputChange: (val: string) => void;
  bannerFileRef: RefObject<HTMLInputElement | null>;
  onBannerUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  bannerUploading: boolean;
  onSaveBanner: () => void;
  savingBanner: boolean;
}

export function CollectionBannerDialog({
  isOpen,
  onClose,
  bannerUrlInput,
  onBannerUrlInputChange,
  bannerFileRef,
  onBannerUpload,
  bannerUploading,
  onSaveBanner,
  savingBanner,
}: CollectionBannerDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-dialog bg-card border border-border-dialog p-6 shadow-dialog space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="font-display text-xl uppercase font-bold text-foreground">
              Ranking Header Banner
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload a custom backdrop image or specify an image URL.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current Banner Preview */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Preview
          </label>
          <div className="aspect-[21/9] rounded-lg overflow-hidden bg-black/40 border border-border relative">
            {bannerUrlInput ? (
              <img
                src={bannerUrlInput}
                alt="Banner preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-xs text-muted-foreground gap-1">
                <ImageIcon size={20} className="text-muted-foreground/60" />
                <span>No custom banner set (using default)</span>
              </div>
            )}
          </div>
        </div>

        {/* Upload File */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Upload Custom Image
          </label>
          <input
            type="file"
            ref={bannerFileRef}
            onChange={onBannerUpload}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => bannerFileRef.current?.click()}
              disabled={bannerUploading}
              className="px-4 py-2 rounded-button bg-secondary hover:bg-surface text-foreground border border-border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {bannerUploading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <ImageIcon size={13} />
                  <span>Choose Image File</span>
                </>
              )}
            </button>
            {bannerUrlInput && (
              <button
                type="button"
                onClick={() => onBannerUrlInputChange("")}
                className="px-3 py-2 text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              >
                Clear Banner
              </button>
            )}
          </div>
        </div>

        {/* Or Paste URL */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Or Image URL
          </label>
          <input
            type="url"
            value={bannerUrlInput}
            onChange={(e) => onBannerUrlInputChange(e.target.value)}
            placeholder="https://..."
            className="w-full text-xs rounded-input px-3.5 py-2.5 bg-surface border border-border-input text-foreground focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={savingBanner}
            className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSaveBanner}
            disabled={savingBanner || bannerUploading}
            className="px-5 py-2.5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {savingBanner ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check size={13} />
                <span>Apply Banner</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

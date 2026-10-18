"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  useDroppable,
  DropAnimation,
  defaultDropAnimationSideEffects,
  CollisionDetection,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  X,
  Layers,
  Settings2,
  Check,
  Loader2,
  MoreVertical,
  HelpCircle,
  Eye,
  ArrowUpDown,
  Sparkles,
} from "lucide-react";
import { CinematicMediaCard } from "@/components/cinematic-media-card";

interface TierBoardEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: any;
  processedEntries: any[];
  onOpenCustomizeTiers: () => void;
  onQuickAssignTier: (mediaItem: any, tierId: string | null) => Promise<void>;
  onRefreshCollection?: () => Promise<void>;
}

const dropAnimationConfig: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: "0.4",
      },
    },
  }),
};

// Collision detection: check pointer within first, fallback to closest corners
const customCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  return closestCorners(args);
};

// Sortable item inside a tier row or unranked tray
function SortableMediaCard({
  entry,
  containerId,
  tiers,
  onMoveToTier,
  isOverlay,
}: {
  entry: any;
  containerId: string;
  tiers: any[];
  onMoveToTier: (entryId: string, targetTierId: string | null) => void;
  isOverlay?: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: entry.id,
    disabled: isOverlay,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    touchAction: "none",
  };

  const media = entry?.mediaItem || {};
  const isStill = media.mediaType === "episode" || Boolean(media.stillPath);
  const isEpisode =
    (media.mediaType === "episode" || media.seasonNumber != null || media.episodeNumber != null) &&
    media.seasonNumber != null &&
    media.episodeNumber != null &&
    media.mediaType !== "movie";
  const episodeBadgeText = isEpisode
    ? `S${String(media.seasonNumber).padStart(2, "0")} · E${String(media.episodeNumber).padStart(2, "0")}`
    : null;

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [showMenu]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-entry-id={entry.id}
      data-media-title={media.title}
      className={`group relative rounded-md overflow-hidden bg-card border border-border shrink-0 select-none transition-shadow ${
        isStill ? "w-32 sm:w-36 md:w-40" : "w-20 sm:w-24 md:w-28"
      } ${
        isOverlay
          ? "ring-2 ring-primary shadow-2xl scale-105 z-50 cursor-grabbing"
          : "hover:border-primary/60 hover:shadow-md cursor-grab active:cursor-grabbing"
      }`}
      {...attributes}
      {...listeners}
    >
      {/* Artwork container preserving poster 2:3 or still 16:9 ratio */}
      <div
        className={`relative w-full overflow-hidden bg-surface ${
          isStill ? "aspect-[16/9]" : "aspect-[2/3]"
        }`}
      >
        <CinematicMediaCard
          stillPath={media.stillPath}
          posterPath={media.posterPath}
          title={media.title}
          aspect={isStill ? "video" : "poster"}
        />

        {/* Compact TV Episode Badge visible without hover */}
        {episodeBadgeText && (
          <div
            data-testid="episode-badge"
            className="absolute top-1 left-1 z-10 pointer-events-none px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md text-foreground border border-border/60 text-[9px] font-mono font-bold tracking-wider shadow-sm select-none"
          >
            {episodeBadgeText}
          </div>
        )}

        {/* Accessible Non-Drag Move Trigger (always available, visible on hover / focus) */}
        {!isOverlay && (
          <div
            ref={menuRef}
            className="absolute top-1 right-1 z-20"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              data-testid="card-move-menu-trigger"
              aria-label={`Move ${media.title} to tier`}
              title="Move to tier (non-drag alternative)"
              onClick={() => setShowMenu((prev) => !prev)}
              className="w-6 h-6 rounded bg-black/75 hover:bg-black text-white/90 hover:text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-opacity cursor-pointer shadow-sm border border-white/20"
            >
              <ArrowUpDown size={11} />
            </button>

            {/* Accessible move dropdown menu */}
            {showMenu && (
              <div className="absolute right-0 top-7 w-40 bg-card border border-border shadow-xl rounded-md p-1.5 z-50 text-xs flex flex-col gap-1 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground px-2 py-0.5 border-b border-border/50">
                  Move to
                </div>
                {tiers.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    data-testid={`move-to-tier-${t.name}`}
                    data-tier-id={t.id}
                    onClick={() => {
                      onMoveToTier(entry.id, t.id);
                      setShowMenu(false);
                    }}
                    className={`flex items-center gap-2 px-2 py-1 rounded text-left text-[11px] font-medium transition-colors hover:bg-surface cursor-pointer ${
                      containerId === t.id ? "text-primary font-bold bg-primary/10" : "text-foreground"
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className="truncate">{t.name}</span>
                    {containerId === t.id && <Check size={12} className="ml-auto text-primary" />}
                  </button>
                ))}
                <button
                  type="button"
                  data-testid="move-to-unranked"
                  onClick={() => {
                    onMoveToTier(entry.id, null);
                    setShowMenu(false);
                  }}
                  className={`flex items-center gap-2 px-2 py-1 rounded text-left text-[11px] font-medium transition-colors hover:bg-surface cursor-pointer border-t border-border/50 pt-1.5 ${
                    containerId === "unranked" ? "text-primary font-bold bg-primary/10" : "text-muted-foreground"
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40 shrink-0" />
                  <span>Unranked Tray</span>
                  {containerId === "unranked" && <Check size={12} className="ml-auto text-primary" />}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Title footer */}
      <div className="p-1 bg-card/95 border-t border-border/50">
        <div
          title={episodeBadgeText ? `${episodeBadgeText} — ${media.title}` : media.title}
          className="text-[10px] font-medium text-foreground truncate font-display leading-tight"
        >
          {media.title}
        </div>
      </div>
    </div>
  );
}

// Droppable Tier Row
function DroppableTierRow({
  tier,
  itemIds,
  entriesById,
  tiers,
  onMoveToTier,
  isOver,
}: {
  tier: any;
  itemIds: string[];
  entriesById: Map<string, any>;
  tiers: any[];
  onMoveToTier: (entryId: string, targetTierId: string | null) => void;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: tier.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col md:flex-row border rounded-lg overflow-hidden transition-colors ${
        isOver
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border-card bg-card/70 hover:border-border"
      }`}
    >
      {/* Traditional TierMaker Left Label */}
      <div
        className="w-full md:w-28 lg:w-36 p-3 shrink-0 flex md:flex-col items-center justify-between md:justify-center text-center gap-1.5 shadow-sm"
        style={{
          backgroundColor: tier.color,
          color: "#000000",
        }}
      >
        <div className="font-display font-black text-2xl sm:text-3xl tracking-tight leading-none drop-shadow-xs">
          {tier.name}
        </div>
        <div className="text-[10px] font-semibold text-black/80 line-clamp-1 max-w-[120px]">
          {tier.description || `${itemIds.length} titles`}
        </div>
      </div>

      {/* Right Drop Area for Items */}
      <div className="flex-1 p-2.5 sm:p-3 flex flex-wrap items-center gap-2 sm:gap-3 min-h-[110px] bg-surface/30">
        <SortableContext items={itemIds} strategy={rectSortingStrategy}>
          {itemIds.length === 0 ? (
            <div className="w-full py-6 text-center text-xs text-muted-foreground/60 italic">
              Drag titles here or use the move menu on any card
            </div>
          ) : (
            itemIds.map((id) => {
              const entry = entriesById.get(id);
              if (!entry) return null;
              return (
                <SortableMediaCard
                  key={id}
                  entry={entry}
                  containerId={tier.id}
                  tiers={tiers}
                  onMoveToTier={onMoveToTier}
                />
              );
            })
          )}
        </SortableContext>
      </div>
    </div>
  );
}

// Droppable Unranked Tray
function DroppableUnrankedTray({
  itemIds,
  entriesById,
  tiers,
  onMoveToTier,
  isOver,
}: {
  itemIds: string[];
  entriesById: Map<string, any>;
  tiers: any[];
  onMoveToTier: (entryId: string, targetTierId: string | null) => void;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: "unranked",
  });

  return (
    <div
      ref={setNodeRef}
      data-testid="unranked-tray"
      className={`border border-dashed rounded-lg p-3 sm:p-4 transition-colors ${
        isOver
          ? "border-primary bg-primary/10 shadow-inner"
          : "border-border bg-card/40"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-surface border border-border flex items-center justify-center text-xs font-bold text-muted-foreground">
            ?
          </div>
          <div>
            <span className="text-xs font-bold text-foreground uppercase tracking-wide font-display">
              Unranked Tray
            </span>
            <span className="text-[11px] text-muted-foreground ml-2">
              ({itemIds.length} {itemIds.length === 1 ? "item" : "items"})
            </span>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground/70 hidden sm:block">
          Drag cards into tiers above to rank. Drag back here to unrank.
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-h-[120px] p-2 bg-surface/20 rounded-md">
        <SortableContext items={itemIds} strategy={rectSortingStrategy}>
          {itemIds.length === 0 ? (
            <div className="w-full py-8 text-center text-xs text-muted-foreground/60 italic flex items-center justify-center gap-2">
              <Sparkles size={14} className="text-primary-text" />
              <span>All titles are currently ranked! Drag any card back here to unrank it.</span>
            </div>
          ) : (
            itemIds.map((id) => {
              const entry = entriesById.get(id);
              if (!entry) return null;
              return (
                <SortableMediaCard
                  key={id}
                  entry={entry}
                  containerId="unranked"
                  tiers={tiers}
                  onMoveToTier={onMoveToTier}
                />
              );
            })
          )}
        </SortableContext>
      </div>
    </div>
  );
}

export function TierBoardEditorModal({
  isOpen,
  onClose,
  collection,
  processedEntries,
  onOpenCustomizeTiers,
  onQuickAssignTier,
  onRefreshCollection,
}: TierBoardEditorModalProps) {
  const tiers: any[] = collection?.defaultRatingSystem?.tiers || [];

  // Build entry lookup map
  const entriesById = useMemo(() => {
    const map = new Map<string, any>();
    for (const e of processedEntries) {
      map.set(e.id, e);
    }
    return map;
  }, [processedEntries]);

  // Group entry IDs by container (tier.id or "unranked")
  const [itemsByContainer, setItemsByContainer] = useState<Record<string, string[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Synchronize itemsByContainer whenever processedEntries or tiers change
  useEffect(() => {
    const nextState: Record<string, string[]> = { unranked: [] };
    for (const t of tiers) {
      nextState[t.id] = [];
    }
    for (const entry of processedEntries) {
      const tierId = entry.ratingStatus?.tier?.id || entry.userRating?.tierId;
      if (tierId && nextState[tierId]) {
        nextState[tierId].push(entry.id);
      } else {
        nextState.unranked.push(entry.id);
      }
    }

    // Default sort unranked items: if TV episodes with season & episode numbers, sort in chronological season/episode order
    nextState.unranked.sort((aId, bId) => {
      const a = entriesById.get(aId)?.mediaItem;
      const b = entriesById.get(bId)?.mediaItem;
      if (a?.seasonNumber != null && b?.seasonNumber != null) {
        if (a.seasonNumber !== b.seasonNumber) {
          return a.seasonNumber - b.seasonNumber;
        }
        if (a.episodeNumber != null && b.episodeNumber != null) {
          return a.episodeNumber - b.episodeNumber;
        }
      }
      return 0;
    });

    setItemsByContainer(nextState);
  }, [processedEntries, collection?.defaultRatingSystem?.tiers, entriesById]);

  // Handle Escape key to close editor modal when no dialog is open
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Sensors: pointer with distance constraint for click tolerance, and keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Helper to find which container an item ID belongs to
  const findContainer = (id: string): string | undefined => {
    if (id in itemsByContainer) return id;
    return Object.keys(itemsByContainer).find((key) =>
      itemsByContainer[key].includes(id)
    );
  };

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    setItemsByContainer((prev) => {
      const activeItems = prev[activeContainer] || [];
      const overItems = prev[overContainer] || [];

      const activeIndex = activeItems.indexOf(active.id as string);
      const overIndex = overItems.indexOf(over.id as string);

      let newIndex: number;
      if (over.id in prev) {
        newIndex = overItems.length;
      } else {
        newIndex = overIndex >= 0 ? overIndex : overItems.length;
      }

      return {
        ...prev,
        [activeContainer]: activeItems.filter((id) => id !== active.id),
        [overContainer]: [
          ...overItems.slice(0, newIndex),
          active.id as string,
          ...overItems.slice(newIndex),
        ],
      };
    });
  };

  const persistReorder = async (newState: Record<string, string[]>) => {
    try {
      // Reconstruct full ordered list of collection entries
      const allOrderedIds: string[] = [];
      for (const t of tiers) {
        if (newState[t.id]) allOrderedIds.push(...newState[t.id]);
      }
      if (newState.unranked) allOrderedIds.push(...newState.unranked);

      if (allOrderedIds.length > 0) {
        await fetch(`/api/collections/${collection.id}/entries`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entries: allOrderedIds.map((id, index) => ({
              id,
              sortOrder: index + 1,
            })),
          }),
        });
      }
    } catch (err) {
      console.error("[Persist Reorder Error]", err);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);

    if (!activeContainer || !overContainer) return;

    let finalState = itemsByContainer;

    if (activeContainer === overContainer) {
      const activeIndex = itemsByContainer[activeContainer].indexOf(active.id as string);
      const overIndex = itemsByContainer[overContainer].indexOf(over.id as string);

      if (activeIndex !== overIndex && activeIndex !== -1 && overIndex !== -1) {
        finalState = {
          ...itemsByContainer,
          [activeContainer]: arrayMove(itemsByContainer[activeContainer], activeIndex, overIndex),
        };
        setItemsByContainer(finalState);
        await persistReorder(finalState);
      }
    }

    // Persist tier assignment if item changed container
    const entry = entriesById.get(active.id as string);
    if (entry) {
      const currentTierId = entry.ratingStatus?.tier?.id || entry.userRating?.tierId || null;
      const targetTierId = overContainer === "unranked" ? null : overContainer;

      if (currentTierId !== targetTierId) {
        setIsSaving(true);
        try {
          await onQuickAssignTier(entry.mediaItem, targetTierId);
          await persistReorder(finalState);
          setLastSaved(new Date().toLocaleTimeString());
        } finally {
          setIsSaving(false);
        }
      }
    }
  };

  // Non-drag programmatic move handler
  const handleMoveToTier = async (entryId: string, targetTierId: string | null) => {
    const entry = entriesById.get(entryId);
    if (!entry) return;

    const sourceContainer = findContainer(entryId);
    const destinationContainer = targetTierId || "unranked";

    if (sourceContainer === destinationContainer) return;

    const nextState: Record<string, string[]> = { ...itemsByContainer };
    if (sourceContainer && nextState[sourceContainer]) {
      nextState[sourceContainer] = nextState[sourceContainer].filter((id) => id !== entryId);
    }
    if (nextState[destinationContainer]) {
      nextState[destinationContainer] = [...nextState[destinationContainer], entryId];
    } else {
      nextState[destinationContainer] = [entryId];
    }
    setItemsByContainer(nextState);

    setIsSaving(true);
    try {
      await onQuickAssignTier(entry.mediaItem, targetTierId);
      await persistReorder(nextState);
      setLastSaved(new Date().toLocaleTimeString());
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const activeEntry = activeId ? entriesById.get(activeId) : null;

  return (
    <div className="fixed inset-0 z-40 bg-black/85 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
      {/* 1. Header Bar */}
      <header className="border-b border-border bg-card/90 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary-text flex items-center justify-center font-bold">
            <Layers size={18} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold font-display uppercase text-foreground flex items-center gap-2">
              <span>Tier Board Editor</span>
              <span className="text-xs px-2 py-0.5 rounded bg-surface border border-border text-muted-foreground font-sans lowercase font-normal">
                drag &amp; sortable
              </span>
            </h2>
            <p className="text-[11px] text-muted-foreground line-clamp-1">
              {collection.title} · Drag posters between tiers or tap the menu to move
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Save status indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground px-2.5 py-1 rounded bg-surface/60 border border-border/60">
            {isSaving ? (
              <>
                <Loader2 size={12} className="animate-spin text-primary" />
                <span>Saving...</span>
              </>
            ) : lastSaved ? (
              <>
                <Check size={12} className="text-emerald-400" />
                <span>Saved {lastSaved}</span>
              </>
            ) : (
              <span>Ready</span>
            )}
          </div>

          {/* Customize Tiers Button */}
          <button
            type="button"
            onClick={onOpenCustomizeTiers}
            className="px-3 py-1.5 rounded-button bg-surface hover:bg-card text-foreground border border-border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Settings2 size={13} />
            <span>Customize Tiers</span>
          </button>

          {/* Done / Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
          >
            <Check size={14} />
            <span>Done</span>
          </button>
        </div>
      </header>

      {/* 2. Drag & Drop Canvas */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-4 max-w-7xl mx-auto w-full">
        <DndContext
          sensors={sensors}
          collisionDetection={customCollisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {/* Tier Rows */}
          <div className="space-y-3">
            {tiers.map((tier) => (
              <DroppableTierRow
                key={tier.id}
                tier={tier}
                itemIds={itemsByContainer[tier.id] || []}
                entriesById={entriesById}
                tiers={tiers}
                onMoveToTier={handleMoveToTier}
                isOver={false}
              />
            ))}
          </div>

          {/* Unranked Tray */}
          <div className="pt-2">
            <DroppableUnrankedTray
              itemIds={itemsByContainer.unranked || []}
              entriesById={entriesById}
              tiers={tiers}
              onMoveToTier={handleMoveToTier}
              isOver={false}
            />
          </div>

          {/* Drag Overlay with custom styling */}
          <DragOverlay dropAnimation={dropAnimationConfig}>
            {activeEntry ? (
              <SortableMediaCard
                entry={activeEntry}
                containerId="overlay"
                tiers={tiers}
                onMoveToTier={() => {}}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
}

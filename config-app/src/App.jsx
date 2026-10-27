import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion } from "motion/react";
import "./App.css";
import TopBar from "./components/TopBar";
import ProfileBar from "./components/ProfileBar";
import Bindblock from "./components/Bindblock";
import { ICONS } from "@/lib/icons";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_PROFILES,
  STORAGE_KEY,
  loadFromLocalStorage,
  persistConfig,
  downloadConfigFile,
  fetchRemoteConfig,
  setupTouchboardService,
} from "./services/configService";


// Generate all 63 active combinations from 000001 to 111111 (excluding 000000)
const ALL_COMBOS = Array.from({ length: 63 }, (_, i) =>
  (i + 1).toString(2).padStart(6, "0")
);

// Dynamic hook to track active columns (4 on desktop, 2 on tablet, 1 on mobile)
function useGridColumns() {
  const [cols, setCols] = useState(() => {
    if (typeof window === "undefined") return 4;
    if (window.innerWidth < 640) return 1;
    if (window.innerWidth < 1024) return 2;
    return 4;
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) setCols(1);
      else if (window.innerWidth < 1024) setCols(2);
      else setCols(4);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return cols;
}

function App() {
  // Profiles state initialized from localStorage, with fallback to DEFAULT_PROFILES
  const [profiles, setProfiles] = useState(() => {
    const { profiles: localProfiles } = loadFromLocalStorage();
    return localProfiles;
  });

  const [activeProfileId, setActiveProfileId] = useState(() => {
    const { activeProfileId: localActiveId } = loadFromLocalStorage();
    return localActiveId;
  });

  const [isSaved, setIsSaved] = useState(true);
  const [expandedCombo, setExpandedCombo] = useState(null);
  const [filterMode, setFilterMode] = useState("all"); // 'all' | 'configured' | 'single' | 'combos'
  const [search, setSearch] = useState("");
  const cols = useGridColumns();

  // Active profile's triggers
  const triggers = useMemo(() => {
    return profiles[activeProfileId]?.triggers || {};
  }, [profiles, activeProfileId]);

  // Sync with remote config file on startup if available
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const remote = await fetchRemoteConfig();
        if (!mounted || !remote) return;

        // If remote config has profiles and localStorage is empty or matches, adopt remote
        if (remote.profiles && Object.keys(remote.profiles).length > 0) {
          const hasLocal = !!localStorage.getItem(STORAGE_KEY);
          if (!hasLocal) {
            let initialActive = Object.keys(remote.profiles)[0];
            if (remote.active_profile) {
              if (remote.profiles[remote.active_profile]) {
                initialActive = remote.active_profile;
              } else {
                const found = Object.keys(remote.profiles).find(
                  (k) => remote.profiles[k].name === remote.active_profile
                );
                if (found) initialActive = found;
              }
            }
            setProfiles(remote.profiles);
            setActiveProfileId(initialActive);
          }
        }
      } catch (err) {
        console.warn("Failed to check remote config:", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Background automation service setup (runs once on first launch)
  useEffect(() => {
    setupTouchboardService()
      .then((res) => {
        if (res?.is_first_run) {
          console.log("[TouchBoard] Initial background service setup completed:", res);
        }
      })
      .catch((err) => {
        console.warn("[TouchBoard] Background service setup check failed:", err);
      });
  }, []);



  // Update a single trigger combo within the active profile
  const handleSave = useCallback((combo, updatedData) => {
    setProfiles((prev) => {
      const currentProfile = prev[activeProfileId] || {
        id: activeProfileId,
        name: "Profile",
        triggers: {},
      };
      const updatedTriggers = {
        ...currentProfile.triggers,
        [combo]: updatedData,
      };
      const next = {
        ...prev,
        [activeProfileId]: {
          ...currentProfile,
          triggers: updatedTriggers,
        },
      };
      setIsSaved(false);
      persistConfig(next, activeProfileId).then(() => setIsSaved(true));
      return next;
    });
  }, [activeProfileId]);

  // Delete a trigger combo from the active profile
  const handleDelete = useCallback((combo) => {
    setProfiles((prev) => {
      const currentProfile = prev[activeProfileId];
      if (!currentProfile) return prev;
      const copyTriggers = { ...currentProfile.triggers };
      delete copyTriggers[combo];
      const next = {
        ...prev,
        [activeProfileId]: {
          ...currentProfile,
          triggers: copyTriggers,
        },
      };
      setIsSaved(false);
      persistConfig(next, activeProfileId).then(() => setIsSaved(true));
      return next;
    });
  }, [activeProfileId]);

  // Drag to switch positions between binding numbers in active profile
  const handleSwapCombos = useCallback((sourceCombo, targetCombo) => {
    if (!sourceCombo || !targetCombo || sourceCombo === targetCombo) return;

    setProfiles((prev) => {
      const currentProfile = prev[activeProfileId];
      if (!currentProfile) return prev;
      const nextTriggers = { ...currentProfile.triggers };
      const sourceData = nextTriggers[sourceCombo];
      const targetData = nextTriggers[targetCombo];

      if (sourceData && targetData) {
        nextTriggers[sourceCombo] = targetData;
        nextTriggers[targetCombo] = sourceData;
      } else if (sourceData && !targetData) {
        nextTriggers[targetCombo] = sourceData;
        delete nextTriggers[sourceCombo];
      } else if (!sourceData && targetData) {
        nextTriggers[sourceCombo] = targetData;
        delete nextTriggers[targetCombo];
      }

      const next = {
        ...prev,
        [activeProfileId]: {
          ...currentProfile,
          triggers: nextTriggers,
        },
      };
      setIsSaved(false);
      persistConfig(next, activeProfileId).then(() => setIsSaved(true));
      return next;
    });
  }, [activeProfileId]);

  // High-performance pointer drag state (no cursor coordinates in React state!)
  const [dragState, setDragState] = useState({
    isDragging: false,
    sourceCombo: null,
    sourceData: null,
    targetCombo: null,
    cardWidth: 0,
    cardHeight: 0,
    initialX: 0,
    initialY: 0,
  });

  const dragOverlayRef = useRef(null);
  const currentTargetRef = useRef(null);
  const rafIdRef = useRef(null);

  const handleCardPointerDown = useCallback((e, combo, bindData, isHandle) => {
    // Only accept left mouse click or primary touch
    if (e.button !== 0) return;

    const isShift = e.shiftKey;
    const canDrag = isHandle || isShift;

    const startX = e.clientX;
    const startY = e.clientY;
    const rect = e.currentTarget.getBoundingClientRect();
    const cardWidth = rect.width;
    const cardHeight = rect.height;

    let hasInitiatedDrag = false;

    const onPointerMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const distance = Math.hypot(dx, dy);

      // Start drag once pointer moves more than 5px while holding Shift or dragging by handle
      if (!hasInitiatedDrag && distance > 5 && (canDrag || moveEvent.shiftKey)) {
        hasInitiatedDrag = true;
        document.body.classList.add("cursor-grabbing");
        currentTargetRef.current = null;

        setDragState({
          isDragging: true,
          sourceCombo: combo,
          sourceData: bindData,
          targetCombo: null,
          cardWidth,
          cardHeight,
          initialX: moveEvent.clientX,
          initialY: moveEvent.clientY,
        });
      }

      if (hasInitiatedDrag) {
        // Direct GPU compositor transform update - zero React re-renders while moving!
        if (dragOverlayRef.current) {
          dragOverlayRef.current.style.transform = `translate3d(${moveEvent.clientX}px, ${moveEvent.clientY}px, 0) translate(-50%, -50%) scale(1.05)`;
        }

        // Throttle hit testing using requestAnimationFrame
        if (!rafIdRef.current) {
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            const elUnderPointer = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
            const cardUnderPointer = elUnderPointer?.closest("[data-combo]");
            const hoveredCombo = cardUnderPointer?.getAttribute("data-combo") || null;
            const newTarget = hoveredCombo && hoveredCombo !== combo ? hoveredCombo : null;

            if (newTarget !== currentTargetRef.current) {
              currentTargetRef.current = newTarget;
              setDragState((prev) => (prev.targetCombo === newTarget ? prev : { ...prev, targetCombo: newTarget }));
            }
          });
        }
      }
    };

    const onPointerUp = (upEvent) => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      document.body.classList.remove("cursor-grabbing");

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      if (hasInitiatedDrag) {
        const finalTarget = currentTargetRef.current;
        if (finalTarget && finalTarget !== combo) {
          handleSwapCombos(combo, finalTarget);
        }

        currentTargetRef.current = null;
        setDragState({
          isDragging: false,
          sourceCombo: null,
          sourceData: null,
          targetCombo: null,
          cardWidth: 0,
          cardHeight: 0,
          initialX: 0,
          initialY: 0,
        });
      } else if (!isHandle && !isShift) {
        // Clean single click -> toggle expand card
        setExpandedCombo((prev) => (prev === combo ? null : combo));
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }, [handleSwapCombos]);

  // Switch active profile
  const handleSelectProfile = (id) => {
    if (id === activeProfileId) return;
    setActiveProfileId(id);
    setIsSaved(false);
    persistConfig(profiles, id).then(() => setIsSaved(true));
  };

  // Create new profile with template selection
  const handleCreateProfile = ({ name, icon, template }) => {
    const id =
      name.toLowerCase().replace(/[^a-z0-9]/g, "-") +
      "-" +
      Date.now().toString().slice(-4);

    let initialTriggers = {};
    if (template === "clone") {
      initialTriggers = { ...(profiles[activeProfileId]?.triggers || {}) };
    } else if (template === "coding") {
      initialTriggers = { ...(DEFAULT_PROFILES.coding?.triggers || {}) };
    } else if (template === "chilling") {
      initialTriggers = { ...(DEFAULT_PROFILES.chilling?.triggers || {}) };
    }

    const newProfile = {
      id,
      name,
      icon: icon || "sparkles",
      triggers: initialTriggers,
    };

    const next = {
      ...profiles,
      [id]: newProfile,
    };

    setProfiles(next);
    setActiveProfileId(id);
    setIsSaved(false);
    persistConfig(next, id).then(() => setIsSaved(true));
  };

  // Rename a profile
  const handleRenameProfile = (id, newName) => {
    setProfiles((prev) => {
      if (!prev[id]) return prev;
      const next = {
        ...prev,
        [id]: {
          ...prev[id],
          name: newName,
        },
      };
      setIsSaved(false);
      persistConfig(next, activeProfileId).then(() => setIsSaved(true));
      return next;
    });
  };

  // Duplicate an existing profile
  const handleDuplicateProfile = (id) => {
    const source = profiles[id];
    if (!source) return;
    const newId = `${id}-copy-${Date.now().toString().slice(-4)}`;
    const newProfile = {
      ...source,
      id: newId,
      name: `${source.name} (Copy)`,
      triggers: { ...(source.triggers || {}) },
    };
    const next = {
      ...profiles,
      [newId]: newProfile,
    };
    setProfiles(next);
    setActiveProfileId(newId);
    setIsSaved(false);
    persistConfig(next, newId).then(() => setIsSaved(true));
  };

  // Delete a profile
  const handleDeleteProfile = (id) => {
    setProfiles((prev) => {
      const keys = Object.keys(prev);
      if (keys.length <= 1) {
        // If deleting the only remaining profile, reset to a fresh clean profile
        const freshId = "profile-" + Date.now().toString().slice(-4);
        const resetProfiles = {
          [freshId]: {
            id: freshId,
            name: "Default Profile",
            icon: "sparkles",
            triggers: {},
          },
        };
        setActiveProfileId(freshId);
        setIsSaved(false);
        persistConfig(resetProfiles, freshId).then(() => setIsSaved(true));
        return resetProfiles;
      }
      const next = { ...prev };
      delete next[id];

      const nextActive =
        activeProfileId === id ? Object.keys(next)[0] : activeProfileId;
      setActiveProfileId(nextActive);
      setIsSaved(false);
      persistConfig(next, nextActive).then(() => setIsSaved(true));
      return next;
    });
  };

  // Clear all triggers in active profile
  const handleClearActiveTriggers = () => {
    setProfiles((prev) => {
      const current = prev[activeProfileId];
      if (!current) return prev;
      const next = {
        ...prev,
        [activeProfileId]: {
          ...current,
          triggers: {},
        },
      };
      setIsSaved(false);
      persistConfig(next, activeProfileId).then(() => setIsSaved(true));
      return next;
    });
  };


  // Import custom config JSON
  const handleImportConfig = (importedJson) => {
    if (!importedJson || typeof importedJson !== "object") return;

    if (importedJson.profiles && Object.keys(importedJson.profiles).length > 0) {
      const nextProfiles = importedJson.profiles;
      const nextActive =
        importedJson.active_profile && nextProfiles[importedJson.active_profile]
          ? importedJson.active_profile
          : Object.keys(nextProfiles)[0];
      setProfiles(nextProfiles);
      setActiveProfileId(nextActive);
      setIsSaved(false);
      persistConfig(nextProfiles, nextActive).then(() => setIsSaved(true));
    } else if (importedJson.triggers) {
      // Legacy single-trigger format: convert to a new profile
      const legacyId = "imported-" + Date.now().toString().slice(-4);
      const nextProfiles = {
        ...profiles,
        [legacyId]: {
          id: legacyId,
          name: "Imported Config",
          icon: "sparkles",
          triggers: importedJson.triggers,
        },
      };
      setProfiles(nextProfiles);
      setActiveProfileId(legacyId);
      setIsSaved(false);
      persistConfig(nextProfiles, legacyId).then(() => setIsSaved(true));
    }
  };

  // Filtered combinations
  const filteredCombos = useMemo(() => {
    return ALL_COMBOS.filter((combo) => {
      const isConfigured = !!triggers[combo];
      const activeBits = (combo.match(/1/g) || []).length;
      const isSingle = activeBits === 1;

      // Filter by category
      if (filterMode === "configured" && !isConfigured) return false;
      if (filterMode === "single" && !isSingle) return false;
      if (filterMode === "combos" && isSingle) return false;

      // Filter by search query
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const matchesCombo = combo.includes(query);
        const actionName = (triggers[combo]?.name || "").toLowerCase();
        const matchesName = actionName.includes(query);
        const actionType = (triggers[combo]?.type || "").toLowerCase();
        const matchesType =
          actionType.includes(query) ||
          (actionType === "type_text" &&
            ("paste function".includes(query) || "auto typer".includes(query)));
        return matchesCombo || matchesName || matchesType;
      }

      return true;
    });
  }, [triggers, filterMode, search]);

  const configuredCount = Object.keys(triggers).length;

  // Custom Row-Squish & Column-Push Layout Calculation
  const layoutData = useMemo(() => {
    const gap = 16;
    const collapsedH = 160;
    const expandedH = 410;
    const numCols = cols;

    const colHeights = Array(numCols).fill(0);
    const items = [];

    const expandedIndex = filteredCombos.indexOf(expandedCombo);
    const expandedRow =
      expandedIndex !== -1 ? Math.floor(expandedIndex / numCols) : -1;
    const expandedCol = expandedIndex !== -1 ? expandedIndex % numCols : -1;

    filteredCombos.forEach((combo, index) => {
      const row = Math.floor(index / numCols);
      const col = index % numCols;
      const isThisExpanded = combo === expandedCombo;

      let widthStyle = "";
      let leftStyle = "";

      if (numCols === 1) {
        widthStyle = "100%";
        leftStyle = "0%";
      } else if (numCols === 2) {
        if (row === expandedRow) {
          if (col === expandedCol) {
            widthStyle = "calc(66% - 8px)";
            leftStyle = col === 0 ? "0%" : "calc(34% + 8px)";
          } else {
            widthStyle = "calc(34% - 8px)";
            leftStyle = col === 0 ? "0%" : "calc(66% + 8px)";
          }
        } else {
          widthStyle = "calc(50% - 8px)";
          leftStyle = col === 0 ? "0%" : "calc(50% + 8px)";
        }
      } else {
        // 4 Columns: In the expanded row, the expanded card widens to ~55% and the other 3 squish to ~13.6% each
        if (row === expandedRow) {
          const squishW = "calc(13.6% - 4px)";
          const expandW = "calc(55% - 4px)";

          if (expandedCol === 0) {
            if (col === 0) {
              leftStyle = "0%";
              widthStyle = expandW;
            } else if (col === 1) {
              leftStyle = "calc(56.5% + 4px)";
              widthStyle = squishW;
            } else if (col === 2) {
              leftStyle = "calc(71% + 8px)";
              widthStyle = squishW;
            } else if (col === 3) {
              leftStyle = "calc(85.5% + 12px)";
              widthStyle = squishW;
            }
          } else if (expandedCol === 1) {
            if (col === 0) {
              leftStyle = "0%";
              widthStyle = squishW;
            } else if (col === 1) {
              leftStyle = "calc(14.5% + 4px)";
              widthStyle = expandW;
            } else if (col === 2) {
              leftStyle = "calc(71% + 8px)";
              widthStyle = squishW;
            } else if (col === 3) {
              leftStyle = "calc(85.5% + 12px)";
              widthStyle = squishW;
            }
          } else if (expandedCol === 2) {
            if (col === 0) {
              leftStyle = "0%";
              widthStyle = squishW;
            } else if (col === 1) {
              leftStyle = "calc(14.5% + 4px)";
              widthStyle = squishW;
            } else if (col === 2) {
              leftStyle = "calc(29% + 8px)";
              widthStyle = expandW;
            } else if (col === 3) {
              leftStyle = "calc(85.5% + 12px)";
              widthStyle = squishW;
            }
          } else {
            // expandedCol === 3
            if (col === 0) {
              leftStyle = "0%";
              widthStyle = squishW;
            } else if (col === 1) {
              leftStyle = "calc(14.5% + 4px)";
              widthStyle = squishW;
            } else if (col === 2) {
              leftStyle = "calc(29% + 8px)";
              widthStyle = squishW;
            } else if (col === 3) {
              leftStyle = "calc(43.5% + 12px)";
              widthStyle = expandW;
            }
          }
        } else {
          // Normal rows: all 4 cards have equal 25% width
          widthStyle = "calc(25% - 12px)";
          if (col === 0) leftStyle = "0%";
          else if (col === 1) leftStyle = "calc(25% + 4px)";
          else if (col === 2) leftStyle = "calc(50% + 8px)";
          else if (col === 3) leftStyle = "calc(75% + 12px)";
        }
      }

      // Column-wise vertical stacking: only the column containing the expanded card is pushed down
      const topPos = colHeights[col];
      const cardH = isThisExpanded ? expandedH : collapsedH;
      colHeights[col] = topPos + cardH + gap;

      items.push({
        combo,
        isExpanded: isThisExpanded,
        style: {
          position: "absolute",
          top: `${topPos}px`,
          left: leftStyle,
          width: widthStyle,
          height: `${cardH}px`,
        },
      });
    });

    const totalHeight = Math.max(...colHeights, 300);
    return { items, totalHeight };
  }, [filteredCombos, expandedCombo, cols]);

  const handleUpload = () => {
    downloadConfigFile(profiles, activeProfileId);
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col bg-white text-black"
      onClick={() => setExpandedCombo(null)}
    >
      {/* Top Navigation Bar */}
      <TopBar onUpload={handleUpload} onImport={handleImportConfig} />

      {/* Main Workspace Container (80% width) */}
      <main className="flex-1 w-[80%] mx-auto py-6 flex flex-col gap-5">
        {/* Trigger Profiles Option Bar with + button in front of them */}
        <div
          className="pb-2 border-b border-neutral-100"
          onClick={(e) => e.stopPropagation()}
        >
          <ProfileBar
            profiles={profiles}
            activeProfileId={activeProfileId}
            onSelectProfile={handleSelectProfile}
            onCreateProfile={handleCreateProfile}
            onRenameProfile={handleRenameProfile}
            onDuplicateProfile={handleDuplicateProfile}
            onDeleteProfile={handleDeleteProfile}
            onClearTriggers={handleClearActiveTriggers}
            isSaved={isSaved}
          />
        </div>

        {/* Filter & Search Bar */}
        <div
          className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-2 border-b border-neutral-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filterMode === "all"
                  ? "bg-black text-white"
                  : "bg-neutral-100 text-neutral-600 hover:text-black hover:bg-neutral-200"
              }`}
            >
              All (63)
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("configured")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filterMode === "configured"
                  ? "bg-black text-white"
                  : "bg-neutral-100 text-neutral-600 hover:text-black hover:bg-neutral-200"
              }`}
            >
              Configured ({configuredCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("single")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filterMode === "single"
                  ? "bg-black text-white"
                  : "bg-neutral-100 text-neutral-600 hover:text-black hover:bg-neutral-200"
              }`}
            >
              Single Touch (6)
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("combos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filterMode === "combos"
                  ? "bg-black text-white"
                  : "bg-neutral-100 text-neutral-600 hover:text-black hover:bg-neutral-200"
              }`}
            >
              Combos (57)
            </button>
          </div>

          {/* Search Input */}
          <div className="w-full sm:w-64">
            <Input
              type="text"
              placeholder="Search binary (e.g. 100000) or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs h-8"
            />
          </div>
        </div>

        {/* 63-Slot Combinations Container: Constant 4 in row (squished) + column-wise push */}
        <div
          className="relative w-full"
          style={{
            height: `${layoutData.totalHeight}px`,
            transition: "height 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
            willChange: "height",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {layoutData.items.map((item, index) => {
            const bindData = triggers[item.combo] || null;

            return (
              <Bindblock
                key={`${activeProfileId}-${item.combo}`}
                combo={item.combo}
                index={index}
                bindData={bindData}
                isExpanded={item.isExpanded}
                style={item.style}
                isDraggingThis={dragState.isDragging && dragState.sourceCombo === item.combo}
                isDropTarget={dragState.isDragging && dragState.targetCombo === item.combo}
                onCardPointerDown={handleCardPointerDown}
                onToggleExpand={(targetCombo) => setExpandedCombo(targetCombo)}
                onSave={handleSave}
                onDelete={handleDelete}
                onSwapCombos={handleSwapCombos}
              />
            );
          })}
        </div>

        {/* High-Performance Hardware-Accelerated Floating Drag Preview */}
        {dragState.isDragging && (
          <div
            ref={dragOverlayRef}
            className="fixed top-0 left-0 pointer-events-none z-50 rounded-2xl border-2 border-black bg-white shadow-2xl flex flex-col items-center justify-center p-4 opacity-95 transition-none"
            style={{
              transform: `translate3d(${dragState.initialX}px, ${dragState.initialY}px, 0) translate(-50%, -50%) scale(1.05)`,
              width: `${dragState.cardWidth || 160}px`,
              height: `${dragState.cardHeight || 120}px`,
              willChange: "transform",
            }}
          >
            <div className="absolute top-2.5 left-3 flex items-center gap-1.5 pointer-events-none">
              <span className="font-mono text-xs text-neutral-500 font-medium">
                {dragState.sourceCombo}
              </span>
              <div className="flex gap-1 items-center">
                {dragState.sourceCombo?.split("").map((bit, bitIdx) => (
                  <span
                    key={bitIdx}
                    className={`w-1.5 h-1.5 rounded-full ${
                      bit === "1" ? "bg-black" : "bg-neutral-300"
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-2 text-center mt-2 pointer-events-none">
              {dragState.sourceData ? (
                <>
                  <img
                    src={
                      ICONS[dragState.sourceData.icon || dragState.sourceData.type]?.src ||
                      ICONS.run_command.src
                    }
                    alt="Trigger Icon"
                    draggable={false}
                    className="w-8 h-8 object-contain"
                  />
                  <span className="text-xs font-semibold text-gray-800 line-clamp-1 max-w-[130px]">
                    {dragState.sourceData.name || `Macro ${dragState.sourceCombo}`}
                  </span>
                </>
              ) : (
                <span className="text-xs text-neutral-400 font-medium">
                  Empty Trigger
                </span>
              )}
            </div>
          </div>
        )}

        {filteredCombos.length === 0 && (
          <div className="text-center py-12 text-neutral-400 text-sm">
            No combinations found matching your filter or search.
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
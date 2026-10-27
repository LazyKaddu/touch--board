import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { FolderOpen, GripVertical } from "lucide-react";

// Assets and Icon mappings
import { ICONS, plusSvg, terminalSvg, linkSvg, appSvg, pasteSvg } from "@/lib/icons";

export const Bindblock = React.memo(({
    combo = "000001",
    index = 0,
    bindData = null,
    isExpanded = false,
    onToggleExpand,
    onSave,
    onDelete,
    onSwapCombos,
    style = {},
    isDraggingThis = false,
    isDropTarget = false,
    onCardPointerDown,
}) => {
    const cardRef = useRef(null);
    const fileInputRef = useRef(null);

    // Form states
    const [name, setName] = useState(bindData?.name || "");
    const [type, setType] = useState(bindData?.type || "run_command");
    const [selectedIcon, setSelectedIcon] = useState(
        bindData?.icon || bindData?.type || "run_command"
    );
    const [command, setCommand] = useState(
        bindData?.payload?.command || bindData?.payload?.urls?.[0] || ""
    );
    const [pressEnter, setPressEnter] = useState(
        bindData?.payload?.press_enter ?? true
    );

    // Track Shift key for Shift+Drag mode cursor hint
    const [isShiftDown, setIsShiftDown] = useState(false);

    // Track Shift key for Shift+Drag mode
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Shift") setIsShiftDown(true);
        };
        const handleKeyUp = (e) => {
            if (e.key === "Shift") setIsShiftDown(false);
        };
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, []);

    // Sync internal state if external bindData changes
    useEffect(() => {
        if (bindData) {
            setName(bindData.name || "");
            setType(bindData.type || "run_command");
            setSelectedIcon(bindData.icon || bindData.type || "run_command");
            setCommand(
                bindData.payload?.command ||
                bindData.payload?.text ||
                (Array.isArray(bindData.payload?.urls) ? bindData.payload.urls[0] : "") ||
                ""
            );
            setPressEnter(bindData.payload?.press_enter ?? true);
        } else {
            setName("");
            setType("run_command");
            setSelectedIcon("run_command");
            setCommand("");
            setPressEnter(true);
        }
    }, [bindData]);

    // When type changes, auto-update the default icon to match the function type
    const handleTypeChange = (newType) => {
        setType(newType);
        setSelectedIcon(newType);
    };

    const [isPickingFile, setIsPickingFile] = useState(false);

    // Helper to auto-fill trigger name from selected file path
    const updateNameFromPath = (fullPath) => {
        if (!fullPath) return;
        if (!name.trim()) {
            const parts = fullPath.split(/[/\\]/);
            const fileName = parts[parts.length - 1] || "";
            const baseName = fileName.replace(/\.[^/.]+$/, "");
            if (baseName) {
                setName(baseName.charAt(0).toUpperCase() + baseName.slice(1));
            }
        }
    };

    // Native file picker that retrieves the whole absolute filesystem location
    const handlePickFile = async () => {
        setIsPickingFile(true);
        try {
            // 1. Try Tauri invoke if running in Tauri desktop shell
            if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
                try {
                    const { invoke } = await import("@tauri-apps/api/core");
                    const fullPath = await invoke("pick_file");
                    if (fullPath) {
                        setCommand(fullPath);
                        updateNameFromPath(fullPath);
                        return;
                    }
                } catch (err) {
                    console.warn("Tauri invoke pick_file failed, falling back to server API", err);
                }
            }

            // 2. Try Vite dev backend API endpoint (triggers system file dialog and returns full path)
            const res = await fetch("/api/pick-file");
            if (res.ok) {
                const data = await res.json();
                if (data.path) {
                    setCommand(data.path);
                    updateNameFromPath(data.path);
                    return;
                }
            }
        } catch (e) {
            console.error("Native file picker failed", e);
        } finally {
            setIsPickingFile(false);
        }

        // 3. Fallback to HTML input file (in case native pickers are blocked)
        fileInputRef.current?.click();
    };

    // Handle HTML file input fallback
    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const filePath = file.path || file.webkitRelativePath || file.name;
        if (filePath) {
            setCommand(filePath);
            updateNameFromPath(filePath);
        }
        e.target.value = "";
    };

    // Click-outside listener: collapse when clicking on empty space or outside
    useEffect(() => {
        if (!isExpanded) return;

        const handleClickOutside = (e) => {
            if (cardRef.current && !cardRef.current.contains(e.target)) {
                onToggleExpand?.(null);
            }
        };

        document.addEventListener("pointerdown", handleClickOutside);
        return () => {
            document.removeEventListener("pointerdown", handleClickOutside);
        };
    }, [isExpanded, onToggleExpand]);

    // Boundary-aware expansion calculation in a 4-column grid
    const colIndex = index % 4; // 0: Left wall, 1: Col 2, 2: Col 3, 3: Right wall
    const expansionClasses = isExpanded
        ? colIndex === 0
            ? "col-span-1 sm:col-span-2 lg:col-span-2 lg:col-start-1" // Left wall: expands right (cols 1-2)
            : colIndex === 3
                ? "col-span-1 sm:col-span-2 lg:col-span-2 lg:col-start-3" // Right wall: expands left (cols 3-4)
                : "col-span-1 sm:col-span-2 lg:col-span-2 lg:col-start-2" // Middle columns: expands to cols 2-3
        : "col-span-1";

    const handleSave = (e) => {
        e.stopPropagation();
        const updatedData = {
            name: name.trim() || `Macro ${combo}`,
            type,
            icon: selectedIcon,
            payload:
                type === "open_url"
                    ? { urls: [command.trim()] }
                    : type === "type_text"
                        ? { text: command, press_enter: pressEnter }
                        : { command: command.trim() },
        };
        onSave?.(combo, updatedData);
        onToggleExpand?.(null);
    };

    const handleDelete = (e) => {
        e.stopPropagation();
        onDelete?.(combo);
        onToggleExpand?.(null);
    };

    // Render the designated icon image
    const renderIconImage = (iconKey, className = "w-8 h-8") => {
        const iconObj = ICONS[iconKey] || ICONS[type] || ICONS.run_command;
        return (
            <img
                src={iconObj.src}
                alt={iconObj.name}
                draggable={false}
                className={`${className} object-contain transition-transform`}
            />
        );
    };

    return (
        <div
            ref={cardRef}
            data-combo={combo}
            style={style}
            onPointerDown={(e) => {
                if (!isExpanded) {
                    onCardPointerDown?.(e, combo, bindData, false);
                }
            }}
            onMouseEnter={(e) => setIsShiftDown(e.shiftKey)}
            onMouseMove={(e) => {
                if (e.shiftKey !== isShiftDown) setIsShiftDown(e.shiftKey);
            }}
            onMouseLeave={() => setIsShiftDown(false)}
            className={`card-geometry-transition transform-gpu rounded-2xl border select-none overflow-hidden ${
                isDraggingThis ? "opacity-30 scale-95 border-dashed border-black" : ""
            } ${
                isDropTarget
                    ? "border-black ring-2 ring-black scale-[1.03] bg-neutral-50 shadow-md z-10"
                    : ""
            } ${
                isExpanded
                    ? "border-black ring-1 ring-black bg-white shadow-none z-20"
                    : `border-neutral-200 bg-white hover:border-black flex items-center justify-center group ${
                        isShiftDown
                            ? "cursor-grab active:cursor-grabbing ring-1 ring-neutral-400"
                            : "cursor-pointer"
                    }`
            }`}
        >
            {/* Visual touch pin dots (a0 - a5) - only rendered in collapsed state */}
            {!isExpanded && (
                <>
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 pointer-events-none">
                        <span className="font-mono text-xs text-neutral-500 font-medium tracking-wide">
                            {combo}
                        </span>
                        <div className="flex gap-1 items-center">
                            {combo.split("").map((bit, bitIdx) => (
                                <span
                                    key={bitIdx}
                                    className={`w-1.5 h-1.5 rounded-full shadow-xs ${
                                        bit === "1" ? "bg-black" : "bg-neutral-300"
                                    }`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Dedicated Grip Handle in top-right */}
                    <div
                        data-drag-handle="true"
                        onPointerDown={(e) => {
                            e.stopPropagation();
                            if (!isExpanded) {
                                onCardPointerDown?.(e, combo, bindData, true);
                            }
                        }}
                        className="absolute top-2.5 right-2.5 p-1 text-neutral-300 hover:text-black hover:bg-neutral-100 rounded-md cursor-grab active:cursor-grabbing transition-colors pointer-events-auto"
                        title="Drag to swap trigger (or Shift+Drag anywhere on card)"
                    >
                        <GripVertical className="w-3.5 h-3.5" />
                    </div>
                </>
            )}

            <AnimatePresence initial={false}>
                {!isExpanded ? (
                    /* COLLAPSED STATE: Only show the centered icon */
                    <motion.div
                        key="collapsed"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="flex flex-col items-center justify-center p-6 w-full h-full pointer-events-none"
                    >
                        {bindData ? (
                            /* Configured: icon and trigger name */
                            <div className="flex flex-col items-center justify-center gap-2 text-center group-hover:scale-105 transition-transform duration-200 px-2 mt-2">
                                {renderIconImage(bindData.icon || bindData.type, "w-8 h-8")}
                                <span className="text-xs font-semibold text-gray-600 tracking-tight line-clamp-1 max-w-[130px]">
                                    {bindData.name || `Macro ${combo}`}
                                </span>
                            </div>
                        ) : (
                            /* Unconfigured: plus icon */
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-neutral-400 group-hover:text-black group-hover:scale-110 transition-all duration-200">
                                <img src={plusSvg} alt="Add Bind" draggable={false} className="w-6 h-6 object-contain" />
                            </div>
                        )}
                    </motion.div>
                ) : (
                    /* EXPANDED STATE: Streamlined, non-clipping configuration panel */
                    <motion.div
                        key="expanded"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="p-5 sm:p-6 flex flex-col justify-between h-full w-full bg-white"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex flex-col gap-4">
                            {/* Header row with integrated combo badge and pin dots */}
                            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-neutral-100 text-black">
                                        <span className="font-mono text-xs font-semibold">{combo}</span>
                                        <div className="flex gap-1 items-center">
                                            {combo.split("").map((bit, bitIdx) => (
                                                <span
                                                    key={bitIdx}
                                                    className={`w-1.5 h-1.5 rounded-full ${bit === "1" ? "bg-black" : "bg-neutral-300"
                                                        }`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <span className="text-xs text-neutral-500 font-medium">
                                        {bindData ? "Edit Bind" : "New Trigger Bind"}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onToggleExpand?.(null)}
                                    className="text-xs text-neutral-400 hover:text-black font-medium transition-colors cursor-pointer"
                                >
                                    ✕ Close
                                </button>
                            </div>

                            {/* Trigger Name Field */}
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor={`name-${combo}`}>Trigger Name</Label>
                                <Input
                                    id={`name-${combo}`}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Open Terminal, Dev Websites, Spotify"
                                    className="text-sm"
                                />
                            </div>

                            {/* Function Type Selector (4 Types, sleek single-line buttons) */}
                            <div className="flex flex-col gap-2">
                                <Label>Action Type</Label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleTypeChange("run_command")}
                                        className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${type === "run_command"
                                            ? "bg-black text-white border-black"
                                            : "bg-white text-black border-neutral-200 hover:border-black"
                                            }`}
                                    >
                                        <img
                                            src={terminalSvg}
                                            alt="Terminal"
                                            className={`w-3.5 h-3.5 shrink-0 ${type === "run_command" ? "invert" : ""
                                                }`}
                                        />
                                        <span className="whitespace-nowrap">Run Command</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleTypeChange("open_url")}
                                        className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${type === "open_url"
                                            ? "bg-black text-white border-black"
                                            : "bg-white text-black border-neutral-200 hover:border-black"
                                            }`}
                                    >
                                        <img
                                            src={linkSvg}
                                            alt="Link"
                                            className={`w-3.5 h-3.5 shrink-0 ${type === "open_url" ? "invert" : ""}`}
                                        />
                                        <span className="whitespace-nowrap">Open Link</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleTypeChange("launch_app")}
                                        className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${type === "launch_app"
                                            ? "bg-black text-white border-black"
                                            : "bg-white text-black border-neutral-200 hover:border-black"
                                            }`}
                                    >
                                        <img
                                            src={appSvg}
                                            alt="App"
                                            className={`w-3.5 h-3.5 shrink-0 ${type === "launch_app" ? "invert" : ""
                                                }`}
                                        />
                                        <span className="whitespace-nowrap">Open App</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleTypeChange("type_text")}
                                        className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${type === "type_text"
                                            ? "bg-black text-white border-black"
                                            : "bg-white text-black border-neutral-200 hover:border-black"
                                            }`}
                                        title="Paste Function Button (Auto-Typer)"
                                    >
                                        <img
                                            src={pasteSvg}
                                            alt="Paste Function"
                                            className={`w-3.5 h-3.5 shrink-0 ${type === "type_text" ? "invert" : ""
                                                }`}
                                        />
                                        <span className="whitespace-nowrap">Paste Function</span>
                                    </button>
                                </div>
                            </div>

                            {/* Dynamic Input based on Action Type */}
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor={`input-${combo}`}>
                                        {type === "run_command" && "Shell Command"}
                                        {type === "open_url" && "Website URL"}
                                        {type === "launch_app" && "Executable File Location"}
                                        {type === "type_text" && "Given Text to Paste (Auto-Typer)"}
                                    </Label>
                                    {type === "launch_app" && (
                                        <span className="text-[11px] text-neutral-400">
                                            Search files & folders or drag file here
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id={`input-${combo}`}
                                        value={command}
                                        onChange={(e) => setCommand(e.target.value)}
                                        onDragOver={(e) => {
                                            if (type === "launch_app") {
                                                e.preventDefault();
                                                e.stopPropagation();
                                            }
                                        }}
                                        onDrop={(e) => {
                                            if (type === "launch_app") {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                const file = e.dataTransfer.files?.[0];
                                                if (file) {
                                                    const path = file.path || file.name;
                                                    setCommand(path);
                                                    if (!name.trim()) {
                                                        const baseName = file.name.replace(/\.[^/.]+$/, "");
                                                        setName(baseName.charAt(0).toUpperCase() + baseName.slice(1));
                                                    }
                                                }
                                            }
                                        }}
                                        placeholder={
                                            type === "run_command"
                                                ? "e.g. brave-browser 'https://youtube.com' or code ."
                                                : type === "open_url"
                                                    ? "e.g. https://github.com"
                                                    : type === "launch_app"
                                                        ? "e.g. /usr/bin/spotify or click Browse"
                                                        : "e.g. MySecretPassword123! (single given value to paste)"
                                        }
                                        className="text-sm font-mono flex-1"
                                    />
                                    {type === "launch_app" && (
                                        <>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleFileSelect}
                                                className="hidden"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={handlePickFile}
                                                disabled={isPickingFile}
                                                className="shrink-0 text-xs gap-1.5 h-9 px-3 border-neutral-300 hover:border-black hover:bg-neutral-50 cursor-pointer font-medium"
                                                title="Search through files and folders to get full location"
                                            >
                                                <FolderOpen className={`w-3.5 h-3.5 ${isPickingFile ? "animate-pulse" : ""}`} />
                                                <span>{isPickingFile ? "Selecting..." : "Browse"}</span>
                                            </Button>
                                        </>
                                    )}
                                </div>
                                {type === "type_text" && (
                                    <div className="flex items-center gap-2 pt-1">
                                        <input
                                            type="checkbox"
                                            id={`enter-${combo}`}
                                            checked={pressEnter}
                                            onChange={(e) => setPressEnter(e.target.checked)}
                                            className="accent-black w-4 h-4 cursor-pointer rounded"
                                        />
                                        <Label htmlFor={`enter-${combo}`} className="text-xs text-neutral-600 cursor-pointer font-normal select-none">
                                            Press Enter automatically after pasting
                                        </Label>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions bottom bar cleanly anchored */}
                        <div className="flex items-center justify-between pt-3 border-t border-neutral-100 mt-2">
                            <div>
                                {bindData && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleDelete}
                                        className="text-xs border-neutral-300 text-neutral-600 hover:bg-black hover:text-white hover:border-black transition-colors cursor-pointer"
                                    >
                                        Clear Bind
                                    </Button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => onToggleExpand?.(null)}
                                    className="text-xs cursor-pointer"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    variant="default"
                                    onClick={handleSave}
                                    className="text-xs cursor-pointer"
                                >
                                    Save Bind
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

export default Bindblock;

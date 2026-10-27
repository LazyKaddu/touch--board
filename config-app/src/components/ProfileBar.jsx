import React, { useState, useRef, useEffect } from "react";
import {
  Plus,
  Code,
  Coffee,
  Sparkles,
  Gamepad2,
  Music,
  MoreVertical,
  Menu,
  Pencil,
  Copy,
  Trash2,
  Trash,
  Check,
  Layers,
  X,
  AlertCircle,
  Eraser,
  Play,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  installTouchboardService,
  uninstallTouchboardService,
  getServiceStatus,
} from "@/services/configService";

// Maps icon name to Lucide component
const PROFILE_ICONS = {
  code: Code,
  coffee: Coffee,
  gamepad: Gamepad2,
  music: Music,
  sparkles: Sparkles,
};

export default function ProfileBar({
  profiles,
  activeProfileId,
  onSelectProfile,
  onCreateProfile,
  onRenameProfile,
  onDuplicateProfile,
  onDeleteProfile,
  onClearTriggers,
  isSaved = true,
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileIcon, setNewProfileIcon] = useState("sparkles");
  const [newProfileTemplate, setNewProfileTemplate] = useState("empty"); // 'empty' | 'clone'

  // Context menu for individual profile (3-dots button)
  const [menuProfileId, setMenuProfileId] = useState(null);

  // Hamburger menu for the entire profiles section
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);

  // Inline rename state
  const [renameProfileId, setRenameProfileId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  // Delete confirmation modal state
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Background service management state
  const [serviceStatus, setServiceStatus] = useState(null);
  const [isUninstallConfirmOpen, setIsUninstallConfirmOpen] = useState(false);
  const [purgeConfig, setPurgeConfig] = useState(false);
  const [serviceModal, setServiceModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    status: "idle", // 'idle' | 'loading' | 'success' | 'error'
    details: "",
  });

  // Query service status when hamburger menu is toggled open
  useEffect(() => {
    if (isSideMenuOpen) {
      getServiceStatus().then((status) => {
        if (status) setServiceStatus(status);
      });
    }
  }, [isSideMenuOpen]);

  const menuRef = useRef(null);
  const sideMenuRef = useRef(null);
  const createInputRef = useRef(null);
  const renameInputRef = useRef(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuProfileId(null);
      }
      if (sideMenuRef.current && !sideMenuRef.current.contains(e.target)) {
        setIsSideMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto focus input when create modal opens
  useEffect(() => {
    if (isCreateOpen) {
      setTimeout(() => createInputRef.current?.focus(), 50);
    }
  }, [isCreateOpen]);

  // Auto focus rename input
  useEffect(() => {
    if (renameProfileId) {
      setTimeout(() => renameInputRef.current?.focus(), 50);
    }
  }, [renameProfileId]);

  const handleStartRename = (id, currentName) => {
    setRenameProfileId(id);
    setRenameValue(currentName);
    setMenuProfileId(null);
    setIsSideMenuOpen(false);
  };

  const handleSaveRename = (id) => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== profiles[id]?.name) {
      onRenameProfile(id, trimmed);
    }
    setRenameProfileId(null);
  };

  const handleCreateSubmit = (e) => {
    e?.preventDefault();
    const name = newProfileName.trim();
    if (!name) return;

    onCreateProfile({
      name,
      icon: newProfileIcon,
      template: newProfileTemplate,
    });

    setNewProfileName("");
    setNewProfileIcon("sparkles");
    setNewProfileTemplate("clone");
    setIsCreateOpen(false);
  };

  const handleTriggerInstall = async () => {
    setIsSideMenuOpen(false);
    setServiceModal({
      isOpen: true,
      title: "Installing Background Service",
      message: "Executing installer script to configure auto-run...",
      status: "loading",
      details: "",
    });

    try {
      const res = await installTouchboardService();
      if (res && res.installed) {
        setServiceStatus("active");
        setServiceModal({
          isOpen: true,
          title: "Service Installed Successfully",
          message:
            res.message ||
            "TouchBoard background engine installed and started successfully.",
          status: "success",
          details: res.output || "",
        });
      } else {
        setServiceModal({
          isOpen: true,
          title: "Installation Failed",
          message: res?.error || "Failed to execute installer script.",
          status: "error",
          details: "",
        });
      }
    } catch (err) {
      setServiceModal({
        isOpen: true,
        title: "Installation Error",
        message: String(err),
        status: "error",
        details: "",
      });
    }
  };

  const handleTriggerUninstallConfirm = async () => {
    setIsUninstallConfirmOpen(false);
    setServiceModal({
      isOpen: true,
      title: "Uninstalling Background Service",
      message:
        "Stopping service and removing systemd auto-run configuration...",
      status: "loading",
      details: "",
    });

    try {
      const res = await uninstallTouchboardService(purgeConfig);
      if (res && res.uninstalled) {
        setServiceStatus("not_installed");
        setServiceModal({
          isOpen: true,
          title: "Service Uninstalled",
          message:
            res.message ||
            "TouchBoard background service successfully uninstalled.",
          status: "success",
          details: res.output || "",
        });
      } else {
        setServiceModal({
          isOpen: true,
          title: "Uninstallation Failed",
          message: res?.error || "Failed to execute uninstaller script.",
          status: "error",
          details: "",
        });
      }
    } catch (err) {
      setServiceModal({
        isOpen: true,
        title: "Uninstallation Error",
        message: String(err),
        status: "error",
        details: "",
      });
    }
  };

  const profileList = Object.values(profiles);
  const activeProfile = profiles[activeProfileId] || profileList[0];

  return (
    <div className="w-full flex flex-col gap-3 py-2">
      {/* Profiles Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left side: Label + "+ button in front of them" + Profile Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Section Indicator */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 uppercase tracking-wider pr-1 select-none">
            <Layers className="w-3.5 h-3.5 text-neutral-400" />
            <span>Profiles:</span>
          </div>

          {/* + Button in FRONT of the profiles to create another config */}
          <button
            type="button"
            id="add-profile-btn"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-neutral-300 hover:border-black bg-white hover:bg-neutral-50 text-xs font-medium text-neutral-800 transition-all cursor-pointer shadow-2xs hover:shadow-xs shrink-0 select-none group"
            title="Create new trigger profile"
          >
            <div className="w-4 h-4 rounded-full bg-neutral-100 group-hover:bg-black group-hover:text-white flex items-center justify-center transition-colors">
              <Plus className="w-3 h-3 text-current" />
            </div>
            <span>New Profile</span>
          </button>

          <div className="w-px h-5 bg-neutral-200 mx-0.5 shrink-0" />

          {/* Profile Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {profileList.map((p) => {
              const isActive = p.id === activeProfileId;
              const IconComp = PROFILE_ICONS[p.icon] || Sparkles;
              const triggerCount = Object.keys(p.triggers || {}).length;
              const isRenaming = renameProfileId === p.id;
              const isMenuOpen = menuProfileId === p.id;

              return (
                <div key={p.id} className="relative flex items-center shrink-0">
                  {isRenaming ? (
                    <div className="flex items-center gap-1 bg-white border border-black rounded-lg px-2 py-1 shadow-xs">
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveRename(p.id);
                          if (e.key === "Escape") setRenameProfileId(null);
                        }}
                        onBlur={() => handleSaveRename(p.id)}
                        className="text-xs font-medium outline-hidden w-28 bg-transparent text-black"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(p.id)}
                        className="text-emerald-600 hover:text-emerald-700 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`group relative flex items-center rounded-lg transition-all ${
                        isActive
                          ? "bg-black text-white shadow-xs"
                          : "bg-neutral-100 text-neutral-700 hover:text-black hover:bg-neutral-200/80"
                      }`}
                    >
                      {/* Main Profile Select Button */}
                      <button
                        type="button"
                        onClick={() => onSelectProfile(p.id)}
                        onDoubleClick={() => handleStartRename(p.id, p.name)}
                        className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 text-xs font-medium cursor-pointer select-none"
                        title={`Switch to ${p.name} profile (${triggerCount} triggers). Double-click to rename.`}
                      >
                        <IconComp
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive ? "text-neutral-200" : "text-neutral-500"
                          }`}
                        />
                        <span className="font-medium tracking-tight whitespace-nowrap">
                          {p.name}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium ${
                            isActive
                              ? "bg-neutral-800 text-neutral-300 border border-neutral-700"
                              : "bg-white text-neutral-600 border border-neutral-200"
                          }`}
                        >
                          {triggerCount}
                        </span>
                      </button>

                      {/* 3-dots Menu Button */}
                      <button
                        type="button"
                        aria-label={`Options for ${p.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuProfileId(isMenuOpen ? null : p.id);
                          setIsSideMenuOpen(false);
                        }}
                        className={`p-1 mr-1 rounded-md transition-all cursor-pointer ${
                          isActive
                            ? "text-neutral-300 hover:bg-neutral-800 hover:text-white"
                            : "text-neutral-500 hover:bg-neutral-300/80 hover:text-black"
                        }`}
                        title="Profile options (Click to open menu)"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {/* 3-dots Profile Dropdown Menu */}
                      <AnimatePresence>
                        {isMenuOpen && (
                          <motion.div
                            ref={menuRef}
                            initial={{ opacity: 0, scale: 0.95, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -4 }}
                            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute top-full left-0 mt-1.5 z-50 w-44 bg-white border border-neutral-200 rounded-lg shadow-xl py-1 text-black select-none transform-gpu origin-top-left"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="px-3 py-1 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-100">
                              {p.name}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleStartRename(p.id, p.name)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 hover:text-black cursor-pointer text-left"
                            >
                              <Pencil className="w-3.5 h-3.5 text-neutral-500" />
                              <span>Rename</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                onDuplicateProfile(p.id);
                                setMenuProfileId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 hover:text-black cursor-pointer text-left"
                            >
                              <Copy className="w-3.5 h-3.5 text-neutral-500" />
                              <span>Duplicate</span>
                            </button>

                            {/* Delete option - ALWAYS available when clicking 3 button */}
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteConfirmId(p.id);
                                setMenuProfileId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer text-left border-t border-neutral-100 mt-1 pt-1.5 font-medium"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              <span>Delete Profile</span>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right side: Persistence Badge & Hamburger Menu on the side of profiles section */}
        <div className="flex items-center gap-2 shrink-0 text-xs text-neutral-500 self-end sm:self-auto">
          {/* Persistence status indicator */}
          <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-200/80 px-2.5 py-1 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[11px] text-neutral-600">
              {isSaved ? "Saved & Persistent" : "Saving..."}
            </span>
          </div>

          {/* Hamburger Menu on the side of profiles section */}
          <div className="relative" ref={sideMenuRef}>
            <button
              type="button"
              id="profiles-hamburger-menu"
              aria-label="Profiles Menu"
              onClick={() => {
                setIsSideMenuOpen(!isSideMenuOpen);
                setMenuProfileId(null);
              }}
              className="flex items-center justify-center w-8 h-8 rounded-lg border border-neutral-200 hover:border-black bg-white hover:bg-neutral-100 text-neutral-700 hover:text-black transition-all cursor-pointer shadow-2xs"
              title="Profiles section options"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Side Hamburger Dropdown */}
            <AnimatePresence>
              {isSideMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 top-full mt-1.5 z-50 w-56 bg-white border border-neutral-200 rounded-xl shadow-xl py-1.5 text-black select-none transform-gpu origin-top-right"
                >
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-100">
                    Profile: {activeProfile?.name}
                  </div>

                  {/* Delete active profile option */}
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmId(activeProfileId);
                      setIsSideMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer text-left font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    <span>Delete "{activeProfile?.name}"</span>
                  </button>

                  <div className="border-t border-neutral-100 my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateOpen(true);
                      setIsSideMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 hover:text-black cursor-pointer text-left"
                  >
                    <Plus className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Create New Profile</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleStartRename(activeProfileId, activeProfile?.name);
                      setIsSideMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 hover:text-black cursor-pointer text-left"
                  >
                    <Pencil className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Rename Active Profile</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onDuplicateProfile(activeProfileId);
                      setIsSideMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 hover:text-black cursor-pointer text-left"
                  >
                    <Copy className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Duplicate Active Profile</span>
                  </button>

                  {onClearTriggers && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Clear all configured triggers from "${activeProfile?.name}"?`
                          )
                        ) {
                          onClearTriggers();
                          setIsSideMenuOpen(false);
                        }
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 hover:text-black cursor-pointer text-left border-t border-neutral-100 mt-1 pt-1.5"
                    >
                      <Eraser className="w-3.5 h-3.5 text-neutral-500" />
                      <span>Clear Profile Triggers</span>
                    </button>
                  )}

                  {/* Background Service Scripts Section */}
                  <div className="border-t border-neutral-100 my-1.5" />

                  <div className="flex items-center justify-between px-3 py-1">
                    <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                      Service Controls
                    </span>
                    {serviceStatus && (
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium ${
                          serviceStatus === "active"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                        }`}
                      >
                        {serviceStatus}
                      </span>
                    )}
                  </div>

                  {/* 1. Install Script Option */}
                  <button
                    type="button"
                    id="menu-install-service-btn"
                    onClick={handleTriggerInstall}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-neutral-800 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer text-left transition-colors font-medium group"
                    title="Run install script to configure TouchBoard background auto-run service"
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
                    <span>Install Service</span>
                  </button>

                  {/* 2. Uninstall Script Option */}
                  <button
                    type="button"
                    id="menu-uninstall-service-btn"
                    onClick={() => {
                      setIsUninstallConfirmOpen(true);
                      setIsSideMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-neutral-800 hover:bg-red-50 hover:text-red-700 cursor-pointer text-left transition-colors font-medium group"
                    title="Run uninstall script to remove background service and auto-run"
                  >
                    <Trash className="w-3.5 h-3.5 text-red-500 group-hover:scale-110 transition-transform" />
                    <span>Uninstall Service</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setDeleteConfirmId(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-sm p-5 text-black transform-gpu"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-50 text-red-600 rounded-lg shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900">
                    Delete Profile "{profiles[deleteConfirmId]?.name}"?
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    This will delete this profile and all of its configured triggers.
                    {profileList.length <= 1 &&
                      " Since this is your only profile, a fresh default profile will be created."}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteConfirmId(null)}
                  className="text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    onDeleteProfile(deleteConfirmId);
                    setDeleteConfirmId(null);
                  }}
                  className="text-xs cursor-pointer bg-red-600 hover:bg-red-700 text-white font-medium"
                >
                  Delete Profile
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create New Profile Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setIsCreateOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-md p-6 text-black transform-gpu"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-neutral-100 rounded-md">
                    <Plus className="w-4 h-4 text-black" />
                  </div>
                  <h2 className="text-sm font-bold tracking-tight">Create Trigger Profile</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="text-neutral-400 hover:text-black transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4 mt-4">
                {/* Profile Name Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-neutral-700">Profile Name</label>
                  <Input
                    ref={createInputRef}
                    type="text"
                    placeholder="e.g. Coding, Chilling, Gaming, Video Editing..."
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    className="text-xs"
                    required
                  />
                </div>

                {/* Profile Icon Picker */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-neutral-700">Icon</label>
                  <div className="flex items-center gap-2">
                    {Object.entries(PROFILE_ICONS).map(([key, Icon]) => {
                      const isSelected = newProfileIcon === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setNewProfileIcon(key)}
                          className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                            isSelected
                              ? "border-black bg-black text-white shadow-xs"
                              : "border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Template Selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-neutral-700">Initial Triggers</label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label
                      className={`flex flex-col p-2.5 rounded-lg border cursor-pointer transition-all ${
                        newProfileTemplate === "empty"
                          ? "border-black bg-neutral-50/80 font-medium"
                          : "border-neutral-200 hover:border-neutral-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="template"
                          checked={newProfileTemplate === "empty"}
                          onChange={() => setNewProfileTemplate("empty")}
                          className="accent-black"
                        />
                        <span className="font-semibold text-neutral-900">Clean Slate</span>
                      </div>
                      <span className="text-[11px] text-neutral-500 mt-1 pl-4">
                        Start fresh with 0 triggers
                      </span>
                    </label>

                    <label
                      className={`flex flex-col p-2.5 rounded-lg border cursor-pointer transition-all ${
                        newProfileTemplate === "clone"
                          ? "border-black bg-neutral-50/80 font-medium"
                          : "border-neutral-200 hover:border-neutral-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="template"
                          checked={newProfileTemplate === "clone"}
                          onChange={() => setNewProfileTemplate("clone")}
                          className="accent-black"
                        />
                        <span className="font-semibold text-neutral-900">Clone Active</span>
                      </div>
                      <span className="text-[11px] text-neutral-500 mt-1 pl-4">
                        Copy triggers from "{activeProfile?.name || "current"}"
                      </span>
                    </label>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreateOpen(false)}
                    className="text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!newProfileName.trim()}
                    className="text-xs cursor-pointer bg-black text-white hover:bg-neutral-800"
                  >
                    Create Profile
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Uninstall Confirmation Modal */}
      <AnimatePresence>
        {isUninstallConfirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setIsUninstallConfirmOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-sm p-5 text-black transform-gpu"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-50 text-red-600 rounded-lg shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900">
                    Uninstall Background Service?
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    This runs the uninstaller script to stop the TouchBoard background engine and disable auto-run on login. Your profile triggers in config.json will remain preserved.
                  </p>
                  <label className="flex items-center gap-2 mt-3 text-xs text-neutral-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={purgeConfig}
                      onChange={(e) => setPurgeConfig(e.target.checked)}
                      className="rounded border-neutral-300 text-black focus:ring-black cursor-pointer"
                    />
                    <span>Also purge config directory</span>
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsUninstallConfirmOpen(false)}
                  className="text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleTriggerUninstallConfirm}
                  className="text-xs cursor-pointer bg-red-600 hover:bg-red-700 text-white font-medium"
                >
                  Uninstall Service
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Service Action Result / Progress Modal */}
      <AnimatePresence>
        {serviceModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => {
              if (serviceModal.status !== "loading") {
                setServiceModal((prev) => ({ ...prev, isOpen: false }));
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-sm p-5 text-black transform-gpu"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    serviceModal.status === "loading"
                      ? "bg-neutral-100 text-black"
                      : serviceModal.status === "success"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-red-50 text-red-600"
                  }`}
                >
                  {serviceModal.status === "loading" && (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  )}
                  {serviceModal.status === "success" && (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                  {serviceModal.status === "error" && (
                    <AlertCircle className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    {serviceModal.title}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 whitespace-pre-wrap break-words">
                    {serviceModal.message}
                  </p>
                  {serviceModal.details && (
                    <pre className="mt-2 p-2 bg-neutral-50 rounded border border-neutral-200 text-[10px] font-mono text-neutral-600 max-h-32 overflow-y-auto">
                      {serviceModal.details}
                    </pre>
                  )}
                </div>
              </div>
              {serviceModal.status !== "loading" && (
                <div className="flex items-center justify-end gap-2 mt-5">
                  <Button
                    size="sm"
                    onClick={() =>
                      setServiceModal((prev) => ({ ...prev, isOpen: false }))
                    }
                    className="text-xs cursor-pointer bg-black text-white hover:bg-neutral-800"
                  >
                    Done
                  </Button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

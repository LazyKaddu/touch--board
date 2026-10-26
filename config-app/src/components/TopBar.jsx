import React, { useRef } from "react";
import { Upload, Download, FolderInput } from "lucide-react";
import { Button } from "@/components/ui/button";

export const TopBar = ({ onUpload, onImport }) => {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        onImport?.(json);
      } catch (err) {
        console.error("Failed to parse config json", err);
        alert("Failed to parse JSON configuration file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <header className="w-[80%] mx-auto text-black py-4 border-b border-neutral-200 flex items-center justify-between select-none">
      {/* Hidden file input for config import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Left side: Black & White Logo & Product Name */}
      <div className="flex items-center gap-3">
        {/* Rectangle with small round corners and 9 dots (one blinking) */}
        <div className="flex items-center justify-center">
          <svg
            className="w-8 h-7 text-black"
            viewBox="0 0 32 26"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="touche-board logo"
          >
            {/* Rectangle with small rounded corners */}
            <rect
              x="1.5"
              y="1.5"
              width="29"
              height="23"
              rx="3.5"
              stroke="#000000"
              strokeWidth="1.8"
              fill="none"
            />

            {/* 9 Dots (3x3 grid) */}
            {/* Row 1 */}
            <circle cx="7.5" cy="6.5" r="1.6" fill="#000000" />
            <circle cx="16" cy="6.5" r="1.6" fill="#000000" />
            <circle cx="24.5" cy="6.5" r="1.6" fill="#000000" />

            {/* Row 2 */}
            <circle cx="7.5" cy="13" r="1.6" fill="#000000" />
            {/* Center dot - blinking black node */}
            <circle
              cx="16"
              cy="13"
              r="2"
              fill="#000000"
              className="animate-blink"
            />
            <circle cx="24.5" cy="13" r="1.6" fill="#000000" />

            {/* Row 3 */}
            <circle cx="7.5" cy="19.5" r="1.6" fill="#000000" />
            <circle cx="16" cy="19.5" r="1.6" fill="#000000" />
            <circle cx="24.5" cy="19.5" r="1.6" fill="#000000" />
          </svg>
        </div>

        {/* Product Name */}
        <div className="flex items-baseline gap-1.5">
          <h1 className="text-xl font-bold tracking-tight font-mono text-black">
            touche-board
          </h1>
          <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
        </div>
      </div>

      {/* Right side: Action Buttons */}
      <div className="flex items-center gap-2">
        <Button
          id="import-btn"
          aria-label="Import Config"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="gap-2 cursor-pointer text-xs h-9 border-neutral-300 hover:border-black"
          title="Import config.json file"
        >
          <FolderInput className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Import</span>
        </Button>

        <Button
          id="upload-btn"
          aria-label="Export Config"
          variant="default"
          onClick={onUpload}
          className="gap-2 cursor-pointer text-xs h-9 bg-black hover:bg-neutral-800 text-white"
          title="Export and download config.json"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </Button>
      </div>
    </header>
  );
};

export default TopBar;

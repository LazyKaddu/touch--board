// SVGs from assets
import terminalSvg from "@/assets/terminal.svg";
import linkSvg from "@/assets/link.svg";
import appSvg from "@/assets/app.svg";
import plusSvg from "@/assets/plus.svg";
import pasteSvg from "@/assets/paste.svg";

export { terminalSvg, linkSvg, appSvg, plusSvg, pasteSvg };

// Available icon mappings
export const ICONS = {
    run_command: {
        id: "run_command",
        name: "Terminal (>_)",
        src: terminalSvg,
    },
    open_url: {
        id: "open_url",
        name: "Web Link",
        src: linkSvg,
    },
    launch_app: {
        id: "launch_app",
        name: "Application",
        src: appSvg,
    },
    type_text: {
        id: "type_text",
        name: "Paste Function",
        src: pasteSvg,
    },
};

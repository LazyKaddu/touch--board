import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import process from "node:process";
import { exec } from "node:child_process";



import fs from "node:fs";

// Native file picker and config persistence plugin
function touchBoardServerPlugin() {
  return {
    name: "vite-plugin-touch-board",
    configureServer(server) {
      server.middlewares.use("/api/pick-file", (req, res) => {
        let cmd = "";
        if (process.platform === "linux") {
          cmd = 'zenity --file-selection --title="Select Application" 2>/dev/null || kdialog --getopenfilename 2>/dev/null';
        } else if (process.platform === "darwin") {
          cmd = `osascript -e 'POSIX path of (choose file with prompt "Select Application")'`;
        } else if (process.platform === "win32") {
          cmd = `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.OpenFileDialog; $d.Title = 'Select Application'; [void]$d.ShowDialog(); Write-Output $d.FileName"`;
        }

        if (!cmd) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ path: "" }));
          return;
        }

        exec(cmd, (err, stdout) => {
          res.setHeader("Content-Type", "application/json");
          if (err || !stdout) {
            res.end(JSON.stringify({ path: "" }));
            return;
          }
          res.end(JSON.stringify({ path: stdout.trim() }));
        });
      });

      // API endpoint to read and persist profiles & triggers directly into touch-board-script/src/config.json
      server.middlewares.use("/api/config", (req, res) => {
        const configPath = path.resolve(import.meta.dirname, "../touch-board-script/src/config.json");


        if (req.method === "GET") {
          try {
            if (fs.existsSync(configPath)) {
              const data = fs.readFileSync(configPath, "utf-8");
              res.setHeader("Content-Type", "application/json");
              res.end(data);
              return;
            }
          } catch (err) {
            console.error("Failed to read config file:", err);
          }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({}));
        } else if (req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", () => {
            try {
              const parsed = JSON.parse(body);
              fs.writeFileSync(configPath, JSON.stringify(parsed, null, 4), "utf-8");
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              console.error("Failed to save config file:", err);
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: String(err) }));
            }
          });
        } else {
          res.statusCode = 405;
          res.end("Method Not Allowed");
        }
      });
    },
  };
}


const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), tailwindcss(), touchBoardServerPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1421,
      }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));

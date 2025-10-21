import React, { useEffect, useRef, useState } from "react";

/** Minimal in-app console overlay.
 *  Hotkeys:
 *    • ` (backtick) — toggle (unless typing in an input/textarea/contentEditable)
 *    • Esc         — close
 */
export default function DevConsole() {
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState("");
  const [output, setOutput] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // focus when opened
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 0); }, [open]);

  // global hotkeys (backtick only)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "`" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // don't toggle if user is typing into a form field/contenteditable
        const t = e.target as HTMLElement | null;
        const editing =
          !!t &&
          (t.tagName === "INPUT" ||
           t.tagName === "TEXTAREA" ||
           (t as any).isContentEditable);
        if (!editing) {
          e.preventDefault();
          setOpen(v => !v);
        }
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // append helper
  const append = (msg: string) =>
    setOutput(prev => [...prev.slice(-200), msg]); // keep last 200 lines

  // NOTE: read CanvasMindApp fresh every run (don’t capture stale undefined)
  const run = async (cmdline: string) => {
    const parts = cmdline.trim().split(/\s+/);
    const cmd = (parts[0] || "").toLowerCase();
    const args = parts.slice(1);

    // dynamic helper for image/file → splat
    async function imagePicker(opts: any = {}) {
      const { imageFileToSplatCloud } = await import(
        "/src/canvasmind/plugins/splats/image-to-splats.ts"
      );
      const pick = document.createElement("input");
      pick.type = "file";
      pick.accept = "image/*,video/*";
      pick.onchange = async () => {
        const f = pick.files?.[0];
        if (!f) return;
        const cloud = await imageFileToSplatCloud(f, {
          size: 0.02,
          scale: 3,
          center: [0, 1, 0],
          sampleStep: 2,
          ...opts
        });
        cloud.layers?.enable?.(1);
        (window as any).__CM_SCENE.add(cloud);
        append(
          `OK  image->splat  count=${cloud.geometry.getAttribute("position")?.count ?? 0}`
        );
      };
      pick.click();
    }

    try {
      // Always fetch the live API object when executing a command
      const app = (window as any).CanvasMindApp;

      switch (cmd) {
        case "help":
          append(`Commands:
  splat.demo [count=20000] [radius=2]
  splat.loadply <url>
  splat.clear
  splat.image                        (file picker)
  skybox <prompt>
  mesh.spawn
  mesh.batch <n>
  clear.scene
  quality <performance|balanced|quality>
  proc.start | proc.stop | proc.regen

Notes:
- Use spaces for arguments (e.g., "splat.demo 30000 2"), not parentheses.`);
          break;

        case "splat.demo": {
          if (!app?.spawnSplatDemo) { append("ERR app not ready"); break; }
          const count = parseInt(args[0] ?? "20000", 10);
          const radius = parseFloat(args[1] ?? "2");
          await app.spawnSplatDemo(count, radius);
          append(`OK  splat.demo count=${count} radius=${radius}`);
          break;
        }

        case "splat.loadply": {
          if (!app?.loadSplatPLY) { append("ERR app not ready"); break; }
          const url = args[0];
          if (!url) { append("ERR usage: splat.loadply <url>"); break; }
          await app.loadSplatPLY(url);
          append(`OK  splat.loadply ${url}`);
          break;
        }

        case "splat.clear":
          if (!app?.clearSplats) { append("ERR app not ready"); break; }
          app.clearSplats(); append("OK  splat.clear"); break;

        case "splat.image":
          await imagePicker(); break;

        case "skybox": {
          if (!app?.applySkybox) { append("ERR app not ready"); break; }
          const prompt = args.join(" ");
          await app.applySkybox(prompt);
          append(`OK  skybox "${prompt}"`);
          break;
        }

        case "mesh.spawn":
          if (!app?.spawnMesh) { append("ERR app not ready"); break; }
          await app.spawnMesh(); append("OK  mesh.spawn"); break;

        case "mesh.batch": {
          if (!app?.batchSpawn) { append("ERR app not ready"); break; }
          const n = parseInt(args[0] ?? "5", 10);
          await app.batchSpawn(n);
          append(`OK  mesh.batch n=${n}`);
          break;
        }

        case "clear.scene":
          if (!app?.clearScene) { append("ERR app not ready"); break; }
          app.clearScene(); append("OK  clear.scene"); break;

        case "quality": {
          if (!app?.setQuality) { append("ERR app not ready"); break; }
          const q = (args[0] ?? "balanced") as "performance"|"balanced"|"quality";
          app.setQuality(q); append(`OK  quality ${q}`); break;
        }

        case "proc.start":
          if (!app?.startProcedural) { append("ERR app not ready"); break; }
          await app.startProcedural(); append("OK  proc.start"); break;

        case "proc.stop":
          if (!app?.stopProcedural) { append("ERR app not ready"); break; }
          app.stopProcedural(); append("OK  proc.stop"); break;

        case "proc.regen":
          window.dispatchEvent(new CustomEvent("proc.regen"));
          append("OK  proc.regen");
          break;

        case "":
          break;

        default:
          append(`ERR unknown command: ${cmd}  (type "help")`);
      }
    } catch (err: any) {
      append(`ERR ${err?.message ?? err}`);
      console.error(err);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const s = line.trim();
    if (!s) return;
    setOutput(prev => [...prev.slice(-200), `> ${s}`]);
    setLine("");
    await run(s);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: open ? "auto" : "none",
        zIndex: 10000,
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
      }}
      aria-hidden={!open}
    >
      {/* dimmer */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: "absolute",
          inset: 0,
          background: open ? "rgba(0,0,0,0.35)" : "transparent",
          transition: "background .15s ease"
        }}
      />
      {/* panel */}
      <div
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          bottom: 20,
          maxWidth: 900,
          margin: "0 auto",
          background: "#0b1220",
          border: "1px solid #1f2a44",
          borderRadius: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,.4)",
          padding: 12,
          color: "#cbd5e1",
          transform: open ? "translateY(0)" : "translateY(12px)",
          opacity: open ? 1 : 0,
          transition: "all .12s ease"
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <strong style={{ color: "#93c5fd" }}>CanvasMind Console</strong>
          <span style={{ opacity: 0.7, fontSize: 12 }}>
            ` to toggle • type <em>help</em>
          </span>
        </div>
        <div
          style={{
            background: "#0a0f18",
            border: "1px solid #162036",
            borderRadius: 8,
            padding: 8,
            height: 180,
            overflow: "auto",
            marginBottom: 8,
            fontSize: 12,
            lineHeight: "18px",
            whiteSpace: "pre-wrap"
          }}
        >
          {output.length === 0 ? (
            <div style={{ opacity: 0.6 }}>Ready.</div>
          ) : (
            output.map((l, i) => <div key={i}>{l}</div>)
          )}
        </div>
        <form onSubmit={onSubmit} style={{ display: "flex", gap: 8 }}>
          <input
            ref={inputRef}
            value={line}
            onChange={e => setLine(e.target.value)}
            placeholder='Type a command… (help)'
            spellCheck={false}
            style={{
              flex: 1,
              background: "#0a0f18",
              border: "1px solid #162036",
              color: "#e2e8f0",
              borderRadius: 8,
              padding: "10px 12px",
              outline: "none"
            }}
          />
          <button
            type="submit"
            style={{
              background: "#2563eb",
              color: "white",
              border: "none",
              padding: "10px 14px",
              borderRadius: 8,
              cursor: "pointer"
            }}
          >
            Run
          </button>
        </form>
      </div>
    </div>
  );
}

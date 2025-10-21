// Optional adapter: if a global/web module is present, we use it; otherwise no-op.
// Expected minimal interface if present:
//   const mod = await loadGS();
//   const handle = await mod.load(url);
//   mod.draw(handle, viewProjMatrix, viewportW, viewportH);
//   mod.dispose(handle);

export type GSHandle = unknown;

export async function tryLoadGS() {
  // If you later add a real lib, set window.GS or dynamic-import it here.
  // Example:
  // const lib = await import(/* @vite-ignore */ "https://.../webgsplat.min.js");
  // return lib.default ?? lib;
  return (window as any).GS ?? null;
}

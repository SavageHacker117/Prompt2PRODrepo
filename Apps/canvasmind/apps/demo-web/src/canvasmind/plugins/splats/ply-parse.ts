// Tiny ASCII PLY parser (positions + colors) for fallback point rendering.
export type PlyPointCloud = { positions: Float32Array; colors?: Uint8Array };

export function parseAsciiPLY(text: string): PlyPointCloud {
  const lines = text.split(/\r?\n/);
  if (!lines[0]?.includes("ply")) throw new Error("Not a PLY file");
  let i = 1, nVerts = 0, inHeader = true;
  let hasColor = false, order: string[] = [];

  while (inHeader && i < lines.length) {
    const L = lines[i++].trim();
    if (L.startsWith("element vertex")) nVerts = parseInt(L.split(/\s+/)[2] || "0", 10);
    else if (L.startsWith("property")) {
      const p = L.split(/\s+/).at(-1)!;
      order.push(p.toLowerCase());
      if (["red","green","blue","alpha"].includes(p.toLowerCase())) hasColor = true;
    } else if (L === "end_header") inHeader = false;
  }

  const pos = new Float32Array(nVerts * 3);
  const col = hasColor ? new Uint8Array(nVerts * 4) : undefined;
  let vi = 0;

  for (let v = 0; v < nVerts && i < lines.length; v++, vi += 3) {
    const vals = lines[i++].trim().split(/\s+/);
    const idxX = order.indexOf("x"), idxY = order.indexOf("y"), idxZ = order.indexOf("z");
    pos[vi+0] = parseFloat(vals[idxX]); pos[vi+1] = parseFloat(vals[idxY]); pos[vi+2] = parseFloat(vals[idxZ]);

    if (col) {
      const ir = order.indexOf("red"), ig = order.indexOf("green"), ib = order.indexOf("blue");
      const ia = order.indexOf("alpha");
      const ci = v * 4;
      col[ci+0] = parseInt(vals[ir] || "255", 10);
      col[ci+1] = parseInt(vals[ig] || "255", 10);
      col[ci+2] = parseInt(vals[ib] || "255", 10);
      col[ci+3] = ia >= 0 ? parseInt(vals[ia], 10) : 255;
    }
  }
  return { positions: pos, colors: col };
}

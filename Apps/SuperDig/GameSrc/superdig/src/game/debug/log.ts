// Super simple in-app log. Import { dlog } and call dlog("message", data)
type Line = { t: number; msg: string };
const buf: Line[] = [];

export function dlog(msg: string, data?: unknown) {
  try { if (data !== undefined) msg += " " + JSON.stringify(data); } catch {}
  buf.push({ t: performance.now(), msg });
  if (buf.length > 200) buf.shift();
}

export function getLog(): Line[] { return buf; }

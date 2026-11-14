// 3D course model (Sketchfab). Independent from GPS, hole positions and scoring.
// To change the model, set NEXT_PUBLIC_COURSE_3D_URL (or edit DEFAULT_MODEL_URL) — no component change needed.

export const DEFAULT_MODEL_URL =
  "https://sketchfab.com/3d-models/president-golf-club-yamoussoukro-619e57981a444a7e975290f6c292dd39";

export type CourseModel = { modelId: string; pageUrl: string; embedUrl: string };

const MODEL_ID_RE = /([0-9a-f]{32})\/?$/i;
const ALLOWED_HOSTS = new Set(["sketchfab.com", "www.sketchfab.com"]);

/** Viewer options we set ourselves; the URL given in config never injects query params. */
const EMBED_PARAMS = "autostart=1&preload=1&ui_hint=2";

/**
 * Parses a Sketchfab model page URL (…/3d-models/<slug>-<32 hex id>) into a safe embed URL.
 * Returns null for anything that isn't https://sketchfab.com — the iframe src is always built
 * from the extracted id, never taken verbatim from configuration.
 */
export function parseSketchfabUrl(input: string | undefined | null): CourseModel | null {
  if (!input) return null;
  let url: URL;
  try { url = new URL(input.trim()); } catch { return null; }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) return null;
  const match = MODEL_ID_RE.exec(url.pathname);
  if (!match) return null;
  const modelId = match[1].toLowerCase();
  return {
    modelId,
    pageUrl: `https://sketchfab.com/3d-models/${url.pathname.split("/").filter(Boolean).pop()}`,
    embedUrl: `https://sketchfab.com/models/${modelId}/embed?${EMBED_PARAMS}`,
  };
}

/** Configured model, or null when unset/invalid (the page then shows a neutral "coming soon" state). */
export function getCourseModel(): CourseModel | null {
  return parseSketchfabUrl(process.env.NEXT_PUBLIC_COURSE_3D_URL || DEFAULT_MODEL_URL);
}

/**
 * Network heuristics. On constrained connections (Save-Data or 2G) the site
 * keeps its full design but sheds the heavy extras: WebGL scenes and ambient
 * videos are skipped, image targets shrink. Nothing visual is lost that a
 * 2G visitor would ever have waited long enough to see.
 */
type NetInfo = { saveData?: boolean; effectiveType?: string };
const conn = (navigator as unknown as { connection?: NetInfo }).connection;

export const saveData = !!conn?.saveData;
export const slowNetwork = saveData || /(^|-)2g$/.test(conn?.effectiveType || "");

/** True → skip three.js scenes and ambient background videos. */
export const liteMode = slowNetwork;

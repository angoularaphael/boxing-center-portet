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
/** True → skip three.js scenes and ambient background videos.
 *
 *  UNIQUEMENT les vraies connexions contraintes (Save-Data / 2G). La coupe
 *  « WebGL désactivé sous 760 px » (ecc5231) est revenue sur ordre d'Eddy
 *  (19/08) : le téléphone doit vivre la MÊME interface que le PC — tunnel,
 *  ring, braises. La vitesse se gagne autrement : les scènes plafonnent
 *  leur pixel ratio à 1,5 sous 760 px, se montent en différé quand leur
 *  section approche, et se rangent dès qu'elle sort de l'écran. */
export const liteMode = slowNetwork;

// Pure equip-requirement math + labels — the "can this attribute gate be met
// with the stats I have available?" decision, and the short human label the
// spend-on-gear menus (merchant shop, Forge preview, Enchanter, a gambler pull)
// use to warn you BEFORE you sink gold or materials into a piece your current
// attributes can't wield. No globals: the game state (an item's requirement and
// the attribute value available to meet it) is passed in, so the decision is
// deterministic and unit-testable.

/**
 * Resolve a piece's attribute gate against the attribute value available to it.
 * @param {{attr:string, need:number}|null} req  the {attr, need} the piece demands, or null if it has no gate
 * @param {number} have  the attribute value available to meet it (base points + other worn pieces' +attrs)
 * @returns {{attr:string, need:number, have:number, ok:boolean}|null} live status, or null when there is no gate
 */
export function equipReqStatus(req, have) {
  if (!req) return null;
  const h = have || 0;
  return { attr: req.attr, need: req.need, have: h, ok: h >= req.need };
}

/**
 * Is this the status of a piece you CAN'T equip with your current stats?
 * @param {{ok:boolean}|null} status  a value from equipReqStatus
 * @returns {boolean} true only when a gate exists and is unmet
 */
export function equipReqUnmet(status) {
  return !!(status && !status.ok);
}

/**
 * Short "can't equip yet" label for a spend menu, or '' when the piece is
 * equippable (or carries no gate). `attrShort` is the display abbreviation of
 * the required attribute (e.g. "MGT"). Phrased as a "yet" so it reads as a
 * grow-into-it caution, not a hard block.
 * @param {{need:number, have:number, ok:boolean}|null} status  a value from equipReqStatus
 * @param {string} attrShort  short label for the required attribute
 * @returns {string}
 */
export function equipReqShort(status, attrShort) {
  if (!equipReqUnmet(status)) return '';
  return `Can't equip yet — needs ${status.need} ${attrShort} (have ${status.have})`;
}

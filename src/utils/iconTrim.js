// Alpha-trim fill math — pure geometry for showing an atlas sprite's OPAQUE box
// (its non-transparent bounding box) scaled to fill a CSS-sized element, ignoring
// the transparent padding baked into the tile. The legacy shell measures the box
// off an offscreen copy of the sheet (_iconTrimBox) and feeds it here; this module
// stays DOM-free so it can be unit-tested.
//
// The element's aspect ratio is set to the box's aspect ratio, so the opaque art
// fills the element exactly with no letterboxing — which lets the background-size
// and background-position collapse to pure ratios that don't depend on the (CSS-
// driven, unknown-at-render-time) pixel size of the element. Derivation: with the
// element aspect equal to the box aspect, the fit scale cancels out of both the
// size and the percentage-position formulas.

// Given the OPAQUE box's absolute atlas pixel coords (x0,y0) + size (w,h) and the
// full atlas dimensions, return the CSS values that make a background-image of the
// atlas show just that box, filling the element:
//   ar     — aspect-ratio "w/h" to stamp on the element
//   bgW/bgH — background-size as a % of the element (atlas is bigger than the box)
//   posX/posY — background-position as a % (0..100), positioning the box's origin
// Guards a degenerate box that spans a full atlas axis (division by zero) to 0.
export function trimFillStyle(x0, y0, w, h, atlasW, atlasH) {
  const dw = atlasW - w, dh = atlasH - h;
  return {
    ar: `${w}/${h}`,
    bgW: w > 0 ? (atlasW / w) * 100 : 100,
    bgH: h > 0 ? (atlasH / h) * 100 : 100,
    posX: dw > 0 ? (x0 / dw) * 100 : 0,
    posY: dh > 0 ? (y0 / dh) * 100 : 0,
  };
}

// Generate a self-contained HTML reference of every decor object the game places
// in the world — each drawn as it renders (anchored bottom-centre on a tile grid),
// with the CURRENT blocking footprint and draw-order marked, so the placement rules
// can be corrected object-by-object. Embeds the decor atlas as a data URI.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { DECOR_INDEX, DECOR_ATLAS } = await import('../src/assets/decorAtlas.js');

// Order + friendly names for the tag sections.
const TAG_ORDER = [
  ['furniture', 'Furniture'], ['barrel', 'Barrels / buckets'], ['chest', 'Chests / crates'],
  ['brazier', 'Braziers / lighting'], ['tree', 'Trees'], ['tree_dead', 'Dead trees'],
  ['tree_pine', 'Pines'], ['bush', 'Bushes'], ['desert', 'Desert scatter'], ['plant', 'Plants / flowers'],
  ['potted', 'Potted plants'], ['rug', 'Rugs / blankets'], ['debris', 'Floor clutter'],
];

const payload = JSON.stringify({ index: DECOR_INDEX, atlas: DECOR_ATLAS, tagOrder: TAG_ORDER });

const html = `<div id="app"></div>
<script id="data" type="application/json">${payload}</script>
<script>
const DATA = JSON.parse(document.getElementById('data').textContent);
const IDX = DATA.index, ATLAS = DATA.atlas, TAG_ORDER = DATA.tagOrder;
// —— replicate the game's current placement rules exactly ——
const SOLID_TAGS = new Set(['furniture','barrel','chest','brazier']);
const isSolid = d => d.ht >= 1.6 || SOLID_TAGS.has(d.tag);
const isTree = d => d.tag==='tree' || d.tag==='tree_dead' || d.tag==='tree_pine';
const isFlat = d => d.ht <= 1.5 || (d.w/32) >= d.ht*0.85;
const isOcc = d => isTree(d) || (isSolid(d) && !isFlat(d));
function footprint(d){
  if (isTree(d)) return [[0,0]];
  const W = Math.max(1, Math.round(d.w/32));
  const H = isFlat(d) ? Math.max(1, Math.round(d.ht)) : 1;
  const left = -(W>>1); const t=[];
  for (let yy=-(H-1); yy<=0; yy++) for (let xx=left; xx<left+W; xx++) t.push([xx,yy]);
  return t;
}
const img = new Image();
img.onload = () => render();
img.src = ATLAS;

function drawCard(d, id){
  const wt = d.w/32, ht = d.h/32;
  const gridW = Math.max(3, Math.ceil(wt)+2), gridH = Math.max(2, Math.ceil(ht)+1);
  const P = 22; // px per tile
  const cv = document.createElement('canvas');
  cv.width = gridW*P; cv.height = gridH*P;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  const anchorCol = gridW>>1, anchorRow = gridH-1; // anchor tile (feet) bottom-centre-ish
  // tile grid
  g.strokeStyle = 'rgba(232,194,103,0.18)';
  for (let c=0;c<=gridW;c++){ g.beginPath(); g.moveTo(c*P+.5,0); g.lineTo(c*P+.5,cv.height); g.stroke(); }
  for (let r=0;r<=gridH;r++){ g.beginPath(); g.moveTo(0,r*P+.5); g.lineTo(cv.width,r*P+.5); g.stroke(); }
  // footprint tiles (relative to anchor)
  const foot = footprint(d), solid = isSolid(d), occ = isOcc(d);
  foot.forEach(([fx,fy]) => {
    const cx = (anchorCol+fx)*P, cy = (anchorRow+fy)*P;
    g.fillStyle = solid ? 'rgba(224,86,86,0.42)' : 'rgba(120,200,120,0.30)';
    g.fillRect(cx,cy,P,P);
  });
  // anchor tile outline
  g.strokeStyle = 'rgba(232,194,103,0.9)'; g.lineWidth=1.5;
  g.strokeRect(anchorCol*P+1, anchorRow*P+1, P-2, P-2);
  // sprite, anchored bottom-centre of the anchor tile
  const dw = wt*P, dh = ht*P;
  const sx = (anchorCol+0.5)*P - dw/2, sy = (anchorRow+1)*P - dh;
  g.drawImage(img, d.dx, d.dy, d.w, d.h, Math.round(sx), Math.round(sy), Math.round(dw), Math.round(dh));
  return { cv, solid, occ, foot };
}

function render(){
  const app = document.getElementById('app');
  let solidN=0, occN=0;
  const groups = TAG_ORDER.map(([tag,label]) => {
    const items = IDX.map((d,i)=>({d,i})).filter(o=>o.d.tag===tag);
    if (!items.length) return '';
    const cards = items.map(({d,i}) => {
      const { cv, solid, occ, foot } = drawCard(d,i);
      if (solid) solidN++; if (occ) occN++;
      const layer = occ ? 'over-you' : 'under-you';
      const layerLabel = occ ? 'over ▸ silhouette' : 'under';
      const block = solid ? (occ ? 'blocks trunk' : 'blocks '+foot.length) : 'walkable';
      const wrap = document.createElement('div'); wrap.className='card';
      wrap.appendChild(cv);
      wrap.insertAdjacentHTML('beforeend',
        '<div class="meta"><span class="id">#'+i+'</span>'
        + '<span class="dim">'+ (Math.round(d.w/32*10)/10)+'×'+d.ht+'t</span></div>'
        + '<div class="tags"><span class="pill '+(solid?'s-block':'s-walk')+'">'+block+'</span>'
        + '<span class="pill '+layer+'">'+layerLabel+'</span></div>');
      return wrap;
    });
    const sec = document.createElement('section');
    sec.innerHTML = '<h2>'+label+' <span class="count">'+items.length+'</span></h2>';
    const grid = document.createElement('div'); grid.className='grid';
    cards.forEach(c=>grid.appendChild(c)); sec.appendChild(grid);
    return sec;
  });
  app.insertAdjacentHTML('beforeend',
    '<header><h1>World objects &mdash; placement reference</h1>'
    + '<p class="lede">Every object the game places, drawn as it renders: anchored on the gold <b>anchor tile</b> over a tile grid. '
    + 'Tinted tiles are its current <b>collision footprint</b> &mdash; <span class="sw block"></span> red = blocking, '
    + '<span class="sw walk"></span> green = walkable. The draw-order pill says whether it currently draws <b>over</b> you '
    + '(silhouette shows through) or <b>under</b> you. Reference any object by its <b>#index</b>.</p>'
    + '<p class="lede stat">'+IDX.length+' objects &nbsp;·&nbsp; '+solidN+' blocking &nbsp;·&nbsp; '+occN+' draw over you (silhouette when you\\'re behind — trees + tall furniture).</p></header>');
  groups.forEach(sec => sec && app.appendChild(sec));
}
</script>
<style>
:root{
  --bg:#17151b; --panel:#211d26; --panel-2:#2a2531; --line:#3a3342;
  --text:#ece7f0; --muted:#a79db4; --gold:#e8c267; --gold-dim:#b9974a;
  --block:#e05656; --walk:#78c878; --over:#5aa8e0;
}
*{box-sizing:border-box}
#app{max-width:1180px;margin:0 auto;padding:28px 20px 80px;color:var(--text);
  font-family:ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.5}
header{border-bottom:1px solid var(--line);padding-bottom:20px;margin-bottom:8px}
h1{font-size:1.9rem;margin:0 0 8px;letter-spacing:-.01em;text-wrap:balance}
.lede{max-width:70ch;color:var(--muted);margin:6px 0}
.lede b{color:var(--text);font-weight:600}
.stat{font-family:ui-monospace,Menlo,monospace;font-size:1.05rem;color:var(--gold)}
.sw{display:inline-block;width:.8em;height:.8em;border-radius:2px;vertical-align:-1px;margin:0 2px}
.sw.block{background:var(--block)} .sw.walk{background:var(--walk)}
h2{font-size:1.15rem;margin:34px 0 12px;padding-top:14px;border-top:1px solid var(--line);
  letter-spacing:.02em;display:flex;align-items:baseline;gap:10px}
h2 .count{font-family:ui-monospace,Menlo,monospace;font-size:.85rem;color:var(--gold-dim);font-weight:400}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px 10px 8px;
  display:flex;flex-direction:column;align-items:center;gap:6px}
.card canvas{image-rendering:pixelated;background:
  repeating-conic-gradient(#1c1a21 0% 25%, #201d26 0% 50%) 50%/16px 16px;border-radius:4px;max-width:100%}
.meta{display:flex;justify-content:space-between;width:100%;font-family:ui-monospace,Menlo,monospace;font-size:.82rem}
.meta .id{color:var(--gold);font-weight:600}
.meta .dim{color:var(--muted);font-variant-numeric:tabular-nums}
.tags{display:flex;flex-wrap:wrap;gap:4px;width:100%}
.pill{font-family:ui-monospace,Menlo,monospace;font-size:.68rem;padding:2px 6px;border-radius:999px;
  border:1px solid transparent;white-space:nowrap}
.pill.s-block{color:#ffd7d7;background:rgba(224,86,86,.16);border-color:rgba(224,86,86,.4)}
.pill.s-walk{color:#d7f0d7;background:rgba(120,200,120,.14);border-color:rgba(120,200,120,.36)}
.pill.over-you{color:#d6ecfb;background:rgba(90,168,224,.16);border-color:rgba(90,168,224,.42)}
.pill.under-you{color:var(--muted);background:rgba(167,157,180,.1);border-color:rgba(167,157,180,.28)}
:root[data-theme="light"]{--bg:#f4f1f7;--panel:#fff;--panel-2:#f0ecf4;--line:#e0d8ea;
  --text:#211d29;--muted:#6a6076;--gold:#9a7420;--gold-dim:#b08a3a}
:root[data-theme="light"] .card canvas{background:repeating-conic-gradient(#eee9f2 0% 25%,#f6f2fa 0% 50%) 50%/16px 16px}
@media(prefers-color-scheme:light){:root:not([data-theme="dark"]){--bg:#f4f1f7;--panel:#fff;--panel-2:#f0ecf4;
  --line:#e0d8ea;--text:#211d29;--muted:#6a6076;--gold:#9a7420;--gold-dim:#b08a3a}}
body{background:var(--bg)}
</style>`;

writeFileSync(join(root, 'scratch-shots/object-reference.html'), html);
console.log('wrote scratch-shots/object-reference.html (' + DECOR_INDEX.length + ' objects)');

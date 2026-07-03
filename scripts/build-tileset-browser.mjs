// Assemble a self-contained artifact that shows every cell of the bundled LPC
// terrain atlas, in id order, in sheets — with the atlas embedded inline.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(__dirname, '../src/legacy/game.js'), 'utf8');
const b64 = src.match(/lpcSheet\.src = "data:image\/png;base64,([^"]+)"/)[1];
const used = JSON.parse(readFileSync(resolve(__dirname, '../scratch-shots/used-ids.json'), 'utf8'));

const html = `<title>LPC Terrain Atlas — every tile</title>
<style>
  :root{--bg:#141019;--panel:#1d1826;--raised:#261f31;--border:#392f47;--text:#ece6f2;--muted:#a99fbb;--gold:#e8c267;
    --used:#5ac878;--art:#e8823c;--empty:#4a4356;--mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;
    --sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--shadow:0 2px 0 rgba(0,0,0,.5),0 18px 40px -24px rgba(0,0,0,.9);}
  :root[data-theme="light"]{--bg:#efe9f2;--panel:#fbf8ff;--raised:#fff;--border:#ddd3ea;--text:#231b30;--muted:#6b6280;--gold:#a9781c;--empty:#ccc4d8;--shadow:0 1px 0 rgba(0,0,0,.04),0 14px 34px -22px rgba(50,30,70,.4);}
  @media(prefers-color-scheme:light){:root:not([data-theme="dark"]){--bg:#efe9f2;--panel:#fbf8ff;--raised:#fff;--border:#ddd3ea;--text:#231b30;--muted:#6b6280;--gold:#a9781c;--empty:#ccc4d8;--shadow:0 1px 0 rgba(0,0,0,.04),0 14px 34px -22px rgba(50,30,70,.4);}}
  *{box-sizing:border-box;}
  body{margin:0;background:var(--bg);color:var(--text);font-family:var(--sans);line-height:1.55;-webkit-font-smoothing:antialiased;}
  .wrap{max-width:1180px;margin:0 auto;padding:clamp(1.3rem,4vw,2.6rem) clamp(1rem,3vw,1.6rem) 4rem;}
  .eyebrow{font-family:var(--mono);font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin:0 0 .6rem;}
  h1{font-family:var(--mono);font-weight:700;font-size:clamp(1.6rem,4vw,2.3rem);margin:0 0 .5rem;letter-spacing:-.01em;}
  .lede{color:var(--muted);max-width:70ch;margin:0 0 1.3rem;}
  .bar{position:sticky;top:0;z-index:5;display:flex;gap:.8rem 1.2rem;flex-wrap:wrap;align-items:center;
    background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:.7rem 1rem;box-shadow:var(--shadow);margin-bottom:1.4rem;}
  .stat{font-family:var(--mono);font-size:.82rem;color:var(--muted);}
  .stat b{color:var(--text);}
  .legend{display:flex;gap:.9rem;flex-wrap:wrap;font-family:var(--mono);font-size:.76rem;margin-left:auto;}
  .legend span{display:inline-flex;align-items:center;gap:.35rem;color:var(--muted);}
  .legend i{width:.85rem;height:.85rem;border-radius:3px;border:2px solid;}
  .filters{display:flex;gap:.4rem;flex-wrap:wrap;width:100%;}
  button.f{font-family:var(--mono);font-size:.78rem;color:var(--muted);background:transparent;border:1px solid var(--border);
    border-radius:7px;padding:.4rem .75rem;cursor:pointer;transition:all .12s;}
  button.f:hover{color:var(--text);border-color:var(--muted);}
  button.f.on{color:var(--bg);background:var(--gold);border-color:var(--gold);font-weight:600;}
  button.f:focus-visible{outline:2px solid var(--gold);outline-offset:2px;}
  .sheet{margin:0 0 1.6rem;}
  .sheet h2{font-family:var(--mono);font-size:.9rem;letter-spacing:.02em;color:var(--muted);margin:0 0 .6rem;padding-bottom:.4rem;border-bottom:1px solid var(--border);}
  .sheet h2 b{color:var(--text);}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(66px,1fr));gap:.5rem;}
  .cell{display:flex;flex-direction:column;align-items:center;gap:.2rem;}
  .cell canvas{width:100%;max-width:64px;aspect-ratio:1;image-rendering:pixelated;border-radius:4px;border:2px solid var(--empty);background:#0c0910;}
  .cell.used canvas{border-color:var(--used);}
  .cell.art canvas{border-color:var(--art);}
  .cell .id{font-family:var(--mono);font-size:.66rem;color:var(--muted);}
  .empty-note{color:var(--muted);font-size:.85rem;font-style:italic;}
</style>
<div class="wrap">
  <p class="eyebrow">Dungeon Loot · bundled LPC terrain atlas</p>
  <h1>Every tile in the atlas</h1>
  <p class="lede">All <b id="total">2048</b> cells of the 32&times;64 sheet we ship, in id order, in sheets. Border colour marks status. Use the filters to isolate what's usable but unused.</p>
  <div class="bar">
    <div class="filters">
      <button class="f on" data-f="all">All cells</button>
      <button class="f" data-f="art">Has art</button>
      <button class="f" data-f="unused">Unused art only</button>
      <button class="f" data-f="used">Used by us</button>
    </div>
    <span class="stat"><b id="s-art">0</b> art · <b id="s-used">0</b> used · <b id="s-unused">0</b> unused</span>
    <div class="legend">
      <span><i style="border-color:var(--used)"></i>used</span>
      <span><i style="border-color:var(--art)"></i>unused art</span>
      <span><i style="border-color:var(--empty)"></i>empty</span>
    </div>
  </div>
  <div id="sheets"></div>
</div>
<script>
const ATLAS="data:image/png;base64,${b64}";
const USED=new Set(${JSON.stringify(used)});
const PER=48;
(async function(){
  const img=new Image(); img.src=ATLAS; await img.decode();
  const W=img.width,H=img.height,ACOLS=W/32,AROWS=H/32,TOTAL=ACOLS*AROWS;
  document.getElementById('total').textContent=TOTAL;
  // classify art vs empty from pixels
  const oc=document.createElement('canvas');oc.width=W;oc.height=H;
  const octx=oc.getContext('2d');octx.drawImage(img,0,0);
  const data=octx.getImageData(0,0,W,H).data;
  function hasArt(id){const cx=(id%ACOLS)*32,cy=((id/ACOLS)|0)*32;let op=0,sr=0,sg=0,sb=0;
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=((cy+y)*W+(cx+x))*4;if(data[i+3]>24){op++;sr+=data[i];sg+=data[i+1];sb+=data[i+2];}}
    if(op<40)return false;const mr=sr/op,mg=sg/op,mb=sb/op;let v=0;
    for(let y=0;y<32;y+=2)for(let x=0;x<32;x+=2){const i=((cy+y)*W+(cx+x))*4;if(data[i+3]>24)v+=Math.abs(data[i]-mr)+Math.abs(data[i+1]-mg)+Math.abs(data[i+2]-mb);}
    return v/256>3;}
  const status=new Array(TOTAL);let nArt=0,nUsed=0,nUnused=0;
  for(let id=0;id<TOTAL;id++){const art=hasArt(id),u=USED.has(id);
    status[id]=u?'used':art?'art':'empty';
    if(art)nArt++; if(u)nUsed++; if(art&&!u)nUnused++;}
  document.getElementById('s-art').textContent=nArt;
  document.getElementById('s-used').textContent=nUsed;
  document.getElementById('s-unused').textContent=nUnused;

  const sheetsEl=document.getElementById('sheets');
  function tileCanvas(id){const c=document.createElement('canvas');c.width=32;c.height=32;const g=c.getContext('2d');
    g.imageSmoothingEnabled=false;g.drawImage(img,(id%ACOLS)*32,((id/ACOLS)|0)*32,32,32,0,0,32,32);return c;}
  function match(id,f){const s=status[id];
    if(f==='all')return true; if(f==='art')return s!=='empty'; if(f==='used')return s==='used'; if(f==='unused')return s==='art';}
  function render(f){
    sheetsEl.innerHTML='';
    const ids=[];for(let id=0;id<TOTAL;id++)if(match(id,f))ids.push(id);
    if(!ids.length){sheetsEl.innerHTML='<p class="empty-note">No cells match.</p>';return;}
    for(let s=0;s<ids.length;s+=PER){
      const chunk=ids.slice(s,s+PER);
      const sheet=document.createElement('div');sheet.className='sheet';
      const h=document.createElement('h2');
      h.innerHTML='<b>Sheet '+(s/PER+1)+'</b> · '+chunk.length+' cells · ids '+chunk[0]+'–'+chunk[chunk.length-1];
      sheet.appendChild(h);
      const grid=document.createElement('div');grid.className='grid';
      for(const id of chunk){
        const cell=document.createElement('div');cell.className='cell '+status[id];
        cell.appendChild(tileCanvas(id));
        const lab=document.createElement('div');lab.className='id';lab.textContent=id;cell.appendChild(lab);
        grid.appendChild(cell);
      }
      sheet.appendChild(grid);sheetsEl.appendChild(sheet);
    }
  }
  document.querySelectorAll('button.f').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('button.f').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');render(b.dataset.f);
  }));
  render('all');
})();
</script>`;

writeFileSync(resolve(__dirname, '../scratch-shots/tileset-browser.html'), html);
console.log('wrote scratch-shots/tileset-browser.html (' + (html.length / 1024 | 0) + ' KB)');

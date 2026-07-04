// Mobile-resize smoke test — boots the REAL game in a touch Chromium at several
// viewport sizes (including deliberately NON-STANDARD foldable dimensions) and
// asserts the menus reflow to fit and the touch chrome stays reachable:
//   A) narrow foldable cover (344x882): the town hub is ONE column, has no
//      horizontal overflow, and the Settings/Bag utility strip floats ABOVE the
//      full-screen town sheet so it stays tappable (the strip lives inside
//      #touch-hud, a stacking context, so the HUD LAYER must outrank the sheet).
//   B) wide near-square unfolded foldable (880x820, orientation:landscape): the
//      "rotate your device" notice does NOT fire — a big wide-but-tall screen is
//      playable, only a genuinely SHORT landscape viewport is blocked.
//   C) real phone in landscape (780x360): the rotate notice DOES fire and play is
//      frozen (rtPaused) — the portrait-only guard is intact.
//   D) wide portrait (820x900): the town menu fans out to multiple columns.
// The mouse-only smoke.mjs never enters the touch layer, so this is the guard
// that the mobile menus keep resizing to any screen.
//
// Usage: node test/smoke/mobile-resize.mjs [path-to-html]   (default ./index.html)
import { chromium } from 'playwright';
import { existsSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, extname, basename } from 'node:path';
import http from 'node:http';

const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml','.map':'application/json' };
function startServer(rootDir){ const s=http.createServer((req,res)=>{ const u=decodeURIComponent((req.url||'/').split('?')[0]); const f=join(rootDir,u==='/'?'index.html':u); if(!f.startsWith(rootDir)){res.statusCode=403;return res.end();} if(!existsSync(f)){res.statusCode=404;return res.end('nf');} res.setHeader('Content-Type',MIME[extname(f)]||'application/octet-stream'); createReadStream(f).pipe(res); }); return new Promise(r=>s.listen(0,'127.0.0.1',()=>r(s))); }
function findExecutable(){ for(const c of [process.env.CHROMIUM_PATH,'/opt/pw-browsers/chromium'].filter(Boolean)) if(existsSync(c)) return c; return undefined; }

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : resolve(__dirname, '../../index.html');
if (!existsSync(target)) { console.error(`mobile-resize: target not found: ${target}`); process.exit(2); }

const fails = [];
const ok = (c,m)=> c ? console.log('  ok  '+m) : (fails.push(m), console.log('  FAIL '+m));

// Boot a live floor, reveal the touch layer with a real touch pointer, and
// optionally warp into the town hub.
async function boot(page, { toTown }) {
  await page.goto(page._url, { waitUntil:'load', timeout:30000 });
  await page.waitForFunction(()=>typeof window.gameState==='function',{timeout:20000});
  await page.waitForTimeout(300);
  await page.evaluate(()=>{ window.player.name=window.player.name||'ResizeTest'; window.chooseClass(window.player.class||'warrior'); window.enterDungeonAt(1,1); if(window.closeTitle) window.closeTitle(); });
  await page.waitForFunction(()=>window.gameState&&window.gameState().canMove===true,{timeout:5000}).catch(()=>{});
  await page.evaluate(()=>{ const c=document.getElementById('canvas'); const r=c.getBoundingClientRect(); const x=r.left+r.width*0.3,y=r.top+r.height*0.6; for(const t of ['pointerdown','pointerup']) c.dispatchEvent(new PointerEvent(t,{pointerId:1,pointerType:'touch',clientX:x,clientY:y,button:0,bubbles:true,cancelable:true})); });
  await page.waitForTimeout(200);
  if (toTown) {
    await page.evaluate(()=>{ (window.warpToTown||window.enterTown||function(){})(); if(window.openTownHub) window.openTownHub(); });
    await page.waitForFunction(()=>document.getElementById('town-overlay')&&document.getElementById('town-overlay').classList.contains('open'),{timeout:5000}).catch(()=>{});
    await page.waitForTimeout(200);
  }
}

async function main(){
  const server = await startServer(dirname(target));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/${basename(target)}`;
  const opts = { headless:true, args:['--no-sandbox','--disable-gpu'] }; const e=findExecutable(); if(e) opts.executablePath=e;
  const browser = await chromium.launch(opts);
  try {
    // ── A) narrow foldable cover — town hub is one scrollable column, utilities reachable ──
    console.log('A) narrow foldable cover 344x882 (touch) — town hub');
    let page = await browser.newPage({ viewport:{width:344,height:882}, hasTouch:true, isMobile:true }); page._url=url;
    page.on('pageerror',err=>fails.push('pageerror: '+err));
    await boot(page,{toTown:true});
    const a = await page.evaluate(()=>{
      const tm=document.querySelector('.town-menu'); const tc=document.getElementById('town-content'); const tb=document.getElementById('touch-topbar');
      const cols=tm?getComputedStyle(tm).gridTemplateColumns.trim().split(/\s+/).length:0;
      const hudz=+getComputedStyle(document.getElementById('touch-hud')).zIndex||0;
      const ovz=+getComputedStyle(document.getElementById('town-overlay')).zIndex||0;
      let hit=null; const btn=document.getElementById('tb-menu'); const anchor=btn||tb;
      if(anchor){ const r=anchor.getBoundingClientRect(); const el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); hit=el?(anchor.contains(el)||el===anchor||(tb&&tb.contains(el))):false; }
      return { open:document.getElementById('town-overlay').classList.contains('open'), cols,
               docOverflow: document.documentElement.scrollWidth-window.innerWidth,
               contentOverflow: tc?tc.scrollWidth-tc.clientWidth:999, hudz, ovz, hit,
               bodyTouch: document.body.classList.contains('touch') };
    });
    ok(a.bodyTouch, 'body.touch active');
    ok(a.open, 'town overlay open');
    ok(a.cols===1, `town-menu is ONE column (got ${a.cols})`);
    ok(a.docOverflow<=1, `no page horizontal overflow (${a.docOverflow}px)`);
    ok(a.contentOverflow<=1, `town-content no horizontal clip (${a.contentOverflow}px)`);
    ok(a.hudz>a.ovz, `touch-hud layer z-index (${a.hudz}) above town sheet (${a.ovz})`);
    ok(a.hit===true, 'Settings/Bag strip is the top element at a button (tappable)');
    await page.close();

    // ── B) wide near-square unfolded foldable — no false rotate ──
    console.log('B) unfolded foldable 880x820 (touch, landscape) — no false rotate');
    page = await browser.newPage({ viewport:{width:880,height:820}, hasTouch:true, isMobile:true }); page._url=url;
    await boot(page,{toTown:false});
    const b = await page.evaluate(()=>({
      rotate: getComputedStyle(document.getElementById('rotate-notice')).display,
      mqLandscape: matchMedia('(orientation: landscape)').matches,
      mqBlock: matchMedia('(orientation: landscape) and (max-height: 600px)').matches,
    }));
    ok(b.mqLandscape===true, 'viewport reads as orientation:landscape (width>height)');
    ok(b.mqBlock===false, 'block media query does NOT match (tall enough)');
    ok(b.rotate==='none', `rotate notice hidden (display=${b.rotate})`);
    await page.close();

    // ── C) real phone landscape — guard intact ──
    console.log('C) phone landscape 780x360 (touch) — rotate notice still fires');
    page = await browser.newPage({ viewport:{width:780,height:360}, hasTouch:true, isMobile:true }); page._url=url;
    await boot(page,{toTown:false});
    const c = await page.evaluate(()=>({
      rotate: getComputedStyle(document.getElementById('rotate-notice')).display,
      rtPaused: typeof window.rtPaused==='function' ? window.rtPaused() : null,
      mqBlock: matchMedia('(orientation: landscape) and (max-height: 600px)').matches,
    }));
    ok(c.rotate!=='none', `rotate notice shown on a real phone-in-landscape (display=${c.rotate})`);
    ok(c.mqBlock===true, 'block media query matches on a short landscape viewport');
    ok(c.rtPaused!==false, `play frozen behind the notice (rtPaused=${c.rtPaused})`);
    await page.close();

    // ── D) wide portrait — town fans out ──
    console.log('D) wide portrait 820x900 (touch) — town fans to multiple columns');
    page = await browser.newPage({ viewport:{width:820,height:900}, hasTouch:true, isMobile:true }); page._url=url;
    await boot(page,{toTown:true});
    const d = await page.evaluate(()=>{ const tm=document.querySelector('.town-menu'); return { cols: tm?getComputedStyle(tm).gridTemplateColumns.trim().split(/\s+/).length:0, docOverflow: document.documentElement.scrollWidth-window.innerWidth }; });
    ok(d.cols>=2, `town-menu fans out (>=2 columns, got ${d.cols})`);
    ok(d.docOverflow<=1, `no overflow on wide screen (${d.docOverflow}px)`);
    await page.close();
  } finally {
    await browser.close(); server.close();
  }

  if (fails.length){ console.log(`\nmobile-resize: FAIL — ${fails.length} issue(s) — ${target}`); process.exit(1); }
  console.log(`\nmobile-resize: PASS — ${target}`); process.exit(0);
}
main().catch(e=>{ console.error(e); process.exit(2); });

'use strict';
/*
 * End-to-end play-through in real Chrome, with real keys and clicks: pick up a delivery box, stock a
 * fixture, walk into a potted palm (collision), work till 1 with Space and the real cash drawer until
 * a cash sale completes and the receipt prints, open the Grow panel and change the FOV. Needs playwright.
 *   MM_SAVE=off MM_DEMO=1 MM_DAY=900 node server.js 8099 &
 *   PORT=8099 node test/play.js [screenshot-dir]
 */
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/npm-tools/node_modules/playwright'); }
const { chromium } = pw;
const out = process.argv[2];
let pass = 0, fail = 0;
const check = (l, c, x = '') => { console.log(`${c ? ' PASS' : ' FAIL'}  ${l}${x ? '  (' + x + ')' : ''}`); c ? pass++ : fail++; };
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript(() => localStorage.setItem('mm.quality', '"low"'));
  await p.goto(`http://127.0.0.1:${process.env.PORT || 8099}/?name=Tester`);
  await p.waitForFunction(() => window.__mm && __mm.state && __mm.scene && !document.getElementById('game').classList.contains('hidden'), null, { timeout: 300000 });
  const wait = ms => p.waitForTimeout(ms);
  const S = () => p.evaluate(() => __mm.state);
  const until = (fn, arg, ms = 20000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => false);
  const at = (x, y) => until(([x, y]) => { const m = __mm.state.pl.find(q => q.id === __mm.myId); return Math.hypot(m.x - x, m.y - y) < 0.05; }, [x, y]);
  const me = () => p.evaluate(() => __mm.state.pl.find(x => x.id === __mm.myId));
  const tp = (x, y, yaw, pitch = -0.25) => p.evaluate(([x, y, yaw, pitch]) => { __mm.send({ t: 'tp', x, y }); __mm.look(yaw, pitch); }, [x, y, yaw, pitch]);
  const faceYaw = (dx, dy) => Math.atan2(-dx, -dy);
  await p.evaluate(() => { document.getElementById('clickHint').style.display = 'none'; });
  await wait(3000);   // let the first frames render (software GPU here)

  // ---- stocking: pick a delivery box up and put it on a matching fixture
  let st = await S();
  const box = st.bx.find(x => x.l !== 0);
  await tp(box.x + 0.9, box.y, faceYaw(-0.9, 0)); await at(box.x + 0.9, box.y);
  await until(() => __mm.state.prompt && /Pick up/.test(__mm.state.prompt.label));
  await p.keyboard.press('e');
  await until(() => __mm.state.pl.find(q => q.id === __mm.myId).b >= 0);
  let m = await me();
  check('E picks up the box in front of you', m.b >= 0, `holding ${m.b}`);
  box.p = m.b;
  const world = await p.evaluate(() => ({ fixtures: __mm.world.fixtures, products: __mm.world.products }));
  const kindFix = { dry: 'shelf', chilled: 'fridge', frozen: 'freezer', produce: 'produce' }[world.products[box.p].kind];
  st = await S();
  const fx = world.fixtures.find(f => f.kind === kindFix && f.lvl <= st.lvl && (st.sh[f.id][0] === -1 || st.sh[f.id][1] === 0 || (st.sh[f.id][0] === box.p && st.sh[f.id][2] !== 0)));
  const before = st.sh[fx.id][0] === box.p ? st.sh[fx.id][1] : 0;
  await tp(fx.cx, fx.cy + 1.3, 0); await at(fx.cx, fx.cy + 1.3);
  await until(() => __mm.state.prompt && /^Stock/.test(__mm.state.prompt.label));
  const prompt = await p.textContent('#prompt');
  await p.keyboard.press('e');
  await until(([id, b]) => __mm.state.sh[id][1] > b, [fx.id, before]);
  st = await S();
  check('E stocks the fixture you face', st.sh[fx.id][0] === box.p && st.sh[fx.id][1] > before, `${prompt.trim()} -> ${st.sh[fx.id][1]}`);
  if ((await me()).b >= 0) { await p.keyboard.press('q'); await wait(400); }

  // ---- physics: walk straight into the entrance palm
  const props = await p.evaluate(() => __mm.world.props);
  const palm = props.find(q => q.k === 'palm');
  await tp(palm.x, palm.y - 2.0, 0, 0); await at(palm.x, palm.y - 2.0);
  await p.evaluate(() => __mm.look(Math.PI, 0));          // face +y (south) toward the palm
  await p.keyboard.down('w'); await wait(4000); await p.keyboard.up('w');
  await until(() => { const m = __mm.state.pl.find(q => q.id === __mm.myId); return !m.m && Math.hypot(__mm.me.x - m.x, __mm.me.y - m.y) < 0.3; }, null, 15000);
  m = await me();
  const dPalm = Math.hypot(m.x - palm.x, m.y - palm.y);
  check('walking into a potted palm stops you (no clipping)', dPalm >= palm.r + 0.3, `distance ${dPalm.toFixed(2)}`);
  const local = await p.evaluate(() => __mm.me);
  check('client prediction agrees with the server', Math.hypot(local.x - m.x, local.y - m.y) < 0.3, `${Math.hypot(local.x - m.x, local.y - m.y).toFixed(2)} tiles apart`);

  // ---- till: work till 1 with Space and the real cash drawer, until a cash sale completes
  const ck0 = await p.evaluate(() => __mm.world.checkouts[0]);
  await tp(ck0.kx, ck0.ky, 0, -0.35); await at(ck0.kx, ck0.ky);
  await until(() => __mm.state.ck[0].m === __mm.myId);
  st = await S();
  check('standing on the mat mans the till', st.ck[0].m === (await p.evaluate(() => __mm.myId)));
  let sawPos = false, cashDone = false, sawDrawer = false, sawReceipt = false, served0 = null, t0 = Date.now(), shotDrawer = false;
  const notes = await p.evaluate(() => __mm.world.notes);
  while (Date.now() - t0 < 240000 && !cashDone) {
    st = await S();
    const ck = st.ck[0];
    if (!(await p.$eval('#pos', e => e.classList.contains('hidden')))) sawPos = true;
    const drawerOpen = !(await p.$eval('#drawerPanel', e => e.classList.contains('hidden')));
    if (drawerOpen) {
      sawDrawer = true;
      let left = ck.pay ? ck.pay.due - ck.pay.g : 0;
      for (let i = 0; i < notes.length && left > 0; i++) while (left >= notes[i]) { await p.click(`#drNotes button:nth-child(${i + 1})`); left -= notes[i]; }
      if (!shotDrawer && out) { await p.screenshot({ path: out + '/drawer.png' }); shotDrawer = true; }
      const servedBefore = st.ck[0];
      await p.click('#drGiveBtn'); await wait(900);
      st = await S();
      if (!st.ck[0].items || st.ck[0].i !== servedBefore.i || !st.ck[0].pay || st.ck[0].st !== 'cash') cashDone = true;
      continue;
    }
    if (ck.items && (ck.st === 'scan' || ck.st === 'total' || (ck.st === 'cash' && ck.pay))) await p.keyboard.press(' ');
    await wait(350);
    if (!sawReceipt && !(await p.$eval('#receipt', e => e.classList.contains('hidden')))) {
      sawReceipt = true;
      if (out) await p.screenshot({ path: out + '/receipt.png' });
    }
  }
  await wait(700);
  if (!sawReceipt) sawReceipt = !(await p.$eval('#receipt', e => e.classList.contains('hidden')));
  check('the live bill shows at the till', sawPos);
  check('a cash shopper opens the cash drawer on Space', sawDrawer);
  check('giving the right change completes the sale', cashDone);
  check('a printed receipt appears', sawReceipt);
  const rtxt = await p.textContent('#receipt');
  check('receipt shows total, payment and thank-you', /TOTAL/.test(rtxt) && /Paid/.test(rtxt) && /Thank you/.test(rtxt), rtxt.replace(/\s+/g, ' ').slice(0, 90));
  check('drawer closed after the sale', await p.$eval('#drawerPanel', e => e.classList.contains('hidden')));

  // ---- grow panel and settings
  await p.keyboard.press('u'); await wait(500);
  const lv = await p.$$eval('#lvlTrack .lvcard', c => c.map(x => x.className));
  const nextBtn = await p.$eval('#lvlTrack .lvcard.next [data-buy]', e => ({ disabled: e.disabled, title: e.title })).catch(() => null);
  check('grow panel shows level cards and the next-level requirements', lv.length === 4 && nextBtn && nextBtn.disabled === (nextBtn.title.length > 0), nextBtn && nextBtn.title);
  if (out) await p.screenshot({ path: out + '/grow.png' });
  await p.keyboard.press('Escape'); await wait(300);
  await p.click('#btnSet'); await wait(500);
  await p.$eval('#setFov', e => { e.value = 85; e.dispatchEvent(new Event('input')); });
  check('FOV setting changes the camera', await p.evaluate(() => __mm.scene.baseFov === 85));
  await p.keyboard.press('Escape');

  check('no JavaScript errors during the whole play-through', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n${fail ? fail + ' FAILED, ' : 'ALL '}${pass} passed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed:', e.message); process.exit(1); });

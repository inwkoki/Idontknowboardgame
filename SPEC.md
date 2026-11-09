# กฎลับ (Secret Rule) — Build Spec

> เอกสารนี้เป็น spec ให้ Claude Code สร้างเกม อ่านทั้งไฟล์ก่อนเริ่ม แล้วทำตาม Milestones ทีละขั้น
> Design doc ฉบับเต็ม (มีแผนภาพ): https://claude.ai/artifact/Q3bB7k18z8W8MKmLm7U5AM

## 1. เกมคืออะไร

เกมไขกฎลับแนว deduction สำหรับปาร์ตี้ 3–7 คน (ออกแบบโดยถือ 4 คนเป็นหลัก) ยืม *กลไก* จากเกมการ์ด "I Know… You Don't" แต่ชื่อเกม การ์ด ภาพ และข้อความกฎทำเองทั้งหมด **ห้ามใช้ชื่อ โลโก้ หรือ asset ของเกมต้นฉบับ**

ความต่างจากบอร์ดเกมจริง: **คอมพิวเตอร์เป็น Rule Keeper** — ทุกคนได้เล่น ไม่มีใครต้องนั่งคุมเกม

- **ทีวี** (ต่อ HDMI กับโน้ตบุ๊ก) = โต๊ะกลาง + ลำโพง + ผู้ตัดสิน (host)
- **มือถือแต่ละคน** = ไพ่ในมือ (ลับ) + ปุ่ม action
- **เป้าหมาย**: ลงไพ่ให้หมดมือก่อน แล้วทายกฎลับให้ถูก

## 2. Tech constraints (ห้ามเปลี่ยนโดยไม่ถาม)

- **Vanilla JS (ES modules) + HTML + CSS** — ไม่มี framework, ไม่มี bundler, ไม่มี build step
- **Hosting: GitHub Pages** deploy จาก branch `main` root → ใช้ **relative paths เท่านั้น** (site จะอยู่ใต้ `/idontknowboardgame/`) และใส่ไฟล์ `.nojekyll`
- **Realtime: Supabase JS v2** โหลดจาก CDN (`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm`) ใช้ Broadcast + Presence
- **Local mode**: `net.js` ต้องมี adapter `BroadcastChannel` สำหรับเทสหลายแท็บในเครื่องเดียวโดยไม่ต้องมี Supabase (`?net=local`)
- Logic เกมเป็น **pure functions** ใน `engine.js` เทสด้วย `node --test` (ไม่ต้องลง dependency)
- UI ธีมมืด เรียบ ตัวใหญ่ อ่านจากโซฟาได้ ภาษาไทยเป็นหลัก ใช้ฟอนต์ `Sarabun` หรือ `Noto Sans Thai` จาก Google Fonts
- การ์ดวาดด้วย HTML/CSS + emoji ไม่ใช้ไฟล์ภาพ

## 3. โครงไฟล์

```
/index.html                     หน้าแรก: สร้างห้อง (→ table) / เข้าห้อง (→ hand)
/table.html  /table.js          HOST + จอทีวี (เปิดบนโน้ตบุ๊กที่ต่อทีวี)
/hand.html   /hand.js           มือถือผู้เล่น
/style/base.css  table.css  hand.css
/vendor/qrcode.js               qrcode-generator 1.4.4 (MIT) — เก็บใน repo ไม่พึ่ง CDN
/tools/playtest.py              playtest อัตโนมัติด้วย Playwright
/config.js                      SUPABASE_URL, SUPABASE_ANON_KEY (ค่าว่าง = ใช้ได้แค่ local mode)
/shared/net.js                  createRoomNet(code, {mode:'supabase'|'local'}) → {send, on, presence, close}
/shared/input.js                keyboard + Gamepad API → events 'accept' | 'decline' | 'start'
/shared/audio.js                cue queue: mp3 ถ้ามี / fallback speechSynthesis th-TH / SFX ด้วย WebAudio
/shared/util.js                 seeded RNG (mulberry32), shuffle, room code, ids
/games/secret-rule/cards.js     สร้างเด็ค 72 ใบ
/games/secret-rule/rules.js     คลังกฎ
/games/secret-rule/engine.js    (state, action) → {state, events}
/games/secret-rule/sim.js       จำลองเกม/วัดความยากของกฎ (รันด้วย node)
/tests/*.test.js                node --test
/audio/                         ไฟล์เสียง (อาจว่างตอนแรก)
/.nojekyll
```

## 4. การ์ด (สัตว์อย่างเดียว)

72 ใบ = 18 สัตว์ × 4 สี แต่ละใบมีเลข 1–9

| habitat | สัตว์ (emoji, id, ชื่อไทย) |
|---|---|
| `land` บก | 🐘 elephant ช้าง · 🐯 tiger เสือ · 🐱 cat แมว · 🐶 dog หมา · 🐰 rabbit กระต่าย · 🐒 monkey ลิง |
| `water` น้ำ | 🐟 fish ปลา · 🐢 turtle เต่า · 🐬 dolphin โลมา · 🐙 octopus หมึก · 🦀 crab ปู · 🐊 crocodile จระเข้ |
| `sky` ฟ้า | 🐦 bird นก · 🦉 owl นกฮูก · 🐝 bee ผึ้ง · 🦋 butterfly ผีเสื้อ · 🦇 bat ค้างคาว · 🦅 eagle อินทรี |

- สี: `red` แดง · `yellow` เหลือง · `green` เขียว · `blue` ฟ้า (ใช้สีที่ตัดกันชัดบนพื้นมืด และใส่สัญลักษณ์มุมการ์ดด้วย ●▲■◆ เพื่อคนตาบอดสี)
- เลข: เอา `[1..9]` × 8 ชุด = 72 ตัว shuffle ด้วย seed คงที่ (`DECK_SEED = 20261109`) แล้วแจกให้การ์ดตามลำดับ → เลขแต่ละค่ามี 8 ใบพอดี เด็คเหมือนกันทุกเกม
- Card object: `{ id:'c17', animal:'elephant', emoji:'🐘', nameTh:'ช้าง', habitat:'land', color:'blue', n:7 }`

## 5. กฎลับ

```js
// rules.js
export const RULES = [
  { id:'odd', level:1, th:'เลขคี่เท่านั้น', test:(c, prev, line) => c.n % 2 === 1 },
  { id:'up',  level:4, th:'เลขมากกว่าใบก่อนหน้า', test:(c, prev) => !prev || c.n > prev.n },
  ...
];
```

- `prev` = การ์ดใบสุดท้ายในแถว (ถ้าแถวว่าง = `null` → กฎแบบลำดับต้องคืน `true`)
- `line` = array การ์ดที่ผ่านแล้วทั้งหมด (สำหรับกฎ level 5)
- ทำ **ระดับละ 8 ข้อ รวม 40 ข้อ**:

| Level | รูปแบบ | ตัวอย่าง |
|---|---|---|
| 1 | attribute เดียว | สีแดง · เลขคี่ · อยู่บนบก · เลข ≤ 4 |
| 2 | หรือ / ไม่ใช่ / ช่วง | แดงหรือฟ้า · ไม่ใช่สัตว์น้ำ · เลข 5 ขึ้นไป · เลข 3–6 |
| 3 | และ (2 เงื่อนไข) | สัตว์บกที่เลขคู่ · สัตว์น้ำที่ไม่ใช่สีเขียว · สัตว์ฟ้าหรือเลข 9 |
| 4 | เทียบกับใบก่อน | ต่างสีจากใบก่อน · เลขมากกว่าใบก่อน · ถิ่นเดียวกับใบก่อน · เลขห่างจากใบก่อนไม่เกิน 2 |
| 5 | แพทเทิร์นทั้งแถว | สลับคี่-คู่ · สีวน แดง→เหลือง→เขียว→ฟ้า · ผลรวมกับใบก่อนไม่เกิน 10 · ถิ่นวน บก→น้ำ→ฟ้า |

- **Validation (ใน `sim.js` + test)**: สำหรับกฎ level 1–3 สัดส่วนการ์ดที่ผ่านในเด็คต้องอยู่ระหว่าง 20%–70% สำหรับกฎ level 4–5 จำลองแถวสุ่ม 1,000 ครั้งแล้ววัดโอกาสผ่านเฉลี่ยของการ์ดสุ่ม ต้องอยู่ช่วงเดียวกัน กฎที่ไม่ผ่านให้แก้หรือตัดออก
- กฎสองข้อที่ให้ผลเหมือนกันบนทั้งเด็คถือว่าซ้ำ ห้ามมี

## 6. Game flow (host เป็นคนรันทั้งหมด)

Phase: `lobby → dealing → turn → (guessing) → ended`

**Setup**
1. Host เลือกระดับกฎ (1–5 หรือ "สุ่ม") → สุ่มกฎลับ 1 ข้อ
2. Shuffle เด็ค (seed สุ่มต่อเกม) แจกคนละ **7 ใบ**
3. หาไพ่ใบแรกจากกองที่ผ่านกฎ (prev=null) วางเป็นใบเริ่มต้นของแถว
4. ลำดับผู้เล่น = ลำดับที่เข้าห้อง เริ่มจากคนแรก

**ตาเล่น — ผู้เล่นเลือก 1 อย่าง**

| Action | ผลถ้าถูก | ผลถ้าผิด |
|---|---|---|
| `play` 1 ใบ | การ์ดต่อท้ายแถว | การ์ดกลับเข้ามือ + บันทึกลง `rejects` ใต้ตำแหน่งปลายแถวนั้น |
| `play` หลายใบ (เรียงลำดับตามที่ผู้เล่นเลือก) | ทุกใบต่อท้ายแถวตามลำดับ (แต่ละใบตัดสินโดย `prev` = ใบก่อนหน้า รวมใบที่เพิ่งลงในชุดเดียวกัน) | ทั้งชุดกลับเข้ามือ, บันทึก rejects ทั้งชุด (แสดงว่าเป็นชุดเดียวกัน) |
| `trade` (ประกาศว่าไม่มีใบไหนผ่าน) | จริง: ทิ้งทั้งมือ (ไปกอง discard) จั่วใหม่ `จำนวนเดิม − 1` ใบ | ไม่จริง: host หยิบใบแรกในมือที่ผ่านไปต่อแถว แล้วผู้เล่นจั่ว 1 ใบ |

- ถ้ามือหมดหลังจบ action → เข้า `guessing` ของผู้เล่นคนนั้น ไม่งั้นไปตาคนถัดไป
- กองจั่วหมด → เอา discard มา shuffle เป็นกองใหม่ (ถ้าไม่มีอะไรเหลือ ก็ข้ามการจั่ว)

**ทายกฎ**
- Host สร้างตัวเลือก 3 ข้อ = กฎจริง + ตัวหลอก 2 ข้อ
- ตัวหลอก: จากกฎทั้งหมด (ยกเว้นกฎจริง) เลือก 2 ข้อที่ **สอดคล้องกับการ์ดในแถวมากที่สุด** (นับ % ของการ์ดในแถวที่ผ่านกฎนั้นตามลำดับ) แต่ต้องต่างจากกฎจริงบนเด็คอย่างน้อย 10% ของใบ → ตัวหลอกดูน่าเชื่อ
- สลับลำดับ ส่งเฉพาะมือถือคนที่ทาย (event `guessOptions`)
- ถูก → `ended` ชนะ · ผิด → ตัวเลือกชุดเดิมส่งต่อให้คนถัดไป (ตามเข็มนาฬิกา) ทาย ไปเรื่อย ๆ จนมีคนถูก
- Setting `revealWrongGuess` (default `false`): ถ้า `true` ตัวเลือกที่ผิดจะถูกตัดออกและประกาศบนทีวี

**Settings** (เลือกใน lobby): `level`, `handSize`=7, `revealWrongGuess`=false, `showRejects`=`'all'|'last'` (default `'all'`), `turnTimerSec`=0 (ปิด)

## 7. Network

### Identity
- มือถือสร้าง `playerId` (uuid) + `secret` (สุ่ม 16 ตัว) เก็บใน `localStorage` ต่อรหัสห้อง → รีเฟรชแล้วกลับมาเป็นคนเดิม
- ชื่อผู้เล่นเก็บใน localStorage ด้วย

### Channels (Supabase Broadcast)
- สาธารณะ: `sr:<CODE>` — ทุกเครื่อง subscribe, Presence key = `playerId` หรือ `'host'`
- ส่วนตัว: `sr:<CODE>:<secret>` — host ส่ง `hand` / `guessOptions` ให้คนเดียว (มือถือ subscribe ช่องของตัวเอง, host รู้ secret จาก `join`)
- ระดับความปลอดภัยแค่ "เพื่อนเล่นกัน" ไม่ต้องทำ auth

### Messages (ทุกอันมี `{type, seq, ...}`)

| ทิศทาง | type | payload |
|---|---|---|
| มือถือ → host | `join` | `{playerId, secret, name}` |
| มือถือ → host | `play` | `{playerId, cardIds:[...]}` (ตามลำดับที่เลือก) |
| มือถือ → host | `trade` | `{playerId}` |
| มือถือ → host | `guess` | `{playerId, ruleId}` |
| มือถือ → host | `sync` | `{playerId}` ขอ state ล่าสุด (หลังรีเฟรช) |
| host → ทุกคน | `state` | `{phase, players:[{id,name,handCount,online}], turn, line, rejects, deckCount, guesser, log, settings}` |
| host → คนเดียว | `hand` | `{cards}` |
| host → คนเดียว | `guessOptions` | `{options:[{id, th}]}` |
| host → ทุกคน | `cue` | `{name}` ให้มือถือสั่น/เปลี่ยนสี |

- Host validate ทุก action: ใช่ตาคนนี้ไหม, การ์ดอยู่ในมือจริงไหม, phase ถูกไหม — ไม่ผ่านให้ทิ้งเงียบ ๆ
- Host ประมวลผลทีละ action (queue)
- **กฎลับไม่เคยถูกส่งออกจาก host** จนกว่าจะ `ended` (ตอนนั้นส่ง `secretRule` ใน state)

### Persistence
- ตาราง `rooms` ใน Supabase: host upsert snapshot หลังทุก action **ยกเว้น** `secretRuleId` และมือของผู้เล่น — สองอย่างนี้ host เก็บใน `localStorage` ของโน้ตบุ๊ก
- Host รีเฟรช → โหลด snapshot + localStorage → เล่นต่อได้

```sql
create table rooms (
  code text primary key,
  state jsonb not null,
  updated_at timestamptz default now()
);
alter table rooms enable row level security;
create policy "friends rw" on rooms for all using (true) with check (true);
```

## 8. จอทีวี (`table.html`, 1920×1080, ดูจากระยะ 3 เมตร)

- **Lobby**: รหัสห้อง 4 ตัวอักษรตัวใหญ่ + QR code ไปที่ `hand.html?room=CODE` (`vendor/qrcode.js`), รายชื่อผู้เล่น + สถานะออนไลน์, เลือก settings, ปุ่ม "เริ่มเกม" (คลิกนี้ปลดล็อกเสียง autoplay ด้วย)
- **ระหว่างเล่น**:
  - แถวการ์ดที่ผ่าน เรียงซ้าย→ขวา ตัดขึ้นบรรทัดใหม่เมื่อเต็ม
  - **Rejects แขวนอยู่ใต้การ์ดที่มันถูกลองต่อ** (สีจางลง) — ช่วยให้คนเดาได้
  - แถบผู้เล่นด้านล่าง: ชื่อ, จำนวนไพ่ในมือ, ไฮไลต์คนที่ถึงตา
  - Log สั้น ๆ มุมขวา ("บี ลง 2 ใบ ✓")
- **Animation**: CSS transition เท่านั้น (การ์ดเลื่อนเข้าแถว, เด้งตก) ไม่ใช้ canvas
- **Guessing**: จอมืดลง สปอตไลต์คนที่ทาย + นับถอยหลัง
- **Ended**: เฉลยกฎ + ไฮไลต์ทุกใบในแถว, ปุ่ม "เล่นอีก" (ใช้ผู้เล่นชุดเดิม)

## 9. มือถือ (`hand.html`)

- เข้าห้อง: ใส่รหัส (หรือมาจาก QR) + ชื่อ
- ไพ่ในมือเป็น grid แตะเพื่อเลือก — ใบที่เลือกมีเลขลำดับ 1, 2, 3 ที่มุม แตะซ้ำ = ยกเลิก (ห้ามใช้ drag)
- ปุ่ม: **ลงไพ่** (เปิดเมื่อเลือก ≥1 ใบ และถึงตา) · **ไม่มีใบไหนผ่าน (แลกทั้งมือ)** (มี confirm)
- ไม่ใช่ตาเรา: ปุ่มปิด แสดง "รอ … อยู่"
- ถึงตาเรา: `navigator.vibrate(200)` (ถ้ามี) + พื้นหลังเปลี่ยนสี
- Guessing: แสดงกฎ 3 ข้อ แตะเลือก + confirm
- Wake Lock API กันจอดับ (ขอใหม่เมื่อกลับมา visible)
- ดูดีบนจอกว้าง 360–430px

## 10. เสียงและ input

- `audio.js`: `playCue(name)` → ลองเล่น `/audio/<name>.mp3` ถ้าไม่มีไฟล์ ใช้ `speechSynthesis` (lang `th-TH`) พูดข้อความจาก map; SFX (`ok`, `nope`, `tick`, `fanfare`) สร้างด้วย WebAudio oscillator ไม่ต้องใช้ไฟล์
- Cue list: `join`, `start` ("กฎลับถูกตั้งแล้ว เริ่มเกม"), `turn` ("ตาของ {name}"), `ok`, `nope`, `guess` ("{name} หมดมือแล้ว ได้ทายกฎ"), `win` ("{name} ชนะ!")
- `input.js`: keyboard (`Enter`=accept, `Escape`=decline, `Space`=start) + Gamepad API (button 0=accept, 1=decline, 9=start) poll ด้วย requestAnimationFrame → `emit('accept')` ฯลฯ
  - ตอนนี้ใช้ใน table: `start` = เริ่มเกม/เล่นอีก, `accept` = ข้ามนับถอยหลัง
  - เตรียมไว้สำหรับโหมด Rule Keeper เป็นคน (ภายหลัง) ที่คนกดปุ่มอาร์เคด เขียว/แดง ตัดสิน
- หน้า `table.html?debug=input` แสดงปุ่มที่กดล่าสุด ไว้เทสปุ่มจริง

## 11. Milestones

### MVP 1 — เล่นได้ครบลูป
- [x] `cards.js`, `util.js` + tests (72 ใบ, เลขแต่ละค่า 8 ใบ, deterministic)
- [x] `rules.js` level 1–3 อย่างน้อย 24 ข้อ + `sim.js` validation
- [x] `engine.js`: setup, play, ตัดสิน, เปลี่ยนตา, มือหมด → ended (ยังไม่ต้องทาย) + tests
- [x] `net.js` local mode (BroadcastChannel) + supabase mode (supabase ยังไม่ได้เทสจริง)
- [x] `table.html` lobby + QR + แถวการ์ด + rejects + แถบผู้เล่น
- [x] `hand.html` join + มือ + ลงไพ่
- [x] เทส: 1 แท็บ table + 4 แท็บ hand ด้วย `?net=local` เล่นจนจบได้ (`tools/playtest.py`)
- [x] ย้ายมาจาก MVP 2 เพราะจำเป็น (ไม่มีแล้วเกมค้างได้): play หลายใบตามลำดับ, trade, discard/reshuffle

- [x] ปุ่ม **ยอมแพ้ · เฉลยกฎ** บนทีวี (กด 2 ครั้งภายใน 4 วิ) → จบเกมแบบไม่มีผู้ชนะ เฉลยกฎทั้งทีวีและมือถือ (`giveUp()` ใน engine, host-only)
- [x] Lobby ทีวีมีแผง **ไพ่ในเกมนี้**: เลข 1–9, 4 สีพร้อมสัญลักษณ์, สัตว์ 18 ตัวแบ่งตามถิ่น, ตัวอย่างการ์ด, วิธีเล่นสั้น ๆ ให้อ่านระหว่างรอเพื่อนเข้าห้อง

Test params: `?net=local` (ไม่ใช้ Supabase), `hand.html?seat=N` (หลายแท็บในเบราว์เซอร์เดียวเป็นคนละคน), `table.html?debug` (เปิด `window.__sr` ให้สคริปต์เทสอ่าน state — ห้ามใช้ตอนเล่นจริง)

### MVP 2 — กติกาครบ
- [ ] guessing + ตัวหลอก + ส่งต่อคนถัดไป
- [ ] กฎ level 4–5 (รวม 40 ข้อ)
- [ ] settings ใน lobby
- [ ] reconnect: มือถือรีเฟรช / host รีเฟรช

### MVP 3 — บรรยากาศ
- [ ] audio.js + cue ทั้งหมด
- [ ] animation การ์ด
- [ ] input.js + `?debug=input`
- [ ] vibrate + wake lock
- [ ] README: วิธีตั้ง Supabase, เปิด GitHub Pages, ต่อทีวี

### ภายหลัง
- โหมด Rule Keeper เป็นคน (คิดกฎเอง, กดปุ่มอาร์เคดตัดสิน, ผู้เล่นพิมพ์คำตอบตอนทาย)
- เด็คธีมอื่น / attribute "จำนวนขา"
- เกมอื่นในแพลตฟอร์มเดียวกัน (โครง `games/<name>/` รองรับแล้ว)

## 12. Definition of done (ทุก milestone)

- `node --test` ผ่านหมด
- เปิดผ่าน `python3 -m http.server` แล้วเล่น local mode ได้ ไม่มี error ใน console
- ใช้ relative path ทั้งหมด (ทำงานใต้ `/idontknowboardgame/` บน GitHub Pages)
- Commit เล็ก ๆ ต่อฟีเจอร์ ข้อความ commit ภาษาอังกฤษ

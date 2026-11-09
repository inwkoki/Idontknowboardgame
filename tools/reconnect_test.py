"""Reconnect / leave / skip scenarios over ?net=local.
Run: python3 -m http.server 8080 (repo root), then python3 tools/reconnect_test.py
Needs: pip install playwright && playwright install chromium (or set CHROME=/path/to/chrome)"""
import os, time
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://localhost:8080")
errors = []
ok = lambda cond, msg: print(("PASS " if cond else "FAIL ") + msg) or (cond or errors.append(msg))


def watch(page, name):
    page.on("pageerror", lambda e: errors.append(f"{name}: {e}"))
    page.on("console", lambda m: m.type == "error" and "ERR_TUNNEL" not in m.text and errors.append(f"{name}: {m.text}"))


def host_game(tv):
    return tv.evaluate("window.__sr.game && JSON.parse(JSON.stringify(window.__sr.game))")


def play_turn(tv, phones):
    """Current player plays a fitting card (bot reads the rule via ?debug) or trades in."""
    g = host_game(tv)
    pid = g["players"][g["turn"]]["id"]
    ph = phones[pid]
    ph.wait_for_selector("body.my-turn", timeout=8000)
    fit = tv.evaluate("""async (pid) => {
        const { RULE_BY_ID } = await import('./games/secret-rule/rules.js');
        const { getCard } = await import('./games/secret-rule/cards.js');
        const g = window.__sr.game, r = RULE_BY_ID[g.secretRuleId];
        const p = g.players.find(x => x.id === pid), prev = getCard(g.line.at(-1));
        return p.hand.findIndex(id => r.test(getCard(id), prev, [], g.ctx));
    }""", pid)
    before = len(g["log"])
    if fit >= 0:
        ph.locator("#hand .card").nth(fit).click()
        ph.click("#btn-play")
    else:
        ph.click("#btn-trade")
        ph.click("#btn-trade")
    tv.wait_for_function(f"window.__sr.game.log.length > {before} || window.__sr.game.phase !== 'turn'", timeout=8000)


with sync_playwright() as p:
    kw = {"args": ["--no-sandbox"]}
    if os.environ.get("CHROME"):
        kw["executable_path"] = os.environ["CHROME"]
    b = p.chromium.launch(**kw)
    ctx = b.new_context()
    tv = ctx.new_page()
    tv.set_viewport_size({"width": 1920, "height": 1080})
    watch(tv, "tv")
    tv.goto(f"{BASE}/table.html?room=RCON&net=local&debug")
    tv.evaluate("localStorage.removeItem('sr:host:RCON')")
    tv.reload()

    pages = []
    for i, n in enumerate(["บี", "นุ่น", "โจ", "แพร"]):
        ph = ctx.new_page()
        ph.set_viewport_size({"width": 390, "height": 844})
        watch(ph, n)
        ph.add_init_script(f"localStorage.setItem('sr:name', '{n}')")
        ph.goto(f"{BASE}/hand.html?room=RCON&net=local&seat={i}")
        pages.append(ph)
    tv.wait_for_function("document.querySelectorAll('#lobby-players .player').length === 4", timeout=15000)

    # --- leave in the lobby, come back under another name ---
    leaver = pages[3]
    leaver.click("#btn-leave")
    leaver.click("#btn-leave")
    tv.wait_for_function("document.querySelectorAll('#lobby-players .player').length === 3", timeout=8000)
    ok(leaver.is_visible("#join-form"), "leave: phone is back on the join form")
    ok(leaver.input_value("#in-code") == "RCON", "leave: room code kept in the form")
    leaver.fill("#in-name", "แพรวา")
    leaver.click("#btn-join")
    tv.wait_for_function("[...document.querySelectorAll('#lobby-players .player')].some(e => e.textContent.includes('แพรวา'))", timeout=8000)
    ok(True, "leave: rejoined with a new name")

    tv.click("#start")
    tv.wait_for_selector("#game:not(.hidden)")
    seat_of = {}
    for ph in pages:
        pid = ph.evaluate("JSON.parse(localStorage.getItem('sr:id:RCON' + new URLSearchParams(location.search).get('seat'))).playerId")
        seat_of[pid] = ph
    for _ in range(3):
        play_turn(tv, seat_of)

    # --- a phone reloads mid-game ---
    g = host_game(tv)
    victim_id = g["players"][g["turn"]]["id"]
    victim = seat_of[victim_id]
    expect = sorted(next(x["hand"] for x in g["players"] if x["id"] == victim_id))
    victim.reload()
    victim.wait_for_function("document.querySelectorAll('#hand .card').length > 0", timeout=10000)
    time.sleep(0.5)
    got = sorted(victim.eval_on_selector_all("#hand .card", "els => els.map(e => e.dataset.id)"))
    ok(got == expect, "phone reload: same hand comes back")
    ok(victim.evaluate("document.body.classList.contains('my-turn')"), "phone reload: still my turn")
    play_turn(tv, seat_of)

    # --- the TV reloads mid-game ---
    g = host_game(tv)
    line_before, turn_before = list(g["line"]), g["turn"]
    tv.reload()
    tv.wait_for_selector("#game:not(.hidden)", timeout=10000)
    g2 = host_game(tv)
    ok(g2 is not None and g2["line"] == line_before and g2["turn"] == turn_before, "TV reload: game restored (line + turn)")
    ok(g2["secretRuleId"] == g["secretRuleId"], "TV reload: same secret rule")
    play_turn(tv, seat_of)
    ok(True, "TV reload: phones keep playing")

    # --- skip a turn ---
    g = host_game(tv)
    if g["phase"] == "turn":
        t0 = g["turn"]
        tv.click("#skip")
        tv.click("#skip")
        time.sleep(0.3)
        ok(host_game(tv)["turn"] == (t0 + 1) % len(g["players"]), "skip: turn passed on")

    # --- finish the game ---
    guard = 0
    while host_game(tv)["phase"] == "turn" and guard < 300:
        play_turn(tv, seat_of)
        guard += 1
    ok(host_game(tv)["phase"] == "ended", "game finishes after all of that")
    time.sleep(0.5)
    tv.screenshot(path="/tmp/sr-reconnect-ended.png")
    pages[0].screenshot(path="/tmp/sr-reconnect-phone.png")

    ok(not errors, f"no console errors {errors[:5]}")
    b.close()
    raise SystemExit(1 if errors else 0)

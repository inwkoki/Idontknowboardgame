"""Run: python3 -m http.server 8080  (repo root), then: python3 tools/playtest.py
Needs: pip install playwright && playwright install chromium
"""
"""Headless playtest: 1 TV page + 4 phone pages over BroadcastChannel (?net=local).
Bots read the secret state through the ?debug hook only to pick moves; all moves go through the phone UI."""
import sys, time
from playwright.sync_api import sync_playwright

import os
BASE = os.environ.get("BASE", "http://localhost:8080")
errors = []

with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"])
    ctx = b.new_context()
    tv = ctx.new_page(); tv.set_viewport_size({"width": 1920, "height": 1080})
    for pg_name, pg in [("tv", tv)]:
        pg.on("console", lambda m, n=pg_name: m.type == "error" and "ERR_TUNNEL" not in m.text and errors.append(f"{n}: {m.text}"))
        pg.on("pageerror", lambda e, n=pg_name: errors.append(f"{n}: {e}"))
    tv.goto(f"{BASE}/table.html?room=TEST&net=local&debug")
    tv.wait_for_selector("#big-code")

    names = ["บี", "นุ่น", "โจ", "แพร"]
    phones = []
    for n in names:
        ph = ctx.new_page(); ph.set_viewport_size({"width": 390, "height": 844})
        ph.on("console", lambda m, nn=n: m.type == "error" and "ERR_TUNNEL" not in m.text and errors.append(f"{nn}: {m.text}"))
        ph.on("pageerror", lambda e, nn=n: errors.append(f"{nn}: {e}"))
        ph.add_init_script(f"localStorage.setItem('sr:name', '{n}')")
        ph.goto(f"{BASE}/hand.html?room=TEST&net=local&seat={len(phones)}")
        phones.append(ph)

    tv.wait_for_function("document.querySelectorAll('#lobby-players .player').length === 4", timeout=15000)
    tv.screenshot(path="/tmp/sr-shot-lobby.png")
    import os as _os
    tv.select_option("#opt-animals", _os.environ.get("ANIMALS", "all"))
    tv.select_option("#opt-numbers", _os.environ.get("MAXN", "9"))
    tv.select_option("#level", _os.environ.get("LEVEL", "2"))
    tv.click("#start")
    tv.wait_for_selector("#game:not(.hidden)")
    time.sleep(0.5)

    moves = 0
    while moves < 400:
        g = tv.evaluate("""() => { const g = window.__sr.game; return g && {phase: g.phase, turn: g.turn,
            pid: g.players[g.turn].id, rule: g.secretRuleId}; }""")
        if g["phase"] != "turn":
            break
        # which phone is that player?
        ph = next(x for x in phones if x.evaluate("JSON.parse(localStorage.getItem('sr:id:TEST' + new URLSearchParams(location.search).get('seat'))).playerId") == g["pid"])
        ph.wait_for_selector("body.my-turn", timeout=5000)
        # pick a fitting card using the host's rule (bot), else trade in
        idx = tv.evaluate("""async (pid) => {
            const { RULE_BY_ID } = await import('./games/secret-rule/rules.js');
            const { getCard } = await import('./games/secret-rule/cards.js');
            const g = window.__sr.game; const r = RULE_BY_ID[g.secretRuleId];
            const p = g.players.find(x => x.id === pid);
            const prev = getCard(g.line.at(-1));
            const fit = p.hand.map((id, i) => r.test(getCard(id), prev, [], g.ctx) ? i : -1).filter(i => i >= 0);
            return { fit, n: p.hand.length };
        }""", g["pid"])
        before = tv.evaluate("window.__sr.game.log.length")
        if moves % 5 == 3 and idx["n"] > 1:
            # deliberately try a wrong-ish move sometimes: first non-fitting card
            wrong = [i for i in range(idx["n"]) if i not in idx["fit"]]
            if wrong:
                ph.locator("#hand .card").nth(wrong[0]).click()
                ph.click("#btn-play")
            elif idx["fit"]:
                ph.locator("#hand .card").nth(idx["fit"][0]).click()
                ph.click("#btn-play")
        elif idx["fit"]:
            ph.locator("#hand .card").nth(idx["fit"][0]).click()
            if len(idx["fit"]) > 1 and moves % 4 == 0:
                ph.locator("#hand .card").nth(idx["fit"][1]).click()
            ph.click("#btn-play")
        else:
            ph.click("#btn-trade")
            ph.click("#btn-trade")
        tv.wait_for_function(f"window.__sr.game.log.length > {before} || window.__sr.game.phase !== 'turn'", timeout=5000)
        moves += 1
        if moves == 12:
            tv.screenshot(path="/tmp/sr-shot-game.png")
            ph2 = phones[(phones.index(ph) + 1) % 4]
            time.sleep(0.4)
            ph2.screenshot(path="/tmp/sr-shot-phone.png")

    time.sleep(0.6)
    final = tv.evaluate("({phase: window.__sr.game.phase, line: window.__sr.game.line.length, winner: window.__sr.game.winnerId, rule: window.__sr.game.secretRuleId})")
    tv.screenshot(path="/tmp/sr-shot-ended.png")
    phones[0].screenshot(path="/tmp/sr-shot-phone-ended.png")
    print("moves", moves, final)
    print("errors", errors[:10])
    b.close()

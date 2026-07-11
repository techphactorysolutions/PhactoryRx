#!/usr/bin/env python3
"""PhactoryRx offline structural checks (stdlib only).

Verifies the static contracts between index.html, app.js, styles.css,
service-worker.js, and manifest.webmanifest without any network access.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# IDs app.js creates at runtime via innerHTML (not present in static HTML).
RUNTIME_IDS = {"addToListBtn", "loadLabelBtn", "labelContainer"}
# IDs app.js references defensively but that are intentionally absent.
OPTIONAL_IDS = {"reviewLabelsBtn"}

PASS = 0
FAIL = 0


def check(name, ok, detail=""):
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"  ok  {name}")
    else:
        FAIL += 1
        print(f"FAIL  {name}" + (f" — {detail}" if detail else ""))


def main():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    js = (ROOT / "app.js").read_text(encoding="utf-8")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    sw = (ROOT / "service-worker.js").read_text(encoding="utf-8")

    print("[1] JavaScript syntax")
    for name in ("app.js", "service-worker.js"):
        result = subprocess.run(["node", "--check", str(ROOT / name)],
                                capture_output=True, text=True)
        check(f"node --check {name}", result.returncode == 0, result.stderr.strip())

    print("[2] Manifest")
    try:
        manifest = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
        check("manifest parses as JSON", True)
        for field in ("name", "short_name", "start_url", "display", "icons"):
            check(f"manifest has {field}", field in manifest)
        for icon in manifest.get("icons", []):
            src = icon.get("src", "").lstrip("./")
            check(f"manifest icon exists: {src}", (ROOT / src).is_file())
    except Exception as exc:  # noqa: BLE001
        check("manifest parses as JSON", False, str(exc))

    print("[3] HTML IDs")
    ids = re.findall(r'id="([^"]+)"', html)
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    check("no duplicate IDs", not dupes, ", ".join(dupes))

    id_set = set(ids)
    referenced = set(re.findall(r"querySelector\('\#([A-Za-z0-9_-]+)'\)", js))
    missing = sorted(referenced - id_set - RUNTIME_IDS - OPTIONAL_IDS)
    check("all app.js #id selectors exist in HTML", not missing, ", ".join(missing))

    for rid in sorted(RUNTIME_IDS):
        check(f"runtime id '{rid}' emitted by app.js", f'id="{rid}"' in js or f"id=\\\"{rid}\\\"" in js)

    print("[4] Tab wiring")
    tabs = set(re.findall(r'data-tab="([^"]+)"', html))
    panels = set(re.findall(r'data-panel="([^"]+)"', html))
    check("data-tab set equals data-panel set", tabs == panels,
          f"tabs={sorted(tabs)} panels={sorted(panels)}")
    controls = re.findall(r'aria-controls="([^"]+)"', html)
    bad_controls = sorted({c for c in controls if c not in id_set})
    check("all aria-controls targets exist", not bad_controls, ", ".join(bad_controls))
    check("hidden-panel CSS guard present", ".tab-panel[hidden]" in css)
    check("exactly one active tab in initial HTML", html.count('tab-btn active') == 1)
    hidden_panels = len(re.findall(r'data-panel="[^"]+"[^>]*\shidden', html))
    check("all non-default panels start hidden", hidden_panels == len(panels) - 1,
          f"{hidden_panels} of {len(panels) - 1}")

    print("[5] CSS class contract")
    emitted = set()
    for match in re.findall(r'class=\\?"([^"\\]+)', js):
        for token in match.split():
            if re.fullmatch(r"[a-z][a-z0-9-]*", token):
                emitted.add(token)
    emitted |= {"status-banner", "error", "success", "review-report", "exact",
                "partial", "high", "caution", "unknown", "neutral", "uses",
                "description", "mechanism"}
    defined = set(re.findall(r"\.([a-z][a-z0-9-]*)", css))
    missing_css = sorted(emitted - defined - {"class"})
    check("all app.js-emitted classes styled in CSS", not missing_css, ", ".join(missing_css))

    html_classes = set()
    for match in re.findall(r'class="([^"]+)"', html):
        html_classes.update(match.split())
    missing_html_css = sorted(html_classes - defined)
    check("all HTML classes styled in CSS", not missing_html_css, ", ".join(missing_html_css))

    print("[6] Linked assets & service worker")
    for asset in ("styles.css", "app.js", "manifest.webmanifest",
                  "icon-192.png", "icon-512.png", "apple-touch-icon.png", "icon.svg"):
        check(f"asset exists: {asset}", (ROOT / asset).is_file())
    shell = re.findall(r"'\./([^']+)'", sw.split("APP_SHELL")[1].split("]")[0])
    missing_shell = [entry for entry in shell if entry and not (ROOT / entry).is_file()]
    check("service worker APP_SHELL entries exist", not missing_shell, ", ".join(missing_shell))
    check("cache name bumped past v5",
          "phactoryrx-v5-medication-lookup" not in sw and "CACHE_NAME = 'phactoryrx-" in sw)

    print("[7] CSP & behavioral guards")
    csp = re.search(r'Content-Security-Policy" content="([^"]+)"', html)
    check("CSP present", bool(csp))
    if csp:
        value = csp.group(1)
        check("CSP allows RxNav + openFDA only",
              "https://rxnav.nlm.nih.gov" in value and "https://api.fda.gov" in value
              and "unsafe-inline" not in value and "unsafe-eval" not in value)
    check("selectDrug no longer hijacks tabs",
          "renderSelectedDrugSkeleton(drug);\n  loadAndRenderLabel(drug);" in js)
    check("typed items read the interactions input", "interactionAddInput" in js)
    check("user tab switches scroll into view", "{ scroll: true }" in js)
    check("bindEvents is null-safe", "const on = (element, type, handler)" in js)
    check("no nested <form> elements",
          all(chunk.count("<form") <= 1 for chunk in html.split("</form>")))

    print(f"\n{PASS} passed, {FAIL} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())

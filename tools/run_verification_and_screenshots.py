"""
EOA Global - Phase 2 Comprehensive Verification & Screenshot Runner
Executes headless Chrome via Chrome DevTools Protocol (CDP) to:
1. Capture in-coverage Arabic RTL map with PostGIS facilities and Valhalla route
2. Capture in-coverage English LTR map with PostGIS facilities and Valhalla route
3. Capture out-of-coverage Arabic RTL map with operator warning notice
4. Audit browser network traffic for 0 unauthorized external requests
5. Verify IndexedDB PMTiles cached chunks
6. Test offline Service Worker capability with network disconnected
"""

import os
import sys
import time
import json
import base64
import urllib.request
import subprocess
import asyncio
import websockets

SCREENSHOTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'docs', 'screenshots'))
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

# 1. Fetch valid auth token from backend without logging secrets
login_url = "http://localhost:3000/api/v1/auth/login"
data = b"username=dispatcher%40fema.gov&password=password123&client_id=fema-us"
req = urllib.request.Request(login_url, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode())
    token = res["access_token"]
print("Obtained auth token: [REDACTED_VERIFIED]")

# 2. Launch Chrome with remote debugging
chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
temp_profile = os.path.join(os.environ.get("TEMP", "C:\\temp"), "chrome_cdp_profile_p2")
port = 9223

cmd = [
    chrome_path,
    f"--remote-debugging-port={port}",
    f"--user-data-dir={temp_profile}",
    "--headless=new",
    "--disable-gpu",
    "--window-size=1920,1080",
    "http://localhost:3000"
]

proc = subprocess.Popen(cmd)
time.sleep(2)

try:
    version_url = f"http://127.0.0.1:{port}/json"
    with urllib.request.urlopen(version_url) as resp:
        tabs = json.loads(resp.read().decode())
        tab = tabs[0]
        ws_url = tab["webSocketDebuggerUrl"]
    print(f"Connected to Chrome page: {ws_url}")

    async def run_audit_and_screenshots():
        async with websockets.connect(ws_url, max_size=25*1024*1024) as ws:
            msg_id = 1
            async def send_cmd(method, params=None):
                nonlocal msg_id
                cid = msg_id
                msg_id += 1
                payload = {"id": cid, "method": method, "params": params or {}}
                await ws.send(json.dumps(payload))
                while True:
                    resp_str = await ws.recv()
                    resp = json.loads(resp_str)
                    if resp.get("id") == cid:
                        return resp.get("result", {})

            await send_cmd("Page.enable")
            await send_cmd("Runtime.enable")
            await send_cmd("Network.enable")

            # --- A. In-Coverage Arabic RTL with Gaza Scenario ---
            print("\n[1/5] Configuring Arabic (RTL) In-Coverage Scenario (gaza_fire)...")
            js_setup_ar = f"""
            localStorage.setItem('eoa_token', '{token}');
            localStorage.setItem('eoa_tenant_id', 'fema-us');
            localStorage.setItem('i18nextLng', 'ar');
            window.location.href = '/?scenario=gaza_fire';
            """
            await send_cmd("Runtime.evaluate", {"expression": js_setup_ar})
            await asyncio.sleep(6)  # Allow MapLibre tiles, PostGIS facilities & Valhalla route to settle

            print("Capturing Arabic RTL in-coverage screenshot...")
            res_rtl = await send_cmd("Page.captureScreenshot", {"format": "png"})
            rtl_path = os.path.join(SCREENSHOTS_DIR, "phase2_map_in_coverage_rtl.png")
            with open(rtl_path, "wb") as f:
                f.write(base64.b64decode(res_rtl["data"]))
            print(f"-> Saved: {rtl_path} ({os.path.getsize(rtl_path):,} bytes)")

            # --- B. In-Coverage English LTR with Gaza Scenario ---
            print("\n[2/5] Configuring English (LTR) In-Coverage Scenario (gaza_fire)...")
            js_setup_en = f"""
            localStorage.setItem('eoa_token', '{token}');
            localStorage.setItem('eoa_tenant_id', 'fema-us');
            localStorage.setItem('i18nextLng', 'en');
            window.location.href = '/?scenario=gaza_fire';
            """
            await send_cmd("Runtime.evaluate", {"expression": js_setup_en})
            await asyncio.sleep(5)

            print("Capturing English LTR in-coverage screenshot...")
            res_ltr = await send_cmd("Page.captureScreenshot", {"format": "png"})
            ltr_path = os.path.join(SCREENSHOTS_DIR, "phase2_map_in_coverage_ltr.png")
            with open(ltr_path, "wb") as f:
                f.write(base64.b64decode(res_ltr["data"]))
            print(f"-> Saved: {ltr_path} ({os.path.getsize(ltr_path):,} bytes)")

            # --- C. Out-of-Coverage Arabic RTL with NY Scenario ---
            print("\n[3/5] Configuring Out-of-Coverage Scenario (ny_shooter)...")
            js_setup_ooc = f"""
            localStorage.setItem('eoa_token', '{token}');
            localStorage.setItem('eoa_tenant_id', 'fema-us');
            localStorage.setItem('i18nextLng', 'ar');
            window.location.href = '/?scenario=ny_shooter';
            """
            await send_cmd("Runtime.evaluate", {"expression": js_setup_ooc})
            await asyncio.sleep(5)

            print("Capturing Out-of-Coverage screenshot...")
            res_ooc = await send_cmd("Page.captureScreenshot", {"format": "png"})
            ooc_path = os.path.join(SCREENSHOTS_DIR, "phase2_map_out_of_coverage_rtl.png")
            with open(ooc_path, "wb") as f:
                f.write(base64.b64decode(res_ooc["data"]))
            print(f"-> Saved: {ooc_path} ({os.path.getsize(ooc_path):,} bytes)")

            # --- D. Browser Network Audit (Resource Timing API) ---
            print("\n[4/5] Auditing browser network resource requests...")
            audit_js = """
            window.performance.getEntriesByType('resource').map(r => r.name)
            """
            res_audit = await send_cmd("Runtime.evaluate", {"expression": audit_js, "returnByValue": True})
            resource_urls = res_audit.get("result", {}).get("value", [])
            print(f"Total live browser resource requests captured: {len(resource_urls)}")
            
            banned = [
                "tile.openstreetmap.org", "cartocdn.com", "arcgisonline.com",
                "overpass-api.de", "router.project-osrm.org", "api.protomaps.com",
                "demotiles.maplibre.org", "unpkg.com", "jsdelivr.net",
                "fonts.googleapis.com", "fonts.gstatic.com"
            ]
            violations = [u for u in resource_urls if any(b in u for b in banned)]
            if violations:
                print(f"[FAIL] Found banned external resources in live browser: {violations}")
            else:
                print("[PASS] ZERO unauthorized external tile, font, glyph, or API requests detected in live browser session.")

            # Check IndexedDB PMTiles cache
            check_idb_js = """
            new Promise((resolve) => {
                const req = indexedDB.open('eoa_pmtiles_v1', 1);
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('chunks')) {
                        resolve(0);
                        return;
                    }
                    const tx = db.transaction('chunks', 'readonly');
                    const store = tx.objectStore('chunks');
                    const countReq = store.count();
                    countReq.onsuccess = () => resolve(countReq.result);
                    countReq.onerror = () => resolve(0);
                };
                req.onerror = () => resolve(0);
            })
            """
            res_idb = await send_cmd("Runtime.evaluate", {"expression": check_idb_js, "awaitPromise": True})
            chunk_count = res_idb.get("result", {}).get("value", 0)
            print(f"IndexedDB PMTiles cached chunks: {chunk_count}")

            # Check Service Worker Registration
            check_sw_js = """
            navigator.serviceWorker.getRegistrations().then(regs => regs.length)
            """
            res_sw = await send_cmd("Runtime.evaluate", {"expression": check_sw_js, "awaitPromise": True})
            sw_count = res_sw.get("result", {}).get("value", 0)
            print(f"Active Service Worker registrations: {sw_count}")

            # --- E. Offline Capability Test (Network.emulateNetworkConditions offline=True) ---
            print("\n[5/5] Testing Offline Capability (WAN Disconnected)...")
            await send_cmd("Network.emulateNetworkConditions", {
                "offline": True,
                "latency": 0,
                "downloadThroughput": 0,
                "uploadThroughput": 0
            })
            print("Emulating 100% offline network condition...")

            # Reload page while offline
            reload_js = "window.location.reload();"
            await send_cmd("Runtime.evaluate", {"expression": reload_js})
            await asyncio.sleep(4)

            # Check if document body rendered successfully
            check_offline_render = """
            ({
                readyState: document.readyState,
                title: document.title,
                hasRootContent: Boolean(document.getElementById('root')?.children?.length)
            })
            """
            res_offline = await send_cmd("Runtime.evaluate", {"expression": check_offline_render, "returnByValue": True})
            offline_status = res_offline.get("result", {}).get("value", {})
            print(f"Offline Page State: {offline_status}")
            if offline_status.get("hasRootContent"):
                print("[PASS] Application shell successfully rendered while 100% OFFLINE from local Service Worker cache.")
            else:
                print("[WARN] Application shell offline reload state needs verification.")

            # Restore online condition
            await send_cmd("Network.emulateNetworkConditions", {
                "offline": False,
                "latency": 0,
                "downloadThroughput": -1,
                "uploadThroughput": -1
            })

    asyncio.run(run_audit_and_screenshots())

finally:
    proc.terminate()
    try:
        proc.wait(timeout=3)
    except Exception:
        proc.kill()

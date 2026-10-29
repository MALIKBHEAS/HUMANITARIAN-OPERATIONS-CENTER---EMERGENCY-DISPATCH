import os
import sys
import time
import json
import urllib.request
import subprocess

SCREENSHOTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'docs', 'screenshots'))
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

# 1. Fetch valid auth token from backend
login_url = "http://localhost:3000/api/v1/auth/login"
data = b"username=dispatcher%40fema.gov&password=password123&client_id=fema-us"
req = urllib.request.Request(login_url, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode())
    token = res["access_token"]
print(f"Obtained auth token: {token[:20]}...")

# 2. Launch Chrome with remote debugging
chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
temp_profile = os.path.join(os.environ.get("TEMP", "C:\\temp"), "chrome_cdp_profile")
port = 9222

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
    # Discover WebSocket debugger URL
    version_url = f"http://127.0.0.1:{port}/json"
    with urllib.request.urlopen(version_url) as resp:
        tabs = json.loads(resp.read().decode())
        tab = tabs[0]
        ws_url = tab["webSocketDebuggerUrl"]
    print(f"Connected to Chrome page: {ws_url}")

    import websockets
    import asyncio

    async def run_capture():
        async with websockets.connect(ws_url, max_size=20*1024*1024) as ws:
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

            # Capture LTR (English) with out-of-bounds incident
            print("Configuring English (LTR) with out-of-bounds incident (ny_shooter)...")
            js_setup_en = f"""
            localStorage.setItem('eoa_token', '{token}');
            localStorage.setItem('eoa_tenant_id', 'fema-us');
            localStorage.setItem('i18nextLng', 'en');
            window.location.href = '/?scenario=ny_shooter';
            """
            await send_cmd("Runtime.evaluate", {"expression": js_setup_en})
            await asyncio.sleep(5)

            print("Capturing English LTR screenshot...")
            res_ltr = await send_cmd("Page.captureScreenshot", {"format": "png"})
            import base64
            ltr_path = os.path.join(SCREENSHOTS_DIR, "phase1_map_ltr.png")
            with open(ltr_path, "wb") as f:
                f.write(base64.b64decode(res_ltr["data"]))
            print(f"Saved LTR screenshot to {ltr_path} ({os.path.getsize(ltr_path):,} bytes)")

            # Capture RTL (Arabic) with out-of-bounds incident
            print("Configuring Arabic (RTL) with out-of-bounds incident (ny_shooter)...")
            js_setup_ar = f"""
            localStorage.setItem('eoa_token', '{token}');
            localStorage.setItem('eoa_tenant_id', 'fema-us');
            localStorage.setItem('i18nextLng', 'ar');
            window.location.href = '/?scenario=ny_shooter';
            """
            await send_cmd("Runtime.evaluate", {"expression": js_setup_ar})
            await asyncio.sleep(5)

            print("Capturing Arabic RTL screenshot...")
            res_rtl = await send_cmd("Page.captureScreenshot", {"format": "png"})
            rtl_path = os.path.join(SCREENSHOTS_DIR, "phase1_map_rtl.png")
            with open(rtl_path, "wb") as f:
                f.write(base64.b64decode(res_rtl["data"]))
            print(f"Saved RTL screenshot to {rtl_path} ({os.path.getsize(rtl_path):,} bytes)")

            # Network Resource Audit via W3C Resource Timing API
            print("Auditing browser network resource entries...")
            audit_js = """
            window.performance.getEntriesByType('resource').map(r => r.name)
            """
            res_audit = await send_cmd("Runtime.evaluate", {"expression": audit_js, "returnByValue": True})
            resource_urls = res_audit.get("result", {}).get("value", [])
            print(f"Total browser resource requests captured: {len(resource_urls)}")
            
            banned = ["googleapis.com", "gstatic.com", "unpkg.com", "jsdelivr.net", "cartocdn.com", "arcgisonline.com", "maps.eox.at"]
            banned_found = [u for u in resource_urls if any(b in u for b in banned)]
            if banned_found:
                print(f"[FAIL] Found banned external resources in browser: {banned_found}")
            else:
                print("[PASS] ZERO unauthorized external tile, font, glyph, or CDN requests detected.")

            # IndexedDB Chunk Store Verification
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

    asyncio.run(run_capture())

finally:
    proc.terminate()
    try:
        proc.wait(timeout=3)
    except Exception:
        proc.kill()

import urllib.request
import urllib.error

url = "http://localhost:3000/styles/tactical-dark.json"
# 1. Fetch ETag
req1 = urllib.request.Request(url)
with urllib.request.urlopen(req1) as resp:
    etag = resp.headers.get("ETag")
    status = resp.status
    print(f"Initial GET: Status {status}, ETag: {etag}")

# 2. Revalidate with If-None-Match
req2 = urllib.request.Request(url, headers={"If-None-Match": etag})
try:
    with urllib.request.urlopen(req2) as resp:
        print(f"Revalidation status: {resp.status}")
except urllib.error.HTTPError as e:
    print(f"Revalidation status: {e.code} ({e.reason})")

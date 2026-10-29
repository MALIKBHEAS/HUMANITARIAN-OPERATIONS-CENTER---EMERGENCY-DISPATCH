import os
import re
import urllib.request
import urllib.parse

PUBLIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'eoa_global_frontend', 'public'))
GLYPHS_DIR = os.path.join(PUBLIC_DIR, 'fonts', 'glyphs')
FONTS_DIR = os.path.join(PUBLIC_DIR, 'fonts')
VENDOR_DIR = os.path.join(PUBLIC_DIR, 'vendor')

os.makedirs(GLYPHS_DIR, exist_ok=True)
os.makedirs(FONTS_DIR, exist_ok=True)
os.makedirs(VENDOR_DIR, exist_ok=True)

USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

def download_file(url, dest_path):
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(req) as resp, open(dest_path, 'wb') as f:
        f.write(resp.read())
    print(f"Downloaded: {url} -> {dest_path} ({os.path.getsize(dest_path)} bytes)")

# 1. Download RTL text plugin
rtl_plugin_url = 'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js'
rtl_dest = os.path.join(VENDOR_DIR, 'mapbox-gl-rtl-text.js')
if not os.path.exists(rtl_dest):
    print("Fetching mapbox-gl-rtl-text.js...")
    download_file(rtl_plugin_url, rtl_dest)

# 2. Download Glyphs
font_stacks = ['Noto Sans Regular', 'Noto Sans Bold']
ranges = [
    '0-255',       # Basic Latin, ASCII
    '256-511',     # Latin Extended
    '1536-1791',   # Arabic
    '1792-2047',   # Arabic Supplement
    '8192-8447',   # General Punctuation
]

for stack in font_stacks:
    stack_dir = os.path.join(GLYPHS_DIR, stack)
    os.makedirs(stack_dir, exist_ok=True)
    for r in ranges:
        dest_pbf = os.path.join(stack_dir, f"{r}.pbf")
        if not os.path.exists(dest_pbf):
            url = f"https://demotiles.maplibre.org/font/{urllib.parse.quote(stack)}/{r}.pbf"
            try:
                download_file(url, dest_pbf)
            except Exception as e:
                print(f"Failed to download glyph {stack}/{r}: {e}")

# 3. Download Web Fonts (Cairo, Inter, JetBrains Mono)
css_url = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap'
req = urllib.request.Request(css_url, headers={'User-Agent': USER_AGENT})
with urllib.request.urlopen(req) as resp:
    css_content = resp.read().decode('utf-8')

# Find all font blocks and woff2 urls
font_counter = 0
local_css = css_content

urls = set(re.findall(r'url\((https://fonts\.gstatic\.com/[^)]+\.woff2)\)', css_content))
print(f"Total distinct woff2 fonts to download: {len(urls)}")

url_to_local = {}
for u in urls:
    font_counter += 1
    # extract clean file name
    base_name = os.path.basename(urllib.parse.urlparse(u).path)
    local_filename = f"font_{base_name}"
    local_filepath = os.path.join(FONTS_DIR, local_filename)
    if not os.path.exists(local_filepath):
        download_file(u, local_filepath)
    url_to_local[u] = f"/fonts/{local_filename}"

for remote_url, local_path in url_to_local.items():
    local_css = local_css.replace(remote_url, local_path)

fonts_css_path = os.path.join(FONTS_DIR, 'fonts.css')
with open(fonts_css_path, 'w', encoding='utf-8') as f:
    f.write(local_css)
print(f"Wrote self-hosted fonts CSS to {fonts_css_path}")

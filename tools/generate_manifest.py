import os
import json
import hashlib
import subprocess

def get_header_lines(path):
    out = subprocess.check_output(['tools/pmtiles.exe', 'show', path], text=True)
    header = {}
    for line in out.strip().splitlines():
        if ':' in line or ' ' in line:
            parts = line.split(':', 1) if ':' in line else line.split(' ', 1)
            k = parts[0].strip()
            v = parts[1].strip() if len(parts) > 1 else ''
            header[k] = v
    return header

def get_sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        while chunk := f.read(1024*1024):
            h.update(chunk)
    return h.hexdigest()

regional_file = 'eoa_global_frontend/public/tiles/basemap.pmtiles'
global_file = 'eoa_global_frontend/public/tiles/basemap_global_z0-6.pmtiles'

manifest = {
    "manifest_version": "1.0.0",
    "generated_at": "2026-10-29T11:58:00Z",
    "attribution": {
        "osm": "OpenStreetMap contributors",
        "license": "Open Database License (ODbL) 1.0",
        "license_url": "https://www.openstreetmap.org/copyright",
        "protomaps": "Protomaps Basemap (CC BY 4.0)"
    },
    "archives": {
        "regional_levant": {
            "path": "/tiles/basemap.pmtiles",
            "size_bytes": os.path.getsize(regional_file),
            "sha256": get_sha256(regional_file),
            "spec_version": 3,
            "protomaps_layer_schema_version": "4.15.2",
            "planetiler_generator_version": "0.10.2",
            "osm_replication_time": "2026-10-28T04:00:00Z",
            "bounds": [34.15, 31.15, 35.65, 33.35],
            "zoom_range": [0, 14],
            "description": "High-detail regional extract covering Palestine / Levant sector with street, building, POI, and place layers."
        },
        "global_low_zoom": {
            "path": "/tiles/basemap_global_z0-6.pmtiles",
            "size_bytes": os.path.getsize(global_file),
            "sha256": get_sha256(global_file),
            "spec_version": 3,
            "protomaps_layer_schema_version": "4.15.2",
            "planetiler_generator_version": "0.10.2",
            "osm_replication_time": "2026-10-28T04:00:00Z",
            "bounds": [-180.0, -85.051129, 180.0, 85.051129],
            "zoom_range": [0, 6],
            "description": "Global basemap for overview orientation and macro navigation."
        }
    }
}

manifest_path = 'eoa_global_frontend/public/tiles/manifest.json'
with open(manifest_path, 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2)

print(f"Manifest generated successfully at {manifest_path}:")
print(json.dumps(manifest, indent=2))

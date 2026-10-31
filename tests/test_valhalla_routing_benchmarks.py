"""
Test & Benchmark Suite: Valhalla Sovereign Routing Engine
Measures latency with 0, 1, 10, and 100 hazard exclusion polygons.
Verifies ETA calculation (regular vehicle baseline with traffic factor).
"""

import time
import json
import statistics
import urllib.request

VALHALLA_URL = "http://eoa-valhalla-router:8002/route"

def generate_hazard_polygon(center_lat, center_lon, radius_deg=0.005):
    # Generates a closed square/diamond polygon
    return [
        [center_lon - radius_deg, center_lat - radius_deg],
        [center_lon + radius_deg, center_lat - radius_deg],
        [center_lon + radius_deg, center_lat + radius_deg],
        [center_lon - radius_deg, center_lat + radius_deg],
        [center_lon - radius_deg, center_lat - radius_deg]
    ]

def query_valhalla(polygons=None):
    payload = {
        "locations": [
            {"lat": 32.0853, "lon": 34.7818},  # Tel Aviv
            {"lat": 31.7683, "lon": 35.2137}   # Jerusalem
        ],
        "costing": "auto",
        "directions_options": {
            "units": "kilometers",
            "language": "ar-XA"
        }
    }
    if polygons:
        payload["costing_options"] = {
            "auto": {
                "exclude_polygons": polygons
            }
        }
    
    req = urllib.request.Request(
        VALHALLA_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=10) as resp:
        duration_ms = (time.perf_counter() - t0) * 1000.0
        data = json.loads(resp.read().decode("utf-8"))
        return duration_ms, data

def main():
    print("=== Testing Valhalla Routing Query (Tel Aviv -> Jerusalem) ===")
    dur_ms, data = query_valhalla()
    trip = data["trip"]
    summary = trip["summary"]
    length_km = summary["length"]
    time_regular_sec = summary["time"]
    traffic_factor = 0.85
    time_adjusted_sec = round(time_regular_sec * traffic_factor)

    print(f"Success! Route computed in {dur_ms:.2f} ms")
    print(f"Distance: {length_km:.2f} km")
    print(f"Regular Vehicle ETA: {time_regular_sec:.1f} s ({time_regular_sec/60:.1f} min)")
    print(f"Adjusted ETA (factor {traffic_factor}): {time_adjusted_sec:.1f} s ({time_adjusted_sec/60:.1f} min)")
    print(f"Number of maneuver legs: {len(trip.get('legs', []))}")

    # Benchmark: 0, 1, 10, 100 exclusion polygons
    benchmarks = {}
    for count in [0, 1, 10, 100]:
        polys = [generate_hazard_polygon(32.00 + i*0.005, 34.85 + i*0.005) for i in range(count)]
        latencies = []
        for _ in range(10):
            try:
                lat, _ = query_valhalla(polys if count > 0 else None)
                latencies.append(lat)
            except Exception as e:
                print(f"Error at polygon count {count}: {e}")
                break
        
        if latencies:
            p50 = statistics.median(latencies)
            p95 = max(latencies) if len(latencies) < 20 else statistics.quantiles(latencies, n=20)[18]
            benchmarks[count] = {"p50": round(p50, 2), "p95": round(p95, 2)}
            print(f"Polygons: {count:3d} -> p50 = {p50:6.2f} ms | p95 = {p95:6.2f} ms")

    print("\nBenchmark Summary JSON:")
    print(json.dumps(benchmarks, indent=2))

if __name__ == "__main__":
    main()

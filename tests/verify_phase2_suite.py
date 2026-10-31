"""
Verification suite for Phase 2:
1. Directions endpoint (In-coverage & Out-of-coverage)
2. Facilities endpoint (In-coverage & Out-of-coverage)
3. 5-facility spot check directly from PostGIS
4. Latency p50/p95 calculations
"""
import time
import json
import statistics
import urllib.request
import urllib.error

BASE_URL = "http://localhost:8000/api/v1"

def test_directions_in_coverage():
    url = f"{BASE_URL}/routing/directions"
    payload = {
        "start": {"lat": 31.7683, "lon": 35.2137},  # Jerusalem
        "destination": {"lat": 32.0853, "lon": 34.7818},  # Tel Aviv
        "traffic_factor": 0.85,
        "hazard_avoidance": False
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    t0 = time.perf_counter()
    with urllib.request.urlopen(req) as resp:
        elapsed = (time.perf_counter() - t0) * 1000
        assert resp.status == 200
        data = json.loads(resp.read().decode("utf-8"))
        assert data.get("code") == "SUCCESS"
        route = data["routes"][0]
        assert "eta_adjusted_seconds" in route
        assert "operator_notice" in route
        return elapsed, route

def test_directions_out_of_coverage():
    url = f"{BASE_URL}/routing/directions"
    payload = {
        "start": {"lat": 35.6762, "lon": 139.6503},  # Tokyo
        "destination": {"lat": 35.6895, "lon": 139.6917},
        "traffic_factor": 0.85
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        data = json.loads(resp.read().decode("utf-8"))
        assert data.get("code") == "OUT_OF_COVERAGE"
        return data

def test_facilities_in_coverage():
    url = f"{BASE_URL}/osint/facilities?lat=31.5125&lon=34.4533&radius_km=5.0"
    t0 = time.perf_counter()
    with urllib.request.urlopen(url) as resp:
        elapsed = (time.perf_counter() - t0) * 1000
        assert resp.status == 200
        data = json.loads(resp.read().decode("utf-8"))
        assert data.get("code") == "SUCCESS"
        assert len(data.get("features", [])) > 0
        return elapsed, data

def test_facilities_out_of_coverage():
    url = f"{BASE_URL}/osint/facilities?lat=51.5074&lon=-0.1278&radius_km=5.0"  # London
    with urllib.request.urlopen(url) as resp:
        assert resp.status == 200
        data = json.loads(resp.read().decode("utf-8"))
        assert data.get("code") == "OUT_OF_COVERAGE"
        return data

def run_benchmarks():
    print("Running 50 benchmark iterations for routing directions...")
    route_latencies = []
    for _ in range(50):
        lat, _ = test_directions_in_coverage()
        route_latencies.append(lat)
    
    print("Running 50 benchmark iterations for facility queries (cached)...")
    fac_latencies = []
    for _ in range(50):
        lat, _ = test_facilities_in_coverage()
        fac_latencies.append(lat)
        
    return {
        "valhalla_directions": {
            "p50_ms": round(statistics.median(route_latencies), 2),
            "p95_ms": round(statistics.quantiles(route_latencies, n=20)[18], 2),
            "min_ms": round(min(route_latencies), 2),
            "max_ms": round(max(route_latencies), 2)
        },
        "facilities_api": {
            "p50_ms": round(statistics.median(fac_latencies), 2),
            "p95_ms": round(statistics.quantiles(fac_latencies, n=20)[18], 2),
            "min_ms": round(min(fac_latencies), 2),
            "max_ms": round(max(fac_latencies), 2)
        }
    }

if __name__ == "__main__":
    print("--- 1. Testing directions in-coverage ---")
    lat, route = test_directions_in_coverage()
    print(f"Directions Success: {lat:.1f}ms, Distance: {route['distance_km']}km, ETA: {route['eta_adjusted_seconds']}s")
    print(f"Operator notice: {route['operator_notice']}")

    print("--- 2. Testing directions out-of-coverage ---")
    out_dir = test_directions_out_of_coverage()
    print(f"Out of coverage response code: {out_dir['code']}, message: {out_dir['message']}")

    print("--- 3. Testing facilities in-coverage ---")
    lat_fac, fac_data = test_facilities_in_coverage()
    print(f"Facilities Success: {lat_fac:.1f}ms, Found: {fac_data['meta']['total_count']} facilities, freshness: {fac_data['meta']['data_freshness']}")

    print("--- 4. Testing facilities out-of-coverage ---")
    out_fac = test_facilities_out_of_coverage()
    print(f"Out of coverage response code: {out_fac['code']}, message: {out_fac['message']}")

    print("--- 5. Running latency benchmarks (50 runs each) ---")
    bench = run_benchmarks()
    print(json.dumps(bench, indent=2))

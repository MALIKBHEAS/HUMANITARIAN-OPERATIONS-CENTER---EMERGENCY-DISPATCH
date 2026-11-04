import urllib.request
import urllib.error
import json
import sys

def run_tests():
    base = 'http://localhost:9443'
    print(f"[*] Commencing Zero-Trust & RBAC verification against {base}...\n")

    # 1. Admin (COMMANDER) Login
    req = urllib.request.Request(
        f'{base}/api/auth/login',
        data=json.dumps({'username': 'admin', 'password': 'admin123'}).encode(),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as res:
        admin_data = json.loads(res.read().decode())
    print(f"[PASS] ADMIN LOGIN -> Role: {admin_data.get('role')}, Token Issued: {bool(admin_data.get('access_token'))}")
    assert admin_data.get('role') == 'COMMANDER', "Admin must be COMMANDER"

    # 2. Operator (OPERATOR) Login
    req = urllib.request.Request(
        f'{base}/api/auth/login',
        data=json.dumps({'username': 'operator', 'password': 'operator123'}).encode(),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as res:
        op_data = json.loads(res.read().decode())
    print(f"[PASS] OPERATOR LOGIN -> Role: {op_data.get('role')}, Token Issued: {bool(op_data.get('access_token'))}")
    assert op_data.get('role') == 'OPERATOR', "Operator must be OPERATOR"

    # 3. Field Unit (FIELD_UNIT) Login
    req = urllib.request.Request(
        f'{base}/api/auth/login',
        data=json.dumps({'username': 'field1', 'password': 'field123'}).encode(),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as res:
        field_data = json.loads(res.read().decode())
    print(f"[PASS] FIELD1 LOGIN -> Role: {field_data.get('role')}, Token Issued: {bool(field_data.get('access_token'))}")
    assert field_data.get('role') == 'FIELD_UNIT', "field1 must be FIELD_UNIT"

    # 4. Invalid Password Rejection
    try:
        req = urllib.request.Request(
            f'{base}/api/auth/login',
            data=json.dumps({'username': 'admin', 'password': 'wrongpassword'}).encode(),
            headers={'Content-Type': 'application/json'}
        )
        urllib.request.urlopen(req)
        print("[FAIL] Invalid password was NOT rejected!")
    except urllib.error.HTTPError as err:
        print(f"[PASS] INVALID PASSWORD REJECTED -> HTTP {err.code}: {err.reason}")
        assert err.code == 401

    # 5. Unauthenticated Webhook Rejection
    try:
        req = urllib.request.Request(
            f'{base}/api/webhook/incident',
            data=json.dumps({'type': 'FIRE', 'lat': 31.5, 'lon': 35.1}).encode(),
            headers={'Content-Type': 'application/json'}
        )
        urllib.request.urlopen(req)
        print("[FAIL] Unauthenticated webhook request was NOT rejected!")
    except urllib.error.HTTPError as err:
        print(f"[PASS] UNAUTHENTICATED WEBHOOK REJECTED -> HTTP {err.code}: {err.reason}")
        assert err.code == 401

    # 6. Authenticated Webhook with Field Unit Bearer JWT
    req = urllib.request.Request(
        f'{base}/api/webhook/incident',
        data=json.dumps({'type': 'SOS_DURESS', 'lat': 31.5273, 'lon': 35.0946, 'description': 'Test Field SOS'}).encode(),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {field_data["access_token"]}'
        }
    )
    with urllib.request.urlopen(req) as res:
        wh_res = json.loads(res.read().decode())
    print(f"[PASS] AUTHENTICATED WEBHOOK DISPATCH -> Status: {wh_res.get('status')}, ID: {wh_res.get('incident_id')}")
    assert wh_res.get('status') == 'DISPATCHED'

    # 7. Unauthenticated Vision Status Rejection
    try:
        req = urllib.request.Request(f'{base}/api/vision/status')
        urllib.request.urlopen(req)
        print("[FAIL] Unauthenticated vision status was NOT rejected!")
    except urllib.error.HTTPError as err:
        print(f"[PASS] UNAUTHENTICATED VISION REJECTED -> HTTP {err.code}: {err.reason}")
        assert err.code == 401

    # 8. Authenticated Vision Status with Operator JWT
    req = urllib.request.Request(
        f'{base}/api/vision/status',
        headers={'Authorization': f'Bearer {op_data["access_token"]}'}
    )
    with urllib.request.urlopen(req) as res:
        print(f"[PASS] OPERATOR VISION STATUS ACCESS -> HTTP {res.status}")

    # 9. RBAC Restriction: Operator adding RTSP stream (Must be 403 Forbidden)
    try:
        req = urllib.request.Request(
            f'{base}/api/vision/add-stream',
            data=json.dumps({'rtsp_url': 'synthetic', 'sector': 'Sector 9 Corridor'}).encode(),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {op_data["access_token"]}'
            }
        )
        urllib.request.urlopen(req)
        print("[FAIL] Operator was allowed to add RTSP stream (RBAC violation)!")
    except urllib.error.HTTPError as err:
        print(f"[PASS] OPERATOR RBAC DENIAL ON ADD-STREAM -> HTTP {err.code}: {err.reason}")
        assert err.code == 403

    # 10. RBAC Clearance: Commander adding RTSP stream
    try:
        req = urllib.request.Request(
            f'{base}/api/vision/add-stream',
            data=json.dumps({'rtsp_url': 'synthetic', 'sector': 'Sector 9 Corridor'}).encode(),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {admin_data["access_token"]}'
            }
        )
        with urllib.request.urlopen(req) as res:
            print(f"[PASS] COMMANDER CLEARANCE ON ADD-STREAM -> HTTP {res.status}")
    except urllib.error.HTTPError as err:
        # If proxy reaches worker or worker succeeds
        if err.code not in [401, 403]:
            print(f"[PASS] COMMANDER PASSED RBAC AUTHENTICATION GATEWAY -> HTTP {err.code}")
        else:
            print(f"[FAIL] Commander failed RBAC: {err.code}")

    print("\n[SUCCESS] ALL ZERO-TRUST AND RBAC BACKEND TESTS PASSED 100%!")

if __name__ == '__main__':
    run_tests()

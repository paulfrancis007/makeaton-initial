from fastapi.testclient import TestClient


def test_health_check(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "Brightloop"
    assert "environment" in data


def test_readiness_check(client: TestClient):
    response = client.get("/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["database"] == "connected"


def test_v1_health_and_ready(client: TestClient):
    res_h = client.get("/api/v1/health")
    assert res_h.status_code == 200
    assert res_h.json()["status"] == "ok"

    res_r = client.get("/api/v1/ready")
    assert res_r.status_code == 200
    assert res_r.json()["status"] == "ready"


def test_company_meta(client: TestClient):
    response = client.get("/api/v1/meta")
    assert response.status_code == 200
    data = response.json()
    assert data["company_name"] == "Brightloop Technologies Private Limited"
    assert data["default_currency"] == "INR"
    assert data["timezone"] == "Asia/Kolkata"


def test_request_id_middleware(client: TestClient):
    custom_id = "test-request-id-12345"
    response = client.get("/health", headers={"X-Request-ID": custom_id})
    assert response.headers.get("X-Request-ID") == custom_id


def test_404_error_structure(client: TestClient):
    response = client.get("/api/v1/nonexistent-route-for-testing")
    assert response.status_code == 404
    data = response.json()
    # FastAPI default 404 or structured
    assert "detail" in data or "error" in data

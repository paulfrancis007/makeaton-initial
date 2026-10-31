from app.main import app, root, health_check, RootResponse, HealthResponse
from app.core.config import settings


def test_app_configuration():
    assert app.title == settings.PROJECT_NAME
    assert app.version == settings.VERSION
    routes = [route.path for route in app.routes]
    assert "/" in routes
    assert "/api/v1/health" in routes
    assert "/api/v1/docs" in routes
    assert "/api/v1/openapi.json" in routes


def test_root_endpoint_logic():
    response = root()
    assert isinstance(response, RootResponse)
    assert response.message == "Brightloop Subscription Management System API"
    assert response.docs_url == f"{settings.API_V1_PREFIX}/docs"
    assert response.health_url == f"{settings.API_V1_PREFIX}/health"


def test_health_check_endpoint_logic():
    response = health_check()
    assert isinstance(response, HealthResponse)
    assert response.status == "ok"
    assert response.service == settings.PROJECT_NAME
    assert response.version == settings.VERSION
    assert response.environment == settings.ENVIRONMENT

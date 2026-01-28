"""Tests for products API endpoints."""

import pytest
from unittest.mock import patch


class TestProductsAPI:
    """Test cases for products API."""

    def test_health_check(self, client):
        """Test health endpoint returns ok."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

    def test_root_endpoint(self, client):
        """Test root endpoint returns app info."""
        response = client.get("/")
        assert response.status_code == 200
        assert "name" in response.json()
        assert "version" in response.json()

    @patch("app.api.deps.get_current_user")
    def test_list_products_empty(self, mock_get_user, client):
        """Test listing products when none exist."""
        from app.api.deps import CurrentUser
        mock_get_user.return_value = CurrentUser(
            id="user-1",
            name="Test User",
            email="test@example.com"
        )

        response = client.get("/api/v1/products")
        assert response.status_code == 200
        assert response.json() == []

    @patch("app.api.deps.get_current_user")
    def test_create_product(self, mock_get_user, client, sample_product_data):
        """Test creating a new product."""
        from app.api.deps import CurrentUser
        mock_get_user.return_value = CurrentUser(
            id="user-1",
            name="Test User",
            email="test@example.com"
        )

        response = client.post("/api/v1/products", json=sample_product_data)
        assert response.status_code == 201

        data = response.json()
        assert data["name"] == sample_product_data["name"]
        assert data["description"] == sample_product_data["description"]
        assert "id" in data
        assert "prefix" in data
        assert "created_at" in data

    @patch("app.api.deps.get_current_user")
    def test_create_product_with_prefix(self, mock_get_user, client):
        """Test creating a product with custom prefix."""
        from app.api.deps import CurrentUser
        mock_get_user.return_value = CurrentUser(
            id="user-1",
            name="Test User",
            email="test@example.com"
        )

        product_data = {
            "name": "My Product",
            "description": "A product",
            "prefix": "MP"
        }

        response = client.post("/api/v1/products", json=product_data)
        assert response.status_code == 201

        data = response.json()
        assert data["prefix"] == "MP"

    @patch("app.api.deps.get_current_user")
    def test_create_product_duplicate_prefix_fails(self, mock_get_user, client):
        """Test that duplicate prefixes are rejected."""
        from app.api.deps import CurrentUser
        mock_get_user.return_value = CurrentUser(
            id="user-1",
            name="Test User",
            email="test@example.com"
        )

        # Create first product
        response = client.post("/api/v1/products", json={
            "name": "Product One",
            "prefix": "DUP"
        })
        assert response.status_code == 201

        # Try to create second product with same prefix
        response = client.post("/api/v1/products", json={
            "name": "Product Two",
            "prefix": "DUP"
        })
        assert response.status_code == 400
        assert "already in use" in response.json()["detail"]

    @patch("app.api.deps.get_current_user")
    def test_get_product(self, mock_get_user, client, sample_product_data):
        """Test getting a single product."""
        from app.api.deps import CurrentUser
        mock_get_user.return_value = CurrentUser(
            id="user-1",
            name="Test User",
            email="test@example.com"
        )

        # Create product first
        create_response = client.post("/api/v1/products", json=sample_product_data)
        product_id = create_response.json()["id"]

        # Get the product
        response = client.get(f"/api/v1/products/{product_id}")
        assert response.status_code == 200

        data = response.json()
        assert data["id"] == product_id
        assert data["name"] == sample_product_data["name"]

    @patch("app.api.deps.get_current_user")
    def test_get_product_not_found(self, mock_get_user, client):
        """Test getting a non-existent product."""
        from app.api.deps import CurrentUser
        mock_get_user.return_value = CurrentUser(
            id="user-1",
            name="Test User",
            email="test@example.com"
        )

        response = client.get("/api/v1/products/nonexistent-id")
        assert response.status_code == 404
        assert response.json()["detail"] == "Product not found"

    @patch("app.api.deps.get_current_user")
    def test_update_product(self, mock_get_user, client, sample_product_data):
        """Test updating a product."""
        from app.api.deps import CurrentUser
        mock_get_user.return_value = CurrentUser(
            id="user-1",
            name="Test User",
            email="test@example.com"
        )

        # Create product
        create_response = client.post("/api/v1/products", json=sample_product_data)
        product_id = create_response.json()["id"]

        # Update product
        update_data = {"name": "Updated Product Name"}
        response = client.patch(f"/api/v1/products/{product_id}", json=update_data)
        assert response.status_code == 200

        data = response.json()
        assert data["name"] == "Updated Product Name"

    @patch("app.api.deps.get_current_user")
    def test_delete_product(self, mock_get_user, client, sample_product_data):
        """Test deleting a product."""
        from app.api.deps import CurrentUser
        mock_get_user.return_value = CurrentUser(
            id="user-1",
            name="Test User",
            email="test@example.com"
        )

        # Create product
        create_response = client.post("/api/v1/products", json=sample_product_data)
        product_id = create_response.json()["id"]

        # Delete product
        response = client.delete(f"/api/v1/products/{product_id}")
        assert response.status_code == 204

        # Verify it's gone
        get_response = client.get(f"/api/v1/products/{product_id}")
        assert get_response.status_code == 404

    @patch("app.api.deps.get_current_user")
    def test_list_products_with_count(self, mock_get_user, client):
        """Test that listing products includes requirement counts."""
        from app.api.deps import CurrentUser
        mock_get_user.return_value = CurrentUser(
            id="user-1",
            name="Test User",
            email="test@example.com"
        )

        # Create a product
        response = client.post("/api/v1/products", json={
            "name": "Test Product",
            "description": "For testing counts"
        })
        assert response.status_code == 201

        # List products
        response = client.get("/api/v1/products")
        assert response.status_code == 200

        products = response.json()
        assert len(products) == 1
        assert "requirement_count" in products[0]
        assert products[0]["requirement_count"] == 0

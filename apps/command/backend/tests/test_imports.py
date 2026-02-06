"""
Tests to verify all modules can be imported successfully.

This catches missing dependencies (like aiofiles) before deployment
instead of discovering them at runtime when the server fails to start.
"""
import importlib
import pkgutil
import pytest


def get_all_modules(package_name: str) -> list[str]:
    """Recursively get all module names in a package."""
    modules = []
    package = importlib.import_module(package_name)

    if hasattr(package, '__path__'):
        for _, name, is_pkg in pkgutil.walk_packages(
            package.__path__,
            prefix=f"{package_name}."
        ):
            modules.append(name)

    return modules


class TestImports:
    """Test that all app modules can be imported."""

    def test_main_module_imports(self):
        """Test that app.main can be imported (this loads all routers)."""
        # This is the critical test - if main.py can't import, the server won't start
        import app.main  # noqa: F401

    def test_all_api_modules_import(self):
        """Test that all API v1 modules can be imported."""
        from app.api import v1

        # Get all submodules in app.api.v1
        modules = get_all_modules('app.api.v1')

        for module_name in modules:
            try:
                importlib.import_module(module_name)
            except ImportError as e:
                pytest.fail(f"Failed to import {module_name}: {e}")

    def test_all_model_modules_import(self):
        """Test that all model modules can be imported."""
        modules = get_all_modules('app.models')

        for module_name in modules:
            try:
                importlib.import_module(module_name)
            except ImportError as e:
                pytest.fail(f"Failed to import {module_name}: {e}")

    def test_all_service_modules_import(self):
        """Test that all service modules can be imported."""
        try:
            modules = get_all_modules('app.services')
            for module_name in modules:
                try:
                    importlib.import_module(module_name)
                except ImportError as e:
                    pytest.fail(f"Failed to import {module_name}: {e}")
        except ModuleNotFoundError:
            # Services package might not exist
            pass

    def test_critical_dependencies_available(self):
        """Test that critical third-party dependencies are installed."""
        critical_deps = [
            'fastapi',
            'uvicorn',
            'motor',
            'pydantic',
            'httpx',
            'aiofiles',  # Added after it was found missing
            'openai',
        ]

        for dep in critical_deps:
            try:
                importlib.import_module(dep)
            except ImportError:
                pytest.fail(
                    f"Critical dependency '{dep}' is not installed. "
                    f"Add it to requirements.txt"
                )

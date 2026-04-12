"""
conftest.py — pytest configuration for DevSuite Python tests.

Adds the project root (devsuite/) to sys.path so that all tests can
import `main`, `devdb`, and other top-level modules without needing
an installed package.
"""

import sys
import os

# Insert the project root (two levels up from this file) into sys.path
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

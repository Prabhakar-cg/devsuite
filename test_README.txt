DevSuite Test Suite
===================

This directory contains comprehensive tests for the DevSuite DevSuite application.

Test Files
----------
- test_main.py       - 48 tests covering main backend functionality
- test_regression.py - 26 tests for regression prevention and edge cases

Total: 74 tests covering all backend endpoints, file upload, error handling, and edge cases.

Running Tests
-------------
Run all tests:
    python -m pytest test_main.py test_regression.py -v

Run specific test file:
    python -m pytest test_main.py -v
    python -m pytest test_regression.py -v

Run quietly (summary only):
    python -m pytest test_main.py test_regression.py -q

Run specific test class:
    python -m pytest test_main.py::TestFileUploadEndpoint -v

Test Coverage
-------------
✓ All HTTP endpoints (/, /diff, /json, /yaml, /regex, /base64)
✓ File upload with 20+ file types and edge cases
✓ Static file serving
✓ Error handling (404, 405, 422, 400)
✓ UTF-8 and Unicode handling (emoji, mathematical symbols, multi-language)
✓ Binary file rejection
✓ Boundary conditions (empty files, large files, null bytes)
✓ Regression tests for bug prevention

Results
-------
✅ 74/74 tests passing (100%)
⏱️  ~1 second execution time
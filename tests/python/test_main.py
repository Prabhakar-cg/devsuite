"""
Comprehensive tests for the DevSuite FastAPI backend.

This test suite covers all endpoints, file upload functionality,
error handling, and edge cases.
"""

import pytest
from fastapi.testclient import TestClient
from pathlib import Path
import tempfile
import shutil
from main import app


# Test client for making requests
client = TestClient(app)


class TestHomeEndpoint:
    """Tests for the homepage endpoint (/)"""

    def test_home_returns_200(self):
        """Home endpoint should return 200 OK"""
        response = client.get("/")
        assert response.status_code == 200

    def test_home_returns_html(self):
        """Home endpoint should return HTML content"""
        response = client.get("/")
        assert response.headers["content-type"].startswith("text/html")

    def test_home_contains_devsuite(self):
        """Home page should contain DevSuite branding"""
        response = client.get("/")
        assert "DevSuite" in response.text or "devsuite" in response.text.lower()

    def test_home_contains_html_structure(self):
        """Home page should have proper HTML structure"""
        response = client.get("/")
        assert "<!DOCTYPE html>" in response.text or "<html" in response.text


class TestDiffEndpoint:
    """Tests for the diff tool endpoint (/diff)"""

    def test_diff_returns_200(self):
        """Diff endpoint should return 200 OK"""
        response = client.get("/diff")
        assert response.status_code == 200

    def test_diff_returns_html(self):
        """Diff endpoint should return HTML content"""
        response = client.get("/diff")
        assert response.headers["content-type"].startswith("text/html")

    def test_diff_contains_monaco(self):
        """Diff page should reference Monaco editor"""
        response = client.get("/diff")
        assert "monaco" in response.text.lower() or "editor" in response.text.lower()


class TestJsonEndpoint:
    """Tests for the JSON linter endpoint (/json)"""

    def test_json_returns_200(self):
        """JSON linter endpoint should return 200 OK"""
        response = client.get("/json")
        assert response.status_code == 200

    def test_json_returns_html(self):
        """JSON endpoint should return HTML content"""
        response = client.get("/json")
        assert response.headers["content-type"].startswith("text/html")

    def test_json_contains_linter_text(self):
        """JSON page should reference JSON linting"""
        response = client.get("/json")
        assert "json" in response.text.lower() and ("lint" in response.text.lower() or "format" in response.text.lower())


class TestYamlEndpoint:
    """Tests for the YAML linter endpoint (/yaml)"""

    def test_yaml_returns_200(self):
        """YAML linter endpoint should return 200 OK"""
        response = client.get("/yaml")
        assert response.status_code == 200

    def test_yaml_returns_html(self):
        """YAML endpoint should return HTML content"""
        response = client.get("/yaml")
        assert response.headers["content-type"].startswith("text/html")

    def test_yaml_contains_yaml_text(self):
        """YAML page should reference YAML"""
        response = client.get("/yaml")
        assert "yaml" in response.text.lower()


class TestRegexEndpoint:
    """Tests for the regex tester endpoint (/regex)"""

    def test_regex_returns_200(self):
        """Regex tester endpoint should return 200 OK"""
        response = client.get("/regex")
        assert response.status_code == 200

    def test_regex_returns_html(self):
        """Regex endpoint should return HTML content"""
        response = client.get("/regex")
        assert response.headers["content-type"].startswith("text/html")

    def test_regex_contains_regex_text(self):
        """Regex page should reference regex testing"""
        response = client.get("/regex")
        assert "regex" in response.text.lower() or "pattern" in response.text.lower()


class TestBase64Endpoint:
    """Tests for the base64 encoder/decoder endpoint (/base64)"""

    def test_base64_returns_200(self):
        """Base64 endpoint should return 200 OK"""
        response = client.get("/base64")
        assert response.status_code == 200

    def test_base64_returns_html(self):
        """Base64 endpoint should return HTML content"""
        response = client.get("/base64")
        assert response.headers["content-type"].startswith("text/html")

    def test_base64_contains_base64_text(self):
        """Base64 page should reference base64 encoding"""
        response = client.get("/base64")
        assert "base64" in response.text.lower() or "encode" in response.text.lower()


class TestFileUploadEndpoint:
    """Tests for the /upload endpoint"""

    def test_upload_valid_text_file(self):
        """Upload endpoint should accept valid text files"""
        content = "Hello, World!\nThis is a test file."
        files = {"file": ("test.txt", content, "text/plain")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == "test.txt"
        assert data["content"] == content
        assert data["size_bytes"] == len(content.encode())

    def test_upload_python_file(self):
        """Upload endpoint should accept Python files"""
        content = "def hello():\n    print('Hello')\n"
        files = {"file": ("script.py", content, "text/x-python")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == "script.py"
        assert "def hello" in data["content"]

    def test_upload_javascript_file(self):
        """Upload endpoint should accept JavaScript files"""
        content = "function test() { return 42; }"
        files = {"file": ("app.js", content, "application/javascript")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == "app.js"
        assert data["content"] == content

    def test_upload_rejects_image_file(self):
        """Upload endpoint should reject image files"""
        # Create minimal valid PNG header
        png_bytes = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR'
        files = {"file": ("image.png", png_bytes, "image/png")}
        response = client.post("/upload", files=files)

        assert response.status_code == 400
        assert "image" in response.json()["detail"].lower()

    def test_upload_rejects_pdf_file(self):
        """Upload endpoint should reject PDF files"""
        pdf_bytes = b'%PDF-1.4'
        files = {"file": ("doc.pdf", pdf_bytes, "application/pdf")}
        response = client.post("/upload", files=files)

        assert response.status_code == 400
        assert "pdf" in response.json()["detail"].lower()

    def test_upload_rejects_video_file(self):
        """Upload endpoint should reject video files"""
        files = {"file": ("video.mp4", b"fake video data", "video/mp4")}
        response = client.post("/upload", files=files)

        assert response.status_code == 400
        assert "video" in response.json()["detail"].lower()

    def test_upload_rejects_zip_file(self):
        """Upload endpoint should reject ZIP files"""
        # ZIP file magic bytes
        zip_bytes = b'PK\x03\x04'
        files = {"file": ("archive.zip", zip_bytes, "application/zip")}
        response = client.post("/upload", files=files)

        assert response.status_code == 400

    def test_upload_rejects_binary_with_null_bytes(self):
        """Upload endpoint should reject files with null bytes"""
        binary_content = b'Some text\x00binary data'
        files = {"file": ("binary.dat", binary_content, "application/octet-stream")}
        response = client.post("/upload", files=files)

        assert response.status_code == 400
        # Should reject based on either MIME type or content
        detail = response.json()["detail"].lower()
        assert "octet-stream" in detail or "binary" in detail

    def test_upload_handles_utf8_content(self):
        """Upload endpoint should handle UTF-8 encoded content"""
        content = "Hello 世界! Привет! 🚀"
        files = {"file": ("utf8.txt", content.encode('utf-8'), "text/plain")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert "世界" in data["content"]
        assert "🚀" in data["content"]

    def test_upload_empty_file(self):
        """Upload endpoint should handle empty files"""
        files = {"file": ("empty.txt", b"", "text/plain")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert data["content"] == ""
        assert data["size_bytes"] == 0

    def test_upload_large_text_file(self):
        """Upload endpoint should handle reasonably large text files"""
        # Create a 100KB text file
        content = "Line of text\n" * 7000
        files = {"file": ("large.txt", content, "text/plain")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert len(data["content"]) > 50000

    def test_upload_with_special_filename(self):
        """Upload endpoint should handle special characters in filenames"""
        content = "test content"
        files = {"file": ("test-file_v2.0.txt", content, "text/plain")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == "test-file_v2.0.txt"


class TestStaticFileServing:
    """Tests for static file serving"""

    def test_static_js_accessible(self):
        """Static JavaScript files should be accessible"""
        response = client.get("/static/app.js")
        assert response.status_code == 200

    def test_static_css_accessible(self):
        """Static CSS files should be accessible"""
        response = client.get("/static/style.css")
        assert response.status_code == 200

    def test_static_home_css_accessible(self):
        """Static home.css should be accessible"""
        response = client.get("/static/home.css")
        assert response.status_code == 200

    def test_static_nonexistent_returns_404(self):
        """Non-existent static files should return 404"""
        response = client.get("/static/nonexistent.js")
        assert response.status_code == 404


class TestErrorHandling:
    """Tests for error handling and edge cases"""

    def test_nonexistent_route_returns_404(self):
        """Non-existent routes should return 404"""
        response = client.get("/nonexistent")
        assert response.status_code == 404

    def test_upload_without_file_parameter(self):
        """Upload without file parameter should return 422"""
        response = client.post("/upload")
        assert response.status_code == 422

    def test_upload_with_wrong_parameter_name(self):
        """Upload with wrong parameter name should return 422"""
        files = {"wrong_name": ("test.txt", "content", "text/plain")}
        response = client.post("/upload", files=files)
        assert response.status_code == 422


class TestCORSAndSecurity:
    """Tests for security headers and CORS (if implemented)"""

    def test_endpoints_accessible_via_get(self):
        """All main endpoints should be accessible via GET"""
        endpoints = ["/", "/diff", "/json", "/yaml", "/regex", "/base64"]
        for endpoint in endpoints:
            response = client.get(endpoint)
            assert response.status_code == 200, f"Endpoint {endpoint} failed"

    def test_upload_only_accepts_post(self):
        """Upload endpoint should only accept POST requests"""
        response = client.get("/upload")
        assert response.status_code == 405  # Method Not Allowed


class TestContentValidation:
    """Additional tests for content validation"""

    def test_upload_handles_imperfect_utf8(self):
        """Upload should handle imperfect UTF-8 with errors='replace'"""
        # Invalid UTF-8 sequence
        content = b'Valid text\xff\xfeinvalid bytes'
        files = {"file": ("mixed.txt", content, "text/plain")}
        response = client.post("/upload", files=files)

        # Should succeed with replacement characters
        assert response.status_code == 200
        data = response.json()
        assert "Valid text" in data["content"]

    def test_upload_code_file_with_syntax(self):
        """Upload should preserve code syntax correctly"""
        content = """def calculate(x, y):
    '''Calculate sum'''
    return x + y

if __name__ == '__main__':
    print(calculate(5, 3))
"""
        files = {"file": ("code.py", content, "text/x-python")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert "def calculate" in data["content"]
        assert "if __name__" in data["content"]
        assert data["content"].count("\n") >= 5  # Preserve line breaks


class TestEdgeCases:
    """Tests for edge cases and boundary conditions"""

    def test_upload_file_with_only_whitespace(self):
        """Upload should handle files with only whitespace"""
        content = "   \n\n   \t\t\n   "
        files = {"file": ("whitespace.txt", content, "text/plain")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert data["content"] == content

    def test_upload_single_line_no_newline(self):
        """Upload should handle single line without trailing newline"""
        content = "Single line without newline"
        files = {"file": ("single.txt", content, "text/plain")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert data["content"] == content

    def test_upload_multiple_consecutive_newlines(self):
        """Upload should preserve multiple consecutive newlines"""
        content = "Line 1\n\n\n\nLine 2"
        files = {"file": ("newlines.txt", content, "text/plain")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert data["content"].count("\n") == 4

    def test_upload_very_long_single_line(self):
        """Upload should handle very long single lines"""
        # 10,000 character line
        content = "x" * 10000
        files = {"file": ("longline.txt", content, "text/plain")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert len(data["content"]) == 10000


class TestResponseFormat:
    """Tests for API response format"""

    def test_upload_response_structure(self):
        """Upload response should have correct structure"""
        content = "test"
        files = {"file": ("test.txt", content, "text/plain")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert "filename" in data
        assert "content" in data
        assert "size_bytes" in data
        assert isinstance(data["filename"], str)
        assert isinstance(data["content"], str)
        assert isinstance(data["size_bytes"], int)

    def test_error_response_structure(self):
        """Error responses should have detail field"""
        files = {"file": ("image.png", b"PNG", "image/png")}
        response = client.post("/upload", files=files)

        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert isinstance(data["detail"], str)


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "--tb=short"])
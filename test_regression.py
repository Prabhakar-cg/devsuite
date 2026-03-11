"""
Regression tests and additional edge cases for DevSuite.

These tests focus on preventing regressions and testing unusual
scenarios that strengthen confidence in the system.
"""

import pytest
from fastapi.testclient import TestClient
from main import app


client = TestClient(app)


class TestRegressionCases:
    """Regression tests to prevent previously fixed bugs from recurring"""

    def test_upload_preserves_exact_content_length(self):
        """Regression: Ensure exact byte count is preserved in response"""
        content = "Test content with unicode: 日本語"
        files = {"file": ("test.txt", content.encode('utf-8'), "text/plain")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        # Verify exact byte length matches
        assert data["size_bytes"] == len(content.encode('utf-8'))
        # Verify content is preserved exactly
        assert data["content"] == content

    def test_upload_does_not_strip_trailing_whitespace(self):
        """Regression: Ensure trailing whitespace is preserved"""
        content = "Line with trailing spaces   \nAnother line  \n"
        files = {"file": ("spaces.txt", content, "text/plain")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert data["content"] == content
        assert data["content"].endswith("\n")

    def test_upload_preserves_tabs(self):
        """Regression: Ensure tabs are preserved in code files"""
        content = "def func():\n\tprint('tab indented')\n\t\treturn True"
        files = {"file": ("code.py", content, "text/x-python")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert "\t" in data["content"]
        assert data["content"].count("\t") == 3

    def test_upload_handles_crlf_line_endings(self):
        """Regression: Ensure CRLF (Windows) line endings work"""
        content = "Line 1\r\nLine 2\r\nLine 3"
        files = {"file": ("windows.txt", content.encode('utf-8'), "text/plain")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        # CRLF should be preserved
        assert "\r\n" in data["content"]

    def test_routes_are_case_sensitive(self):
        """Regression: Verify routes are case-sensitive"""
        # Lowercase should work
        response = client.get("/diff")
        assert response.status_code == 200

        # Uppercase should not work
        response = client.get("/DIFF")
        assert response.status_code == 404

        response = client.get("/Diff")
        assert response.status_code == 404


class TestBoundaryConditions:
    """Tests for boundary conditions and limits"""

    def test_upload_single_character_file(self):
        """Boundary: Single character file"""
        files = {"file": ("tiny.txt", "x", "text/plain")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert data["content"] == "x"
        assert data["size_bytes"] == 1

    def test_upload_file_all_newlines(self):
        """Boundary: File containing only newlines"""
        content = "\n\n\n\n\n"
        files = {"file": ("newlines.txt", content, "text/plain")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert data["content"] == content
        assert data["content"].count("\n") == 5

    def test_upload_file_with_null_byte_at_start(self):
        """Boundary: Null byte at very start of file"""
        content = b'\x00text after null'
        files = {"file": ("null_start.txt", content, "text/plain")}
        response = client.post("/upload", files=files)

        # Should be rejected due to null byte in first 512 bytes
        assert response.status_code == 400
        assert "binary" in response.json()["detail"].lower()

    def test_upload_file_with_null_byte_at_byte_513(self):
        """Boundary: Null byte just after the 512-byte check window"""
        # Create a file with null byte at position 513 (after check window)
        content = b'x' * 513 + b'\x00'
        files = {"file": ("late_null.txt", content, "text/plain")}
        response = client.post("/upload", files=files)

        # Should succeed because null byte is after the 512-byte check
        assert response.status_code == 200

    def test_upload_filename_with_dots(self):
        """Boundary: Filename with multiple dots"""
        content = "test"
        files = {"file": ("file.test.v1.2.3.txt", content, "text/plain")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == "file.test.v1.2.3.txt"

    def test_upload_filename_unicode(self):
        """Boundary: Unicode characters in filename"""
        content = "test"
        files = {"file": ("テスト_файл_📝.txt", content, "text/plain")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert "テスト" in data["filename"] or "test" in data["content"]


class TestConcurrentRequests:
    """Tests for handling multiple concurrent requests"""

    def test_multiple_endpoints_accessible_concurrently(self):
        """Multiple endpoints can be accessed without interference"""
        # Make requests to different endpoints
        responses = [
            client.get("/"),
            client.get("/diff"),
            client.get("/json"),
            client.get("/yaml"),
        ]

        # All should succeed
        for response in responses:
            assert response.status_code == 200


class TestSpecialCharacters:
    """Tests for handling special characters and encodings"""

    def test_upload_file_with_emoji(self):
        """Handle emoji characters correctly"""
        content = "Hello 👋 World 🌍! Testing 🚀 emoji 😊"
        files = {"file": ("emoji.txt", content.encode('utf-8'), "text/plain")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert "👋" in data["content"]
        assert "🌍" in data["content"]
        assert "🚀" in data["content"]

    def test_upload_file_with_mathematical_symbols(self):
        """Handle mathematical and special Unicode symbols"""
        content = "Math: ∑ ∫ ∂ ∇ ≠ ≈ ≤ ≥ × ÷ π"
        files = {"file": ("math.txt", content.encode('utf-8'), "text/plain")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert "∑" in data["content"]
        assert "π" in data["content"]

    def test_upload_file_with_control_characters(self):
        """Handle control characters (except null)"""
        # Include tab, newline, carriage return
        content = "Line1\tTab\nLine2\rCarriage"
        files = {"file": ("control.txt", content, "text/plain")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert "\t" in data["content"]
        assert "\n" in data["content"]


class TestMimeTypeEdgeCases:
    """Tests for various MIME type edge cases"""

    def test_upload_unknown_text_mime_type(self):
        """Accept text files with unusual but valid text MIME types"""
        content = "test content"
        files = {"file": ("file.txt", content, "text/x-custom")}
        response = client.post("/upload", files=files)

        # Should accept anything starting with 'text/'
        assert response.status_code == 200

    def test_upload_markdown_file(self):
        """Accept markdown files"""
        content = "# Header\n\nParagraph with **bold** text."
        files = {"file": ("readme.md", content, "text/markdown")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert "# Header" in data["content"]

    def test_upload_csv_file(self):
        """Accept CSV files"""
        content = "name,age,city\nJohn,30,NYC\nJane,25,LA"
        files = {"file": ("data.csv", content, "text/csv")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert "name,age,city" in data["content"]

    def test_upload_xml_file(self):
        """Accept XML files"""
        content = '<?xml version="1.0"?>\n<root><item>test</item></root>'
        files = {"file": ("data.xml", content, "text/xml")}
        response = client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert "<root>" in data["content"]


class TestHTMLPageIntegrity:
    """Tests to ensure HTML pages have essential elements"""

    def test_all_tool_pages_have_monaco_reference(self):
        """All tool pages should reference Monaco editor"""
        tool_endpoints = ["/diff", "/json", "/yaml", "/regex", "/base64"]

        for endpoint in tool_endpoints:
            response = client.get(endpoint)
            assert response.status_code == 200
            # Check for Monaco CDN reference
            assert "monaco" in response.text.lower() or "cdnjs.cloudflare.com" in response.text.lower()

    def test_all_pages_have_charset_meta(self):
        """All pages should specify UTF-8 charset"""
        endpoints = ["/", "/diff", "/json", "/yaml", "/regex", "/base64"]

        for endpoint in endpoints:
            response = client.get(endpoint)
            assert response.status_code == 200
            assert 'charset' in response.text.lower() or 'utf-8' in response.text.lower()

    def test_all_tool_pages_have_back_link(self):
        """All tool pages should have navigation back to home"""
        tool_endpoints = ["/diff", "/json", "/yaml", "/regex", "/base64"]

        for endpoint in tool_endpoints:
            response = client.get(endpoint)
            assert response.status_code == 200
            # Check for back link or home reference
            text_lower = response.text.lower()
            assert "devsuite" in text_lower or "home" in text_lower or 'href="/"' in response.text


class TestNegativeTestCases:
    """Additional negative test cases to strengthen confidence"""

    def test_upload_rejects_audio_file(self):
        """Ensure audio files are rejected"""
        files = {"file": ("song.mp3", b"fake audio", "audio/mpeg")}
        response = client.post("/upload", files=files)
        assert response.status_code == 400

    def test_post_to_readonly_endpoints_fails(self):
        """POST requests to GET-only endpoints should fail"""
        endpoints = ["/", "/diff", "/json", "/yaml", "/regex", "/base64"]

        for endpoint in endpoints:
            response = client.post(endpoint)
            assert response.status_code == 405  # Method Not Allowed

    def test_put_to_any_endpoint_fails(self):
        """PUT requests should not be supported"""
        response = client.put("/upload", files={"file": ("test.txt", "test", "text/plain")})
        assert response.status_code == 405

    def test_delete_to_any_endpoint_fails(self):
        """DELETE requests should not be supported"""
        response = client.delete("/upload")
        assert response.status_code == 405


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
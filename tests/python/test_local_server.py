"""
test_local_server.py
--------------------
Basic smoke test for the locally running DevSuite server.
Run with: python test_local_server.py
Requires the server to be running at http://localhost:8000/
"""
import urllib.request
import urllib.error


def test_home_page():
    """Fetches the DevSuite home page and checks for known markers."""
    try:
        html = urllib.request.urlopen('http://localhost:8000/').read().decode('utf-8')
        print("HTML length:", len(html))
        print("Theme select present?", 'global-theme-select' in html)
        assert 'global-theme-select' in html, "Could not find theme selector in home page HTML"
        print("✓ Home page smoke test passed.")
    except urllib.error.URLError as e:
        print(f"✗ Connection failed — is the local server running? Error: {e}")
    except urllib.error.HTTPError as e:
        print(f"✗ HTTP error {e.code}: {e.reason}")
    except Exception as e:
        print(f"✗ Unexpected error: {e}")


if __name__ == '__main__':
    test_home_page()

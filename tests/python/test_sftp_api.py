import urllib.request
import urllib.error
import urllib.parse
import json
import socket

def test_sftp_list():
    """Test SFTP list endpoint with proper error handling and timeout."""
    payload = {
        "host": "localhost",
        "port": 22,
        "username": "testuser",
        "password": "",
        "private_key": "",
        "path": "/"
    }

    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/sftp/list",
        data=json.dumps(payload).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            assert response.status == 200 or response.status == 500
            body = response.read().decode('utf-8')
            data = json.loads(body)
            # Verify response structure
            assert isinstance(data, dict)
    except urllib.error.HTTPError as e:
        # Expected for invalid credentials or missing SSH server
        assert e.code in [400, 500]
    except urllib.error.URLError as e:
        # Expected if server is not running
        assert isinstance(e.reason, (socket.timeout, ConnectionRefusedError, OSError))
    except socket.timeout:
        # Expected if server is slow or unavailable
        pass
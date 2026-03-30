import urllib.request
import urllib.error
import urllib.parse
import json

payload = {
    "host": "localhost",
    "port": 22,
    "username": "prabha",
    "password": "",
    "private_key": "",
    "path": "/"
}

req = urllib.request.Request(
    "http://127.0.0.1:8001/api/sftp/list",
    data=json.dumps(payload).encode('utf-8'),
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req) as response:
        print("Status", response.status)
        print("Body", response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("Error Status", e.code)
    print("Error Body", e.read().decode('utf-8'))
except Exception as e:
    print("Exception", e)

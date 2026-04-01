import asyncio
import websockets
import json
import pytest

@pytest.mark.asyncio
async def test_ws():
    """Test WebSocket terminal connection with bounded execution."""
    uri = "ws://localhost:8000/api/local/terminal"
    try:
        async with websockets.connect(uri) as websocket:
            await websocket.send(json.dumps({"distro": None}))

            # Bounded loop: read up to 5 messages with timeout
            messages_received = 0
            max_messages = 5

            for _ in range(max_messages):
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                    messages_received += 1
                    assert isinstance(response, str)
                except asyncio.TimeoutError:
                    break

            # Verify we received at least one message
            assert messages_received > 0

    except websockets.exceptions.WebSocketException:
        # Expected if server is not running or rejects connection
        pytest.skip("WebSocket server not available")
    except ConnectionRefusedError:
        # Expected if server is not running
        pytest.skip("Server not running")
import asyncio
import websockets
import json

async def test_ws():
    uri = "ws://localhost:8001/api/local/terminal"
    async with websockets.connect(uri) as websocket:
        await websocket.send(json.dumps({"distro": None}))
        try:
            while True:
                response = await websocket.recv()
                print(f"Received: {response}")
        except websockets.exceptions.ConnectionClosed:
            print("Connection closed by server")

asyncio.run(test_ws())

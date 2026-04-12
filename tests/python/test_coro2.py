import asyncio
import asyncssh
import inspect

def test_start_sftp_client_returns_expected_type():
    class DummyConn(asyncssh.SSHClientConnection):
        pass

    conn = DummyConn(None, None)
    ret = conn.start_sftp_client()
    # Verify it returns a coroutine object
    assert inspect.iscoroutine(ret) or hasattr(ret, '__await__')
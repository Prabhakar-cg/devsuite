import inspect
from asyncssh.connection import SSHClientConnection


def test_start_sftp_client_is_coroutine():
    assert inspect.iscoroutinefunction(SSHClientConnection.start_sftp_client)

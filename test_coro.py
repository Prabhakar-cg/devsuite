import asyncio
import inspect
from asyncssh.connection import SSHClientConnection

print(inspect.iscoroutinefunction(SSHClientConnection.start_sftp_client))

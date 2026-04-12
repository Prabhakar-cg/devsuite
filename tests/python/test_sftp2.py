import asyncio
import inspect
import asyncssh

async def main():
    print(inspect.iscoroutinefunction(asyncssh.SSHClientConnection.start_sftp_client))

asyncio.run(main())

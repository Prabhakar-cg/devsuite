import asyncio
import asyncssh

async def main():
    print(dir(asyncssh.SSHClientConnection.start_sftp_client))

asyncio.run(main())

import asyncio
import asyncssh

async def main():
    print(dir(asyncssh.SFTPClient))
    print(dir(asyncssh.SFTPName))

asyncio.run(main())

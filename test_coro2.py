import asyncio
import asyncssh

async def main():
    class DummyConn(asyncssh.SSHClientConnection):
        pass
    
    conn = DummyConn(None, None)
    ret = conn.start_sftp_client()
    print(type(ret))
    print(dir(ret))

asyncio.run(main())

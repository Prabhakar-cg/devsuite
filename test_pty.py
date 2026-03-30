import asyncio
import os
import pty
import fcntl
import struct
import termios

async def main():
    pid, fd = pty.fork()
    if pid == 0:
        # Child
        os.execvp("wsl.exe", ["wsl.exe", "-l"])
    else:
        # Parent
        loop = asyncio.get_running_loop()
        
        # Read function
        def reader():
            try:
                data = os.read(fd, 1024)
                print(f"Read: {data.decode('utf-16le') if b'\x00' in data else data.decode('utf-8')}")
            except OSError:
                loop.remove_reader(fd)
                print("Finished reading")

        loop.add_reader(fd, reader)
        await asyncio.sleep(2)
        os.close(fd)

asyncio.run(main())

# Static server for the game library. Same as `python3 -m http.server`, but tells the browser to
# re-check every file, so a normal reload always shows the newest version of a game.
import os, sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    ThreadingHTTPServer(("", int(sys.argv[1]) if len(sys.argv) > 1 else 8250), partial(NoCache, directory=here)).serve_forever()

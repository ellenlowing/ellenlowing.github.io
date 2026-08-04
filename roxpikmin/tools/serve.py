# Static server that tells the browser never to cache. Without this, ES module
# imports (cake.js, worms.js) get served from memory cache even when the HTML
# is cache-busted with a query param — so edits silently don't take effect.
import http.server, functools, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()
    def log_message(self, *a):
        pass

http.server.HTTPServer(("127.0.0.1", 8777),
    functools.partial(NoCache, directory=sys.argv[1] if len(sys.argv) > 1 else ".")).serve_forever()

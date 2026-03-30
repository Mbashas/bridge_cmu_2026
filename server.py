#!/usr/bin/env python3
"""
Local dev server that serves index.html and proxies /api/* requests
to the Edge Impulse inference container at localhost:1337,
avoiding browser CORS restrictions.
"""

import http.server
import urllib.request
import os

PORT = 8080
INFERENCE_HOST = "http://localhost:1337"

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path.startswith("/api/"):
            self._proxy_request()
        else:
            self.send_error(404)

    def _proxy_request(self):
        target = INFERENCE_HOST + self.path
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        req = urllib.request.Request(
            target,
            data=body,
            method="POST",
        )
        req.add_header("Content-Type", self.headers.get("Content-Type", "application/octet-stream"))

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)
                for key, val in resp.getheaders():
                    if key.lower() not in ("transfer-encoding", "connection"):
                        self.send_header(key, val)
                self.end_headers()
                self.wfile.write(resp_body)
        except Exception as e:
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(f'{{"error": "{e}"}}'.encode())

    def log_message(self, format, *args):
        status = args[1] if len(args) > 1 else ""
        print(f"  {self.command or 'GET':>5} {self.path}  →  {status}")


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server = http.server.HTTPServer(("", PORT), ProxyHandler)
    print(f"🐕 DogDetector server running at http://localhost:{PORT}")
    print(f"   Proxying /api/* → {INFERENCE_HOST}")
    print(f"   Press Ctrl+C to stop\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()

#!/usr/bin/env python3
"""
Local dev server for Quarter Planner.
- Serves static files on http://localhost:8080
- Proxies POST /api/shapes  →  https://api.shapes.co/v1  (bypasses CORS)
"""

import http.server
import urllib.request
import urllib.error
import json
import os

PORT = 8080
SHAPES_API = 'https://api.shapes.co/v1'
PROXY_PATH = '/api/shapes'
ASSET_PROXY_PATH = '/api/shapes-asset'
SHAPES_ASSET_BASE = 'https://api.shapes.co/protected-assets/'

class Handler(http.server.SimpleHTTPRequestHandler):

    def log_message(self, fmt, *args):
        # Suppress noisy static-file logs; show only proxy calls
        if PROXY_PATH in self.path:
            print(f'[proxy] {self.path} → {args[1]}')

    # ── Proxy POST /api/shapes ────────────────────────────────────────────────
    def do_POST(self):
        if self.path != PROXY_PATH:
            self.send_error(404)
            return

        length  = int(self.headers.get('Content-Length', 0))
        body    = self.rfile.read(length)

        # Forward headers (Authorization, Refresh-Token, Content-Type)
        forward_headers = {
            'Content-Type': 'application/json',
        }
        for h in ('Authorization', 'Refresh-Token'):
            v = self.headers.get(h)
            if v:
                forward_headers[h] = v

        req = urllib.request.Request(
            SHAPES_API,
            data=body,
            headers=forward_headers,
            method='POST'
        )

        try:
            with urllib.request.urlopen(req) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(resp_body)
        except urllib.error.HTTPError as e:
            resp_body = e.read()
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(resp_body)
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'errors': [{'message': str(e)}]}).encode())

    # ── Proxy GET /api/shapes-asset/{id} → https://api.shapes.co/protected-assets/{id}
    def do_GET(self):
        if not self.path.startswith(ASSET_PROXY_PATH + '/'):
            # Fall through to static file serving
            super().do_GET()
            return

        # Extract asset id (and optional query string)
        rest = self.path[len(ASSET_PROXY_PATH) + 1:]  # e.g. "47958?preview=false"
        asset_url = SHAPES_ASSET_BASE + rest

        auth = self.headers.get('Authorization', '')
        req = urllib.request.Request(asset_url, headers={'Authorization': auth} if auth else {})

        try:
            with urllib.request.urlopen(req) as resp:
                data = resp.read()
                content_type = resp.headers.get('Content-Type', 'image/jpeg')
                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Length', str(len(data)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Cache-Control', 'max-age=3600')
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
        except Exception as e:
            self.send_response(502)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

    # ── CORS preflight ────────────────────────────────────────────────────────
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Refresh-Token')
        self.end_headers()


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with http.server.HTTPServer(('', PORT), Handler) as httpd:
        print(f'Quarter Planner running at http://localhost:{PORT}')
        print(f'Shapes.co proxy at http://localhost:{PORT}{PROXY_PATH}')
        print('Press Ctrl+C to stop.')
        httpd.serve_forever()

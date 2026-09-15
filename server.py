import os
import sys
from http.server import SimpleHTTPRequestHandler, HTTPServer

class FlowrishHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        # Permite acessar tanto /biblioteca quanto /biblioteca.html
        path = self.translate_path(self.path)
        if not os.path.exists(path) and os.path.exists(path + '.html'):
            self.path = self.path + '.html'
        return super().do_GET()

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

def run():
    port = int(os.environ.get('PORT', 8080))
    server_address = ('0.0.0.0', port)
    httpd = HTTPServer(server_address, FlowrishHandler)
    print(f"🌸 Flowrish rodando em http://localhost:{port}")
    httpd.serve_forever()

if __name__ == '__main__':
    run()

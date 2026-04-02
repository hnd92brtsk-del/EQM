import argparse
import http.client
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
}


def build_handler(target_host: str, target_port: int):
    class ProxyHandler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def do_HEAD(self):
            self._forward()

        def do_GET(self):
            self._forward()

        def do_POST(self):
            self._forward()

        def do_PUT(self):
            self._forward()

        def do_PATCH(self):
            self._forward()

        def do_DELETE(self):
            self._forward()

        def do_OPTIONS(self):
            self._forward()

        def _forward(self):
            body = None
            content_length = self.headers.get("Content-Length")
            if content_length:
                body = self.rfile.read(int(content_length))

            upstream = http.client.HTTPConnection(target_host, target_port, timeout=60)
            headers = {
                key: value
                for key, value in self.headers.items()
                if key.lower() not in HOP_BY_HOP_HEADERS and key.lower() != "host"
            }
            headers["Host"] = self.headers.get("Host", f"{target_host}:{target_port}")

            try:
                upstream.request(self.command, self.path, body=body, headers=headers)
                response = upstream.getresponse()
                payload = response.read()

                self.send_response(response.status, response.reason)
                for key, value in response.getheaders():
                    lower = key.lower()
                    if lower in HOP_BY_HOP_HEADERS:
                        continue
                    if lower == "content-length":
                        continue
                    self.send_header(key, value)
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                if payload:
                    self.wfile.write(payload)
            finally:
                upstream.close()

        def log_message(self, format, *args):
            return

    return ProxyHandler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--listen-host", default="127.0.0.1")
    parser.add_argument("--listen-port", type=int, required=True)
    parser.add_argument("--target-host", required=True)
    parser.add_argument("--target-port", type=int, required=True)
    args = parser.parse_args()

    server = ThreadingHTTPServer(
        (args.listen_host, args.listen_port),
        build_handler(args.target_host, args.target_port),
    )
    print(
        f"HTTP proxy listening on {args.listen_host}:{args.listen_port} -> {args.target_host}:{args.target_port}",
        flush=True,
    )
    server.serve_forever()


if __name__ == "__main__":
    main()

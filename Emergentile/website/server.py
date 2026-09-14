#!/usr/bin/env python3
"""Emergentile website and resumable local artifact server."""

import argparse
import json
import mimetypes
import os
import re
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)$")


class EmergentileHandler(SimpleHTTPRequestHandler):
    server_version = "EmergentileDownloads/1"

    def _artifact(self):
        path = unquote(urlsplit(self.path).path)
        if not path.startswith("/downloads/"):
            return None
        name = Path(path).name
        if not name or name != path.removeprefix("/downloads/"):
            return None
        for directory in self.server.download_dirs:
            candidate = directory / name
            if candidate.is_file():
                return candidate
        return None

    def _manifest(self):
        files = {}
        for directory in reversed(self.server.download_dirs):
            if not directory.is_dir():
                continue
            for path in directory.iterdir():
                if path.is_file() and not path.name.startswith("."):
                    files[path.name] = {"name": path.name, "size": path.stat().st_size, "url": f"/downloads/{path.name}"}
        body = json.dumps({"artifacts": sorted(files.values(), key=lambda item: item["name"])}, indent=2).encode()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def do_HEAD(self):
        if urlsplit(self.path).path == "/api/downloads":
            return self._manifest()
        artifact = self._artifact()
        if artifact:
            return self._send_artifact(artifact, head_only=True)
        return super().do_HEAD()

    def do_GET(self):
        if urlsplit(self.path).path == "/api/downloads":
            return self._manifest()
        artifact = self._artifact()
        if artifact:
            return self._send_artifact(artifact, head_only=False)
        if urlsplit(self.path).path.startswith("/downloads/"):
            self.send_error(HTTPStatus.NOT_FOUND, "Artifact has not been built on this host")
            return
        return super().do_GET()

    def _send_artifact(self, path, head_only):
        size = path.stat().st_size
        start, end = 0, size - 1
        status = HTTPStatus.OK
        requested = self.headers.get("Range")
        if requested:
            match = RANGE_RE.fullmatch(requested.strip())
            if not match:
                self.send_error(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                return
            first, last = match.groups()
            if not first:
                length = int(last or 0)
                start = max(size - length, 0)
            else:
                start = int(first)
                end = min(int(last), size - 1) if last else size - 1
            if start >= size or start > end:
                self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                self.send_header("Content-Range", f"bytes */{size}")
                self.end_headers()
                return
            status = HTTPStatus.PARTIAL_CONTENT

        length = end - start + 1
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Disposition", f'attachment; filename="{path.name}"')
        self.send_header("Last-Modified", self.date_time_string(path.stat().st_mtime))
        if status == HTTPStatus.PARTIAL_CONTENT:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        if head_only:
            return
        with path.open("rb") as source:
            source.seek(start)
            remaining = length
            while remaining:
                chunk = source.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)

    def log_message(self, fmt, *args):
        print(f"{self.address_string()} [{self.log_date_time_string()}] {fmt % args}", flush=True)


def main():
    project = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description="Serve the Emergentile website and local OS images")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--root", type=Path, default=project / "website")
    parser.add_argument("--downloads", type=Path, default=project / "dist")
    args = parser.parse_args()
    root = args.root.resolve()
    downloads = args.downloads.resolve()
    bundled = root / "downloads"
    os.chdir(root)
    server = ThreadingHTTPServer((args.host, args.port), EmergentileHandler)
    server.download_dirs = [downloads, bundled]
    print(f"Emergentile website: http://{args.host}:{args.port}")
    print(f"Local images: {downloads}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

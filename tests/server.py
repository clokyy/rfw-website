"""Local-only static test server reproducing configured Netlify headers."""
import http.server, os, pathlib, sys, tomllib
root=pathlib.Path(__file__).resolve().parents[1]
config=tomllib.loads((root/'netlify.toml').read_text())
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(root/'public'),**kwargs)
    def end_headers(self):
        headers={}
        for item in config['headers']:
            if item['for']=='/*' or (item['for']=='/admin/*' and self.path.startswith('/admin/')):
                headers.update(item['values'])
        for name,value in headers.items(): self.send_header(name,value)
        super().end_headers()
    def log_message(self,*args): pass

http.server.ThreadingHTTPServer(('127.0.0.1',int(sys.argv[1]) if len(sys.argv)>1 else 8766),Handler).serve_forever()

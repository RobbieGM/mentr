import cherrypy as cp
from ws4py.server.cherrypyserver import WebSocketPlugin, WebSocketTool
from ws4py.websocket import WebSocket, EchoWebSocket
from os import getcwd

cwd = getcwd()

class Root(object):

    @cp.expose
    def index(self):
        return cp.lib.static.serve_file(cwd + '/static/index.html')

WebSocketPlugin(cp.engine).subscribe()
cp.tools.websocket = WebSocketTool()

cfg = {
    '/static': {
        'tools.staticdir.on': True,
        'tools.staticdir.dir': cwd + '/static',
    },
    'global': {
        'server.socket_host': '0.0.0.0',
        'server.socket_port': 8080,
        'log.screen': True,
        'tools.caching.on': False,
        'tools.gzip.on': True,
        'tools.expires.on': True,
        'tools.expires.secs': 60 * 60 * 24 * 5,
    }
}

if __name__ == '__main__':
    cp.quickstart(Root(), '/', config=cfg)

import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
from config.wsgi import application
from waitress import serve

if __name__ == '__main__':
    port = int(os.environ.get('COURSELOOP_PORT', '8080'))
    if not 1024 <= port <= 65535:
        raise SystemExit('COURSELOOP_PORT应为1024—65535之间的端口。')
    print(f'CourseLoop 本机教学演示：http://127.0.0.1:{port}/', flush=True)
    print('仅绑定本机回环地址；未开放局域网或公网。', flush=True)
    serve(application, host='127.0.0.1', port=port, threads=4,
          max_request_body_size=21 * 1024 * 1024, max_request_header_size=32768,
          expose_tracebacks=False, channel_timeout=180)

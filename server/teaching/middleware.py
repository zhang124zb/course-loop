from django.http import HttpResponseForbidden

class LocalSecurityMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.META.get('REMOTE_ADDR', '') not in ('127.0.0.1', '::1'):
            return HttpResponseForbidden('此版本只允许本机访问。')
        response = self.get_response(request)
        response.setdefault('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' https:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'")
        response['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
        response['Cache-Control'] = 'no-store'
        return response

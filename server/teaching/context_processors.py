from .access import role_for

def application_context(request):
    user = request.user
    name = user.username if user.is_authenticated else ''
    if user.is_authenticated:
        try:
            name = user.profile.display_name
        except Exception:
            pass
    return {'current_role': role_for(user), 'display_name': name, 'app_mode': '本机教学演示'}

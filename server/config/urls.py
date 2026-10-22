from django.urls import include, path
from django.contrib.staticfiles import views as static_views

urlpatterns = [
    path('static/<path:path>', static_views.serve, {'insecure': True}),
    path('', include('teaching.urls')),
]

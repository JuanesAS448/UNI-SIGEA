"""
URL principal del proyecto G-Doc.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from rest_framework_simplejwt.views import TokenRefreshView
from accounts.views import EmailTokenObtainPairView

urlpatterns = [
    path('admin/', admin.site.urls),

    # AUTH
    path("api/auth/", include("accounts.urls")),
    path("api/auth/login/", EmailTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # API PRINCIPAL
    path('api/', include('documental.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT) 
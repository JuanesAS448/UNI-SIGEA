"""
URLs del módulo documental.
FASE 1-2: Router DRF para CRUD de todos los modelos + endpoint especial de Dashboard.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'documental'

# Router DRF para ViewSets
router = DefaultRouter()
router.register(r'postulantes', views.PostulanteViewSet, basename='postulante')
router.register(r'convocatorias', views.ConvocatoriaViewSet, basename='convocatoria')
router.register(r'documentos-requeridos', views.DocumentoRequeridoViewSet, basename='documento-requerido')
router.register(r'documentos', views.DocumentoViewSet, basename='documento')
router.register(r'usuarios-perfil', views.UsuarioPerfilViewSet, basename='usuario-perfil')
router.register(r'expedientes', views.ExpedienteViewSet, basename='expediente')

urlpatterns = [
    # Chatbot documental del portal postulante
    path('chatbot/', views.chatbot_documental, name='chatbot-documental'),

    # Endpoint especial para el dashboard (no es CRUD simple)
    path('dashboard/stats/', views.dashboard_stats, name='dashboard-stats'),
    
    # Endpoint de salud
    path('health/', views.api_health, name='health'),
    
    # Todos los endpoints CRUD del router
    path('', include(router.urls)),
]

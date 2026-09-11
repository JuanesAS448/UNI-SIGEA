from django.apps import AppConfig


class DocumentalConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'documental'
    verbose_name = 'Gestión documental'

    def ready(self):
        import documental.signals

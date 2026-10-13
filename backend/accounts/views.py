import logging

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode

from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import EmailTokenObtainPairSerializer, RegisterSerializer
from .auth_payload import auth_payload_for_user
from .session_payload import session_payload_for_user

logger = logging.getLogger(__name__)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(session_payload_for_user(request.user))


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        body = auth_payload_for_user(user)
        body["detail"] = "Registro exitoso."

        headers = self.get_success_headers(serializer.data)
        return Response(body, status=status.HTTP_201_CREATED, headers=headers)


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer


class ChangePasswordView(APIView):
    """Cambio de contraseña estando autenticado (ej. sustituir clave genérica del admin)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        old_password = request.data.get("old_password", "")
        new_password = request.data.get("new_password", "")

        if not request.user.check_password(old_password):
            return Response(
                {"old_password": ["La contraseña actual no es correcta."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not new_password or len(new_password) < 6:
            return Response(
                {"new_password": ["La nueva contraseña debe tener al menos 6 caracteres."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(new_password)
        request.user.save(update_fields=["password"])

        return Response({"detail": "Contraseña actualizada correctamente."})


class ForgotPasswordRequestView(APIView):
    """
    Solicitud de recuperación: envía correo con enlace (en desarrollo suele imprimirse en consola).
    Respuesta genérica para no revelar si el correo existe.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return Response(
                {"email": ["Indique su correo electrónico."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        generic = {
            "detail": "Si el correo está registrado, recibirá instrucciones para restablecer la contraseña.",
        }

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response(generic, status=status.HTTP_200_OK)

        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        base = getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/")
        link = f"{base}/restablecer-contrasena?uid={uid}&token={token}"

        subject = "Recuperación de contraseña — SIGEA"
        message = (
            f"Hola,\n\n"
            f"Para elegir una nueva contraseña, abra este enlace en el navegador:\n{link}\n\n"
            f"Si usted no solicitó este cambio, ignore este mensaje.\n"
        )

        try:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )
        except Exception as exc:
            logger.warning("No se pudo enviar correo de recuperación: %s", exc, exc_info=True)

        return Response(generic, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    """Confirma el token enviado por correo y establece la nueva contraseña."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uid = request.data.get("uid", "")
        token = request.data.get("token", "")
        new_password = request.data.get("new_password", "")

        if not uid or not token:
            return Response(
                {"detail": ["Enlace inválido o incompleto."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not new_password or len(new_password) < 6:
            return Response(
                {"new_password": ["La contraseña debe tener al menos 6 caracteres."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=pk)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            return Response(
                {"detail": ["El enlace no es válido o ha expirado."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {"detail": ["El enlace no es válido o ha expirado."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=["password"])

        return Response({"detail": "Contraseña restablecida. Ya puede iniciar sesión."})

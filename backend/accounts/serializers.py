from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .session_payload import session_payload_for_user


class RegisterSerializer(serializers.ModelSerializer):
    """
    Registro público de postulantes.
    El frontend envía email, password y full_name (no username).
    Siempre crea usuario sin privilegios administrativos (staff/superuser = False).
    El perfil documental y la ficha Postulante se crean por señal post_save.
    """

    password = serializers.CharField(write_only=True, min_length=6)
    full_name = serializers.CharField(write_only=True, max_length=200)

    class Meta:
        model = User
        fields = ["id", "email", "password", "full_name", "username", "first_name", "last_name"]
        read_only_fields = ["id", "username", "first_name", "last_name"]

    def validate_email(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("El correo es obligatorio.")
        normalized = str(value).strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("Este correo ya está registrado.")
        return normalized

    def create(self, validated_data):
        full_name = validated_data.pop("full_name", "").strip()
        password = validated_data.pop("password")
        email = validated_data["email"]

        parts = full_name.split(None, 1)
        first_name = parts[0] if parts else ""
        last_name = parts[1] if len(parts) > 1 else ""

        base_username = (email.split("@")[0].replace(".", "_").replace("+", "_"))[:30] or "usuario"
        username = base_username
        suffix = 0
        while User.objects.filter(username=username).exists():
            suffix += 1
            username = f"{base_username}{suffix}"[:150]

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name[:150],
            last_name=last_name[:150],
            is_staff=False,
            is_superuser=False,
        )
        return user


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields[self.username_field].required = False
        self.fields["email"] = serializers.CharField(required=False)

    def validate(self, attrs):
        # JWT estándar envía "username"; el login puede enviar correo o usuario.
        email = attrs.get("email") or attrs.get("username")
        password = attrs.get("password")

        if not email:
            raise serializers.ValidationError({"email": ["Indique el correo electrónico."]})

        try:
            identifier = str(email).strip()
            user = User.objects.get(
                Q(email__iexact=identifier.lower()) | Q(username__iexact=identifier)
            )
        except User.DoesNotExist:
            raise serializers.ValidationError({"detail": ["Credenciales incorrectas."]})

        attrs["username"] = user.username
        attrs["password"] = password

        try:
            data = super().validate(attrs)
        except serializers.ValidationError:
            raise serializers.ValidationError({"detail": ["Credenciales incorrectas."]})

        data.update(session_payload_for_user(user))

        return data

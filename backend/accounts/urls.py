from django.urls import path
from .views import (
    RegisterView,
    MeView,
    ChangePasswordView,
    ForgotPasswordRequestView,
    PasswordResetConfirmView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("me/", MeView.as_view(), name="me"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("forgot-password/", ForgotPasswordRequestView.as_view(), name="forgot-password"),
    path("reset-password/", PasswordResetConfirmView.as_view(), name="reset-password"),
]
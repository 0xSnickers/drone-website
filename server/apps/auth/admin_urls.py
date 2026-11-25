from django.urls import path

from . import views

urlpatterns = [
    path("login", views.admin_login),
    path("refresh", views.admin_refresh),
    path("session", views.admin_refresh),
    path("logout", views.admin_logout),
    path("me", views.admin_me),
]

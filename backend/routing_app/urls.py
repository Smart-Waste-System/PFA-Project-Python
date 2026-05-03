from django.urls import path
from . import views

urlpatterns = [
    path('calculate/', views.calculate_route, name='calculate_route'),
]
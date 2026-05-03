from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, ContainerViewSet, TruckViewSet, RouteViewSet, CollectionPointViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'containers', ContainerViewSet)
router.register(r'trucks', TruckViewSet)
router.register(r'routes', RouteViewSet)
router.register(r'collection-points', CollectionPointViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
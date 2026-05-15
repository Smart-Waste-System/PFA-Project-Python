from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db import transaction

from .models import User, Container, Truck, Route, CollectionPoint
from .serializers import (
    UserSerializer,
    ContainerSerializer,
    TruckSerializer,
    RouteSerializer,
    CollectionPointSerializer
)
from .permissions import IsSuperAdmin, IsAdminOrSuperAdmin, IsDriver


class UserViewSet(viewsets.ModelViewSet):
    """
    Gestion des utilisateurs.

    Règle métier :
    - SUPER_ADMIN uniquement peut créer / modifier / supprimer les users.
    - ADMIN ne gère pas les users, il gère la logistique.
    - DRIVER n'a pas accès au CRUD users.
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsSuperAdmin]

    def get_queryset(self):
        queryset = super().get_queryset()
        role = self.request.query_params.get('role')

        if role:
            queryset = queryset.filter(role=role)

        return queryset


class ContainerViewSet(viewsets.ModelViewSet):
    """
    Gestion des conteneurs.

    Règle métier :
    - ADMIN et SUPER_ADMIN peuvent faire le CRUD logistique.
    - DRIVER ne modifie pas directement les conteneurs.
      Il valide une collecte via CollectionPoint /validate/.
    """
    queryset = Container.objects.all()
    serializer_class = ContainerSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'critical']:
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAdminOrSuperAdmin]

        return [permission() for permission in permission_classes]

    def get_queryset(self):
        queryset = super().get_queryset()
        alert_status = self.request.query_params.get('alert_status')

        if alert_status:
            queryset = queryset.filter(alert_status=alert_status)

        return queryset

    @action(detail=False, methods=['get'], url_path='critical')
    def critical(self, request):
        qs = self.get_queryset().filter(
            alert_status=Container.AlertStatus.FULL,
            physical_status=Container.PhysicalStatus.OPERATIONAL
        )
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='empty')
    def empty_container(self, request, pk=None):
        """
        Action admin exceptionnelle pour vider un conteneur manuellement.
        Le flux normal chauffeur passe par CollectionPoint /validate/.
        """
        container = self.get_object()
        container.fill_level = 0.0
        container.save()

        serializer = self.get_serializer(container)
        return Response({
            'message': 'Conteneur vidé avec succès.',
            'container': serializer.data
        })


class TruckViewSet(viewsets.ModelViewSet):
    """
    Gestion des camions.

    Règle métier :
    - ADMIN et SUPER_ADMIN peuvent créer / modifier / supprimer les camions.
    - DRIVER ne gère pas la flotte.
    """
    queryset = Truck.objects.all()
    serializer_class = TruckSerializer
    permission_classes = [IsAdminOrSuperAdmin]


class RouteViewSet(viewsets.ModelViewSet):
    """
    Gestion des tournées.

    Règle métier :
    - ADMIN et SUPER_ADMIN peuvent gérer les tournées.
    - DRIVER peut consulter seulement ses propres tournées.
    - DRIVER peut démarrer sa propre mission.
    """
    queryset = Route.objects.all()
    serializer_class = RouteSerializer

    def get_permissions(self):
        if self.action == 'start_route':
            permission_classes = [IsDriver]
        elif self.action in ['list', 'retrieve']:
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAdminOrSuperAdmin]

        return [permission() for permission in permission_classes]

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        if not user or not user.is_authenticated:
            return Route.objects.none()

        if getattr(user, 'role', None) == 'DRIVER':
            return queryset.filter(truck__driver=user)

        return queryset

    @action(detail=True, methods=['post'], url_path='start')
    def start_route(self, request, pk=None):
        """
        Le chauffeur démarre sa mission.
        Cycle : PLANNED -> IN_PROGRESS.
        """
        route = self.get_object()

        if route.truck.driver != request.user:
            return Response(
                {"error": "Cette tournée n'est pas assignée à ce chauffeur."},
                status=403
            )

        if route.status == Route.Status.COMPLETED:
            return Response(
                {"error": "Cette tournée est déjà terminée."},
                status=400
            )

        route.status = Route.Status.IN_PROGRESS
        route.started_at = timezone.now()
        route.save()

        serializer = self.get_serializer(route)
        return Response({
            "message": "Mission démarrée avec succès.",
            "route": serializer.data
        })


class CollectionPointViewSet(viewsets.ModelViewSet):
    """
    Gestion des points de collecte.

    Règle métier :
    - ADMIN et SUPER_ADMIN peuvent gérer les points.
    - DRIVER voit seulement les points de ses propres tournées.
    - DRIVER valide les stops avec /validate/.
    """
    queryset = CollectionPoint.objects.all()
    serializer_class = CollectionPointSerializer

    def get_permissions(self):
        if self.action == 'validate_collection':
            permission_classes = [IsDriver]
        elif self.action in ['list', 'retrieve']:
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAdminOrSuperAdmin]

        return [permission() for permission in permission_classes]

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        if not user or not user.is_authenticated:
            return CollectionPoint.objects.none()

        if getattr(user, 'role', None) == 'DRIVER':
            return queryset.filter(route__truck__driver=user)

        return queryset

    @action(detail=True, methods=['post'], url_path='validate')
    def validate_collection(self, request, pk=None):
        """
        Validation métier chauffeur :
        - vérifie que le point appartient au chauffeur connecté
        - marque le point comme vidé
        - remet le conteneur à 0%
        - met la route en IN_PROGRESS si elle ne l'est pas
        - si tous les points de CETTE route sont vidés, clôture uniquement CETTE route
        - remet uniquement le camion de CETTE route disponible
        """
        with transaction.atomic():
            point = self.get_object()
            container = point.container
            route = point.route
            truck = route.truck

            if truck.driver != request.user:
                return Response(
                    {"error": "Ce point de collecte n'est pas assigné à ce chauffeur."},
                    status=403
                )

            if point.is_emptied:
                return Response(
                    {"message": "Ce point est déjà validé."},
                    status=200
                )

            if route.status == Route.Status.PLANNED:
                route.status = Route.Status.IN_PROGRESS
                route.started_at = timezone.now()
                route.save()

            point.is_emptied = True
            point.emptied_at = timezone.now()
            point.save()

            container.fill_level = 0.0
            container.save()

            remaining_points = route.collection_points.filter(is_emptied=False).count()

            if remaining_points == 0:
                route.status = Route.Status.COMPLETED
                route.completed_at = timezone.now()
                route.save()

                truck.status = Truck.Status.AVAILABLE
                truck.save()
            else:
                route.status = Route.Status.IN_PROGRESS
                route.save()

        serializer = self.get_serializer(point)

        return Response({
            "message": "Collecte validée avec succès.",
            "collection_point": serializer.data,
            "container_status": container.alert_status,
            "route_status": route.status,
            "truck_status": truck.status
        })
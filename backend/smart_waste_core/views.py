from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import User, Container, Truck, Route, CollectionPoint
from .serializers import UserSerializer, ContainerSerializer, TruckSerializer, RouteSerializer, CollectionPointSerializer
from .permissions import IsSuperAdmin, IsAdminOrSuperAdmin, IsDriver

class UserViewSet(viewsets.ModelViewSet):
    """ ViewSet pour gérer le CRUD des Utilisateurs """
    queryset = User.objects.all()
    serializer_class = UserSerializer

class ContainerViewSet(viewsets.ModelViewSet):
    queryset = Container.objects.all()
    serializer_class = ContainerSerializer
    
    def get_permissions(self):
        # Si c'est une modification (PATCH/PUT), le Chauffeur et l'Admin ont le droit
        if self.action in ['update', 'partial_update']:
            permission_classes = [IsAuthenticated] 
        else:
            # Pour Créer ou Supprimer, seul l'Admin a le droit
            permission_classes = [IsAdminOrSuperAdmin]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        # Le code d'Aymane pour le filtrage par URL (ex: ?alert_status=FULL)
        queryset = super().get_queryset()
        alert_status = self.request.query_params.get('alert_status')
        if alert_status:
            queryset = queryset.filter(alert_status=alert_status)
        return queryset

    @action(detail=False, methods=['get'], url_path='critical')
    def critical(self, request):
        # Le code d'Aymane pour récupérer uniquement les conteneurs pleins ET fonctionnels
        qs = self.get_queryset().filter(
            alert_status=Container.AlertStatus.FULL, 
            physical_status=Container.PhysicalStatus.OPERATIONAL
        )
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='empty')
    def empty_container(self, request, pk=None):
        # Le code d'Aymane pour vider la poubelle
        container = self.get_object()
        container.fill_level = 0.0
        # Rappel : le save() va déclencher la logique métier d'Aymane dans models.py 
        # et remettre l'alert_status à 'EMPTY' automatiquement !
        container.save()
        
        serializer = self.get_serializer(container)
        return Response({'message': 'Conteneur vidé avec succès.', 'container': serializer.data})

class TruckViewSet(viewsets.ModelViewSet):
    """ ViewSet pour gérer le CRUD des Camions """
    queryset = Truck.objects.all()
    serializer_class = TruckSerializer
    permission_classes = [IsAdminOrSuperAdmin]

class RouteViewSet(viewsets.ModelViewSet):
    """ ViewSet pour gérer le CRUD des Tournées (Routes) """
    queryset = Route.objects.all()
    serializer_class = RouteSerializer

class CollectionPointViewSet(viewsets.ModelViewSet):
    """ ViewSet pour gérer le CRUD des Points de Collecte """
    queryset = CollectionPoint.objects.all()
    serializer_class = CollectionPointSerializer
from rest_framework.decorators import api_view, permission_classes
from smart_waste_core.permissions import IsAdminOrSuperAdmin
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from smart_waste_core.models import Container, Truck, Route, CollectionPoint
from .vrp_solver import solve_vrp

@api_view(['POST'])
@permission_classes([IsAdminOrSuperAdmin])
def calculate_route(request):
    try:
        # 1. Récupérer un camion DISPONIBLE ayant des coordonnées GPS valides
        truck = Truck.objects.filter(
            status=Truck.Status.AVAILABLE, 
            latitude__isnull=False, 
            longitude__isnull=False
        ).first()
        
        if not truck:
            return Response({"error": "Aucun camion disponible ou localisé."}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Récupérer les conteneurs critiques (FULL)
        full_containers = Container.objects.filter(alert_status=Container.AlertStatus.FULL)
        if not full_containers.exists():
            return Response({"message": "Aucun conteneur ne nécessite une collecte."}, status=status.HTTP_200_OK)

        # 3. Préparer les coordonnées pour l'algorithme
        locations = [(truck.latitude, truck.longitude)]
        
        container_list = list(full_containers)
        for container in container_list:
            locations.append((container.latitude, container.longitude))

        # 4. Lancer le solveur VRP
        solution = solve_vrp(locations, num_vehicles=1, depot_index=0)

        if not solution:
            return Response({"error": "L'algorithme n'a pas pu trouver de solution."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # 5. Sauvegarder les résultats avec transaction.atomic() 
        with transaction.atomic():
            # Création de la Route (avec le truck obligatoire !)
            new_route = Route.objects.create(
                truck=truck,
                total_distance_km=solution['total_distance_meters'] / 1000.0,
                status=Route.Status.PLANNED
            )

            # Création des CollectionPoints et extraction des coordonnées pour le Frontend
            stop_order_list = solution['stop_order']
            order_counter = 1
            ordered_points_for_frontend = []
            
            for node_index in stop_order_list:
                if node_index == 0:
                    ordered_points_for_frontend.append({
                        "latitude": truck.latitude,
                        "longitude": truck.longitude
                    })
                    continue 
                
                actual_container = container_list[node_index - 1]
                
                ordered_points_for_frontend.append({
                    "latitude": actual_container.latitude,
                    "longitude": actual_container.longitude
                })

                CollectionPoint.objects.create(
                    route=new_route,
                    container=actual_container,
                    stop_order=order_counter,
                    is_emptied=False
                )
                order_counter += 1
            
            # Mettre à jour le statut du camion
            truck.status = Truck.Status.ON_MISSION
            truck.save()

        # Validation de l'API : Retourne un code 201 Created comme exigé
        return Response({
            "message": "Tournée calculée avec succès.",
            "route_id": new_route.route_id, 
            "total_distance_km": new_route.total_distance_km,
            "ordered_points": ordered_points_for_frontend
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
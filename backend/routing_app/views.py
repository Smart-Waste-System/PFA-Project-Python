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
    """
    Crée une tournée optimisée.

    Deux modes possibles :

    1) Mode manuel multi-tournées :
       Le frontend envoie :
       {
           "truck_id": "...",
           "container_ids": ["...", "..."]
       }

       Dans ce cas :
       - on utilise le camion choisi par l'admin
       - on utilise seulement les conteneurs sélectionnés
       - on crée une tournée indépendante pour ce camion

    2) Mode automatique ancien :
       Si aucun truck_id / container_ids n'est envoyé :
       - le système choisit le premier camion disponible
       - il prend tous les conteneurs FULL opérationnels

    Résultat :
    - La route est créée en PLANNED
    - Le camion passe ON_MISSION
    - Le chauffeur démarre ensuite la mission depuis l'interface mobile
    """
    try:
        truck_id = request.data.get("truck_id")
        container_ids = request.data.get("container_ids", [])

        with transaction.atomic():
            # ==========================================================
            # 1. Choix du camion
            # ==========================================================
            if truck_id:
                truck = Truck.objects.select_for_update().filter(
                    truck_id=truck_id,
                    status=Truck.Status.AVAILABLE,
                    physical_status=Container.PhysicalStatus.OPERATIONAL,
                    driver__isnull=False,
                    latitude__isnull=False,
                    longitude__isnull=False
                ).first()

                if not truck:
                    return Response(
                        {
                            "error": (
                                "Le camion choisi est introuvable, non disponible, "
                                "non opérationnel, non localisé ou sans chauffeur."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                truck = Truck.objects.select_for_update().filter(
                    status=Truck.Status.AVAILABLE,
                    physical_status=Container.PhysicalStatus.OPERATIONAL,
                    driver__isnull=False,
                    latitude__isnull=False,
                    longitude__isnull=False
                ).first()

                if not truck:
                    return Response(
                        {
                            "error": (
                                "Aucun camion disponible, opérationnel, localisé "
                                "et assigné à un chauffeur."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # ==========================================================
            # 2. Choix des conteneurs
            # ==========================================================
            if container_ids:
                selected_containers = Container.objects.filter(
                    container_id__in=container_ids,
                    alert_status=Container.AlertStatus.FULL,
                    physical_status=Container.PhysicalStatus.OPERATIONAL
                )

                if selected_containers.count() != len(container_ids):
                    return Response(
                        {
                            "error": (
                                "Un ou plusieurs conteneurs sélectionnés sont introuvables, "
                                "non critiques ou non opérationnels."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                selected_containers = Container.objects.filter(
                    alert_status=Container.AlertStatus.FULL,
                    physical_status=Container.PhysicalStatus.OPERATIONAL
                )

            if not selected_containers.exists():
                return Response(
                    {"message": "Aucun conteneur critique ne nécessite une collecte."},
                    status=status.HTTP_200_OK
                )

            container_list = list(selected_containers)

            # ==========================================================
            # 3. Préparer les coordonnées pour le solveur VRP
            #    index 0 = camion / dépôt
            # ==========================================================
            locations = [(truck.latitude, truck.longitude)]

            for container in container_list:
                locations.append((container.latitude, container.longitude))

            # ==========================================================
            # 4. Lancer le solveur VRP
            # ==========================================================
            solution = solve_vrp(locations, num_vehicles=1, depot_index=0)

            if not solution:
                return Response(
                    {"error": "L'algorithme n'a pas pu trouver de solution."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # ==========================================================
            # 5. Créer une tournée indépendante
            # ==========================================================
            new_route = Route.objects.create(
                truck=truck,
                total_distance_km=solution['total_distance_meters'] / 1000.0,
                status=Route.Status.PLANNED
            )

            stop_order_list = solution['stop_order']
            order_counter = 1
            ordered_points_for_frontend = []

            for node_index in stop_order_list:
                # node 0 = camion / dépôt
                if node_index == 0:
                    ordered_points_for_frontend.append({
                        "latitude": truck.latitude,
                        "longitude": truck.longitude,
                        "type": "truck",
                        "label": truck.license_plate,
                        "truck_id": str(truck.truck_id),
                    })
                    continue

                actual_container = container_list[node_index - 1]

                ordered_points_for_frontend.append({
                    "latitude": actual_container.latitude,
                    "longitude": actual_container.longitude,
                    "type": "container",
                    "label": actual_container.name,
                    "container_id": str(actual_container.container_id),
                    "stop_order": order_counter,
                })

                CollectionPoint.objects.create(
                    route=new_route,
                    container=actual_container,
                    stop_order=order_counter,
                    is_emptied=False
                )

                order_counter += 1

            # ==========================================================
            # 6. Le camion devient occupé par cette tournée
            # ==========================================================
            truck.status = Truck.Status.ON_MISSION
            truck.save()

        return Response({
            "message": "Tournée créée avec succès.",
            "route_id": str(new_route.route_id),
            "truck_id": str(truck.truck_id),
            "truck": truck.license_plate,
            "driver": truck.driver.email if truck.driver else None,
            "status": new_route.status,
            "total_distance_km": new_route.total_distance_km,
            "ordered_points": ordered_points_for_frontend
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
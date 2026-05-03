from geopy.distance import geodesic
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp

def calculate_distance_matrix(locations):
    """
    Calcule la matrice des distances en mètres entre tous les points (Dépôt + Conteneurs FULL).
    """
    matrix = []
    for from_loc in locations:
        row = []
        for to_loc in locations:
            # geopy s'attend à un tuple (latitude, longitude)
            # OR-Tools a besoin de valeurs entières, on convertit donc la distance en mètres (int)
            distance = int(geodesic(from_loc, to_loc).meters)
            row.append(distance)
        matrix.append(row)
    return matrix

def solve_vrp(locations, num_vehicles=1, depot_index=0):
    """
    Implémente le modèle VRP de Google OR-Tools pour minimiser la distance totale.
    """
    # 1. Génération de la matrice des distances
    distance_matrix = calculate_distance_matrix(locations)
    
    # 2. Configuration du gestionnaire de routage OR-Tools
    manager = pywrapcp.RoutingIndexManager(len(distance_matrix), num_vehicles, depot_index)
    routing = pywrapcp.RoutingModel(manager)

    # 3. Création du callback de distance (comment OR-Tools lit la matrice)
    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return distance_matrix[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)

    # 4. Définition du coût (minimiser la distance)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # 5. Paramètres de recherche (Stratégie de la première solution)
    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC)

    # 6. Résolution
    solution = routing.SolveWithParameters(search_parameters)

    # 7. Formatage du résultat pour l'API Django
    if solution:
        index = routing.Start(0)
        route_order = []
        total_distance = 0
        
        while not routing.IsEnd(index):
            node_index = manager.IndexToNode(index)
            route_order.append(node_index)
            previous_index = index
            index = solution.Value(routing.NextVar(index))
            total_distance += routing.GetArcCostForVehicle(previous_index, index, 0)
        
        # Ajouter le dépôt de retour à la fin du trajet
        route_order.append(manager.IndexToNode(index))
        
        return {
            "stop_order": route_order,
            "total_distance_meters": total_distance
        }
    return None
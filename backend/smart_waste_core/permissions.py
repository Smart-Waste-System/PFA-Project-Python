from rest_framework import permissions

class IsAdminRole(permissions.BasePermission):
    """ Permet l'accès uniquement aux utilisateurs ayant le rôle ADMIN. """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'ADMIN')

class IsDriverRole(permissions.BasePermission):
    """ Permet l'accès uniquement aux utilisateurs ayant le rôle DRIVER. """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'DRIVER')
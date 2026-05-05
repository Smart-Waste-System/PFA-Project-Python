from rest_framework import permissions

class IsSuperAdmin(permissions.BasePermission):
    """Accès exclusif au Super Administrateur"""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request.user, 'role', None) == 'SUPER_ADMIN')

class IsAdminOrSuperAdmin(permissions.BasePermission):
    """Accès pour l'Admin (Gestion flotte) et le SuperAdmin"""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request.user, 'role', None) in ['ADMIN', 'SUPER_ADMIN'])

class IsDriver(permissions.BasePermission):
    """Accès pour le Chauffeur"""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request.user, 'role', None) == 'DRIVER')
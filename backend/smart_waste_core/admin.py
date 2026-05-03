from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Container, Truck, Route, CollectionPoint


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['email', 'first_name', 'last_name', 'role', 'is_active', 'is_staff']
    list_filter = ['role', 'is_active']
    search_fields = ['email', 'first_name', 'last_name']
    ordering = ['email']
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Infos personnelles', {'fields': ('first_name', 'last_name')}),
        ('Permissions', {'fields': ('role', 'is_active', 'is_staff', 'is_superuser')}),
    )


@admin.register(Container)
class ContainerAdmin(admin.ModelAdmin):
    list_display = ['name', 'fill_level', 'alert_status', 'physical_status', 'last_updated']
    list_filter = ['alert_status', 'physical_status']
    search_fields = ['name']


@admin.register(Truck)
class TruckAdmin(admin.ModelAdmin):
    list_display = ['license_plate', 'capacity', 'current_load', 'status', 'physical_status', 'driver']
    list_filter = ['status', 'physical_status']


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ['route_id', 'truck', 'total_distance_km', 'status', 'created_at']
    list_filter = ['status']


@admin.register(CollectionPoint)
class CollectionPointAdmin(admin.ModelAdmin):
    list_display = ['stop_order', 'route', 'container', 'is_emptied', 'emptied_at']
    list_filter = ['is_emptied']
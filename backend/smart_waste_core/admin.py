from django.contrib import admin
from django.contrib.auth.hashers import make_password
from .models import User, Container, Truck, Route, CollectionPoint

# On crée une règle spéciale pour l'administration des Utilisateurs
@admin.register(User)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('email', 'first_name', 'last_name', 'role', 'is_active', 'is_staff')
    
    # C'est ICI la magie : on intercepte l'enregistrement
    def save_model(self, request, obj, form, change):
        # Si le mot de passe n'est pas déjà haché (s'il ne commence pas par pbkdf2_), on le hache !
        if obj.password and not obj.password.startswith('pbkdf2_'):
            obj.password = make_password(obj.password)
        super().save_model(request, obj, form, change)

admin.site.register(Container)
admin.site.register(Truck)
admin.site.register(Route)
admin.site.register(CollectionPoint)
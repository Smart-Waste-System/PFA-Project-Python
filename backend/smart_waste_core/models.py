import uuid
import os
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager

# ── GESTION DES UTILISATEURS (CUSTOM USER) ───────────────────────────────────

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("L'email est obligatoire")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('role', 'ADMIN')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)

class User(AbstractBaseUser):
    class Role(models.TextChoices):
        ADMIN  = 'ADMIN',  'Administrateur'
        DRIVER = 'DRIVER', 'Chauffeur'

    user_id    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name = models.CharField(max_length=100)
    last_name  = models.CharField(max_length=100)
    email      = models.EmailField(unique=True)
    role       = models.CharField(max_length=10, choices=Role.choices, default=Role.DRIVER)
    
    is_active    = models.BooleanField(default=True)
    is_staff     = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    created_at   = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    class Meta:
        db_table = 'users'

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.role})"

    def has_perm(self, perm, obj=None):
        return self.is_superuser

    def has_module_perms(self, app_label):
        return self.is_superuser


# ── INFRASTRUCTURE CONNECTÉE (IOT) ───────────────────────────────────────────

class Container(models.Model):
    class AlertStatus(models.TextChoices):
        EMPTY   = 'EMPTY',   'Vide (0-50%)'
        PARTIAL = 'PARTIAL', 'Partiel (51-79%)'
        FULL    = 'FULL',    'Critique (80-100%)'

    class PhysicalStatus(models.TextChoices):
        OPERATIONAL = 'OPERATIONAL', 'Opérationnel'
        MAINTENANCE = 'MAINTENANCE', 'En maintenance'
        BROKEN      = 'BROKEN',      'Hors service'

    container_id    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name            = models.CharField(max_length=100)
    latitude        = models.FloatField()
    longitude       = models.FloatField()
    fill_level      = models.FloatField(default=0.0)
    alert_status    = models.CharField(max_length=15, choices=AlertStatus.choices, default=AlertStatus.EMPTY)
    physical_status = models.CharField(max_length=15, choices=PhysicalStatus.choices, default=PhysicalStatus.OPERATIONAL)
    
    last_updated    = models.DateTimeField(auto_now=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'containers'

    def save(self, *args, **kwargs):
        # Logique métier : mise à jour automatique du statut d'alerte
        if self.fill_level >= 80:
            self.alert_status = self.AlertStatus.FULL
        elif self.fill_level >= 51:
            self.alert_status = self.AlertStatus.PARTIAL
        else:
            self.alert_status = self.AlertStatus.EMPTY
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Container {self.name} — {self.fill_level:.1f}%"


# ── LOGISTIQUE ET TRANSPORT ──────────────────────────────────────────────────

class Truck(models.Model):
    class Status(models.TextChoices):
        AVAILABLE  = 'AVAILABLE',  'Disponible'
        ON_MISSION = 'ON_MISSION', 'En mission'

    truck_id        = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    license_plate   = models.CharField(max_length=20, unique=True)
    capacity        = models.FloatField()
    current_load    = models.FloatField(default=0.0)
    mileage         = models.FloatField(default=0.0)
    latitude        = models.FloatField(null=True, blank=True)
    longitude       = models.FloatField(null=True, blank=True)
    status          = models.CharField(max_length=15, choices=Status.choices, default=Status.AVAILABLE)
    physical_status = models.CharField(max_length=15, choices=Container.PhysicalStatus.choices, default=Container.PhysicalStatus.OPERATIONAL)
    
    # Relation 1-à-1 : Un chauffeur par camion (et inversement)
    driver = models.OneToOneField(
        User, 
        null=True, 
        blank=True,
        on_delete=models.SET_NULL,
        limit_choices_to={'role': 'DRIVER'},
        related_name='assigned_truck'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'trucks'

    def __str__(self):
        return f"Camion {self.license_plate} ({self.status})"


# ── OPTIMISATION ET TOURNÉES (VRP) ───────────────────────────────────────────

class Route(models.Model):
    class Status(models.TextChoices):
        PLANNED     = 'PLANNED',     'Planifiée'
        IN_PROGRESS = 'IN_PROGRESS', 'En cours'
        COMPLETED   = 'COMPLETED',   'Terminée'

    route_id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    truck             = models.ForeignKey(Truck, on_delete=models.CASCADE, related_name='routes')
    total_distance_km = models.FloatField(default=0.0)
    status            = models.CharField(max_length=15, choices=Status.choices, default=Status.PLANNED)
    
    created_at        = models.DateTimeField(auto_now_add=True)
    started_at        = models.DateTimeField(null=True, blank=True)
    completed_at      = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'routes'
        ordering = ['-created_at']

    def __str__(self):
        return f"Tournée {self.route_id} — {self.status}"


class CollectionPoint(models.Model):
    point_id   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    route      = models.ForeignKey(Route, on_delete=models.CASCADE, related_name='collection_points')
    container  = models.ForeignKey(Container, on_delete=models.CASCADE, related_name='collection_points')
    stop_order = models.PositiveIntegerField()
    is_emptied = models.BooleanField(default=False)
    emptied_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'collection_points'
        ordering = ['stop_order']
        unique_together = [['route', 'stop_order']] # Un seul arrêt #1 par route

    def __str__(self):
        return f"Stop #{self.stop_order} pour la Route {self.route_id}"
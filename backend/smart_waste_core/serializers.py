from rest_framework import serializers
from .models import User, Container, Truck, Route, CollectionPoint

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['user_id', 'first_name', 'last_name', 'email', 'role']

class ContainerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Container
        fields = '__all__'
        read_only_fields = ('alert_status',)

class TruckSerializer(serializers.ModelSerializer):
    class Meta:
        model = Truck
        fields = '__all__'

class RouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Route
        fields = '__all__'

class CollectionPointSerializer(serializers.ModelSerializer):
    class Meta:
        model = CollectionPoint
        fields = '__all__'
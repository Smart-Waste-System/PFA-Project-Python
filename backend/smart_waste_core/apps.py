import os
from django.apps import AppConfig

class SmartWasteCoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'smart_waste_core'

    def ready(self):
        # Cette condition évite que le script MQTT ne se lance en double 
        # à cause du système de rechargement automatique de Django
        if os.environ.get('RUN_MAIN') == 'true':
            from . import mqtt
            mqtt.start_mqtt()
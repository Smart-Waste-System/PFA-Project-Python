import paho.mqtt.client as mqtt
import json
from .models import Container

BROKER_HOST = "localhost"
BROKER_PORT = 1884

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"✅ Django connecté au broker MQTT ({BROKER_HOST}:{BROKER_PORT})")
        client.subscribe("sensors/containers/+")
    elif rc == 1:
        print("❌ Connexion MQTT refusée : Version de protocole incorrecte")
    elif rc == 2:
        print("❌ Connexion MQTT refusée : Identifiant client invalide")
    elif rc == 3:
        print("❌ Connexion MQTT refusée : Serveur indisponible")
    elif rc == 4:
        print("❌ Connexion MQTT refusée : Mauvais identifiants")
    elif rc == 5:
        print("❌ Connexion MQTT refusée : Non autorisé")
    else:
        print(f"❌ Connexion MQTT échouée (Code inconnu: {rc})")

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode('utf-8'))
        container_id = msg.topic.split('/')[-1]
        fill_level = payload.get('fill_level')

        container = Container.objects.get(container_id=container_id)
        container.fill_level = fill_level
        # Le save() déclenchera automatiquement la RG-01 grâce à la fonction save() du modèle d'Aymane !
        container.save()
        
        print(f"🔄 Conteneur {container.name} mis à jour : {fill_level}% -> Statut: {container.alert_status}")
    except Container.DoesNotExist:
        pass # Silencieux pour éviter de polluer les logs si le capteur n'est pas en BDD
    except Exception as e:
        print(f"❌ Erreur de traitement MQTT: {e}")

def start_mqtt():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
    client.on_connect = on_connect
    client.on_message = on_message
    
    try:
        print(f"⏳ Tentative de connexion MQTT sur {BROKER_HOST}:{BROKER_PORT}...")
        client.connect(BROKER_HOST, BROKER_PORT, 60)
        client.loop_start()
    except Exception as e:
        print(f"🚨 CRITIQUE: Impossible de joindre le Broker MQTT. Erreur: {e}")
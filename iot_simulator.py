import paho.mqtt.client as mqtt
import time
import json
import random

# ⚠️ REMPLACE CETTE VALEUR PAR L'UUID QUE TU AS COPIÉ À L'ÉTAPE 1
CONTAINER_ID = "d3ae77f9-a35c-4700-bdd9-2a56e520dc81"

BROKER = "localhost"
PORT = 1884
TOPIC = f"sensors/containers/{CONTAINER_ID}"

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, "Capteur_HC_SR04_Simule")
client.connect(BROKER, PORT)

current_level = 0.0

print(f"🚀 Démarrage du capteur pour le conteneur {CONTAINER_ID}...")

while True:
    # On simule un remplissage aléatoire (entre +5% et +15%)
    current_level += random.uniform(5.0, 15.0)
    if current_level > 100:
        current_level = 100.0

    payload = {
        "fill_level": round(current_level, 2)
    }

    # Envoi de la donnée au broker Mosquitto
    client.publish(TOPIC, json.dumps(payload))
    print(f"📡 Publication MQTT : {payload['fill_level']}%")

    if current_level == 100.0:
        print("🛑 Débordement ! Le capteur s'arrête.")
        break

    # Le capteur envoie une donnée toutes les 4 secondes pour la démo
    time.sleep(4)
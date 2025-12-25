#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

//Provide the token generation process info.
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

#define WIFI_SSID "Caribou Coffee" //Ime wifi-a
#define WIFI_PASSWORD "mostar1506"

#define API_KEY "AIzaSyC2NZ1SOxCe7M6IqqCfySd8c9M0id19Xw8"

#define DATABASE_URL "https://hrus-8fa7f-default-rtdb.europe-west1.firebasedatabase.app" 

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

bool signupOK = false;

#define mq2Pin 32  
#define ledPin 26

float sensorValue = 0;
float maxCO;

bool turnOffAlarm = false;

bool test = false;

void setup() {
  Serial.begin(115200);
  pinMode(ledPin, OUTPUT); 
  
  analogReadResolution(12);
  
  analogSetAttenuation(ADC_11db);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED){
    Serial.print(".");
    delay(2000);
  }
  Serial.println();
  Serial.print("Connected with IP: ");
  Serial.println(WiFi.localIP());
  Serial.println();

  /* Assign the api key (required) */
  config.api_key = API_KEY;

  /* Assign the RTDB URL (required) */
  config.database_url = DATABASE_URL;

  /* Sign up */
  if (Firebase.signUp(&config, &auth, "", "")){
    Serial.println("ok");
    signupOK = true;
  }
  else{
    Serial.printf("%s\n", config.signer.signupError.message.c_str());
  }

  config.token_status_callback = tokenStatusCallback; 
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {
  if (Firebase.RTDB.getInt(&fbdo, "maxCO"))
    maxCO = fbdo.floatData();

  if (Firebase.RTDB.getBool(&fbdo, "turnOffAlarm"))
    turnOffAlarm = fbdo.boolData();

  if (Firebase.RTDB.getBool(&fbdo, "test"))
    test = fbdo.boolData();

  //digitalWrite(ledPin, test ? HIGH : LOW);

  if (test)
    blinkSOS();

  sensorValue = analogRead(mq2Pin); 

  float ppm = calculatePPM(sensorValue);
  float mgPerM3 = convertPPMToMgPerM3(ppm, 28.01);

  Serial.print("Alarm: ");
  Serial.print(turnOffAlarm ? "Off\n" : "On\n");
  
  Serial.print("CO concentration: ");
  Serial.print(ppm);
  Serial.print(" PPM, ");
  Serial.print(mgPerM3);
  Serial.println(" mg/m³");

  Firebase.RTDB.setInt(&fbdo, "gasConcentrationMgPerM3", mgPerM3);

  // SOS Alarm
  if(!turnOffAlarm && mgPerM3 >= maxCO)
  {
    blinkSOS();
  }
  else
  {
    digitalWrite(ledPin, LOW);
  }

  delay(1000); 
}


void blinkSOS() {
  for(int i = 0; i < 3; i++) {
    digitalWrite(ledPin, HIGH);
    delay(500);
    digitalWrite(ledPin, LOW);
    delay(500);
  }
  delay(500);
  for(int i = 0; i < 3; i++) {
    digitalWrite(ledPin, HIGH);
    delay(100);
    digitalWrite(ledPin, LOW);
    delay(100);
  }
  delay(500); 
}

float calculatePPM(int sensorValue) {
  return sensorValue * (1000.0 / 4095.0); 
}

float convertPPMToMgPerM3(float ppm, float molecularWeight) {
  return ppm * (molecularWeight / 24.45);
}
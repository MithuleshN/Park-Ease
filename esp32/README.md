# ParkEase — ESP32 Occupancy Sensor Node

Real hardware that drives the ParkEase parking clock. The web app starts/stops a
vehicle's clock purely from the **slot status transition** it sees in Firebase, so
this node only has to report that transition on `slots/{Area}/{Slot}` using the
exact field names the React app writes.

| Transition in Firebase | What the app does |
| --- | --- |
| `status: available → occupied` | **Clock START** — creates a `PARKED` session, `entryTime = occupancyTime` |
| `status: occupied → available` | **Clock STOP** — computes duration + fare, marks the session `OUT_COMPLETED` and *awaiting the exit-gate bill* |

The QR scan at the exit gate no longer times anything — it only *indicates* the
sensor-measured duration/fare and settles the bill.

---

## 0. PREREQUISITE — unlock the `parkingLogs` node

Verified against your live database just now:

| Node | Anonymous read | Anonymous write |
| --- | --- | --- |
| `slots` | ✅ | ✅ |
| `settings` | ✅ | ✅ |
| `bookings` | ✅ | — |
| **`parkingLogs`** | ❌ `Permission denied` | ❌ `Permission denied` |

The ESP32 side is **not** affected — it only writes `slots/...`, which is allowed.
But the **app cannot complete the loop**: `ParkingContext` listens on
`parkingLogs` and its occupancy watcher refuses to run until that listener
delivers data (`logsLoaded`). With the node locked you will see the slot flip to
*occupied* and then nothing — no session, no clock, no fare, no exit bill.

Fix it once in **Firebase Console → Realtime Database → Rules** (or with
`firebase deploy --only database`):

```json
{
  "rules": {
    "slots":       { ".read": true, ".write": true },
    "settings":    { ".read": true, ".write": true },
    "bookings":    { ".read": true, ".write": true },
    "parkingLogs": { ".read": true, ".write": true }
  }
}
```

Then reload the dashboard tab once. (These are wide-open demo rules — fine for a
mini-project demo, not for production.)

---

## 1. Files

```
esp32/
  ParkEase_Slot_Sensor/
    ParkEase_Slot_Sensor.ino   <- upload this (no external libraries needed)
  README.md
```

## 2. Hardware

ESP32 DevKit v1 (CH340 / CP2102 — the drivers `CH341SER/` and `CP210x…` are
already in this repo if Windows does not detect the board).

### Wiring — HC-SR04 ultrasonic (default, `SENSOR_MODE 1`)

| HC-SR04 | ESP32 |
| --- | --- |
| VCC | `VIN` / `5V` |
| GND | `GND` |
| TRIG | `GPIO 5` |
| ECHO | `GPIO 18` |

> The ECHO pin outputs 5 V on a bare HC-SR04. Many devkits tolerate it, but for a
> permanent build add a 1 kΩ + 2 kΩ divider so ECHO lands near 3.3 V.

Mount the sensor facing the ground/lane under the slot, then tune
`PRESENT_DISTANCE_CM` (default **30 cm**) using the distances printed on the
serial monitor.

### Wiring — IR / reed switch alternative (`SENSOR_MODE 2`)

Connect the switch between the sensor pin (`TRIG_PIN`, default `GPIO 5`) and
`GND`; it reads LOW when a car is over it.

### No sensor yet?

Nothing to wire — the **BOOT button (GPIO 0)** on the devkit forces a state
toggle on every press, so you can test the whole app flow immediately.

## 3. Configure (top of the `.ino`)

```cpp
WIFI_SSID     = "your WiFi";
WIFI_PASSWORD = "your password";

AREA_NAME = "Mall Parking";   // Mall/College/Hospital/Office Parking
SLOT_ID   = "A1";             // A1..A4 or B1..B4
```

`FIREBASE_HOST` is pre-filled with this project's database. `FIREBASE_AUTH`
stays **empty** — the `slots` node accepts anonymous writes, which is exactly how
the web app writes (verified against the live database).

## 4. Upload

1. Arduino IDE → **Tools → Board → ESP32 Arduino → ESP32 Dev Module**.
2. Select the COM port (install `CH341SER` / `CP210x` driver if it is missing).
3. Open `ParkEase_Slot_Sensor.ino` → **Upload**.
4. Open **Tools → Serial Monitor** at **115200 baud**.

Expected output:

```
==================================================
  ParkEase ESP32 slot node : Mall Parking / A1
  Target : https://parkease-5ebcc-default-rtdb.firebaseio.com/slots/Mall_Parking/A1.json
==================================================
[WiFi] connected, IP 192.168.1.7
[NTP] time UTC = 2026-10-03T09:41:12.000Z
[SLOT] boot state: EMPTY
[SENSOR] 143.2 cm -> raw:EMPTY   reported:AVAILABLE
```
## 5. Test it in the app (2 minutes)

1. **Open the ParkEase dashboard** and go to **Admin Dashboard**. Keep the tab
   open for the whole test — the parking session is created by the app's
   occupancy watcher, which runs in the browser.
2. **Turn the IoT simulator OFF** (Configuration panel → the *IoT Simulator*
   toggle). It flips random slots every 15 s and would otherwise fight your
   ESP32 for the same slot.
3. Check that the slot you configured (`Mall Parking → A1`) is shown as
   **Available** in the slot grid. If it holds old demo data, open it and set it
   to *Available* first.
4. **Move your hand / a car in front of the sensor** (or press BOOT).
   Serial: `[SLOT] car parked on Mall Parking/A1 -> CLOCK START (KL-01-AA-9999)`
   App: the slot turns **occupied** and a parking session starts — watch it
   appear in the telemetry logs with `status = PARKED`.
5. **Leave it "parked" for a minute or two**, then **remove the car**
   (or press BOOT again).
   Serial: `[SLOT] car left Mall Parking/A1 -> CLOCK STOP`
   App: the session becomes `OUT_COMPLETED` with a calculated duration & fare and
   shows a **Bill @ Exit Gate** button (sensor-measured, unbilled).
6. **Settle the bill**: scan the exit QR / click **Bill @ Exit Gate** → the exit
   modal shows *"Clock stopped by the slot occupancy sensor…"* with the
   sensor-measured duration & fare → submit → receipt.

That is the full IoT loop: **sensor starts the clock → sensor stops the clock →
exit-gate scan only indicates and bills.**

### Expected fare

Defaults from `settings`: rate **₹20/hr**, minimum **1 hour** (rounded up),
multipliers Bike `×0.5`, Car `×1.0`, EV `×1.0`, SUV `×1.25`, peak hours
**09:00–18:00** add **+20 %**, and `amountDue = total − deposit`.

So the demo car (type `Car`) always bills at least **₹20** (₹24 inside peak
hours) no matter how short the test was — that is the 1-hour minimum, not a bug.
Change `DEMO_VEHICLE_TYPE` to `Bike` for a ₹10 test.

## 6. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Slot flips to occupied but no session / log / fare ever appears | `parkingLogs` database rules lock the app out — see **section 0**. |
| Serial shows `[HTTP] PATCH 401` / `Permission denied` | Database rules were tightened. Add a Database Secret to `FIREBASE_AUTH`. |
| Slot turns occupied in the app but no parking session appears | The dashboard tab must be open (session creation is client-side) and finished loading `slots` + `parkingLogs`. |
| Entry time shows 1970 / ridiculous fare | NTP is blocked on your network (UDP 123). Allow NTP, or the clock cannot be timestamped accurately. |
| `[HTTP] GET -1` / `begin()` fails | TLS or WiFi problem — confirm the serial monitor shows a valid IP and `FIREBASE_HOST` is unchanged. |
| Slot flips back on its own every ~15 s | The app's **IoT Simulator** is still ON. |
| Distance reads `0.0 cm` or nothing | HC-SR04 wiring / VCC on 5 V. Check TRIG `GPIO 5`, ECHO `GPIO 18`. |
| Sensor triggers too late/early | Tune `PRESENT_DISTANCE_CM`; compare printed distance for a real car vs an empty lane. |
| Two nodes overwrite each other | Give every ESP32 its own `SLOT_ID`. |

## 7. Notes & limitations (demo scope)

- `client.setInsecure()` skips TLS certificate validation, which keeps the demo
  dependency-free. For production, pin Google's root CA
  (`client.setCACert(...)`) instead.
- `FIREBASE_AUTH` is empty because the `slots` node is world-writable — the same
  reason the web app works without signing in. Anyone with the database URL can
  write; lock this down before any real deployment.
- The parking clock, fare maths and session lifecycle all live in the browser
  (`src/context/ParkingContext.tsx`). A production build should move session
  creation/closing into a Cloud Function so the clock runs with no dashboard open.
- The node is intentionally idempotent: it never re-stamps `occupancyTime` on a
  slot that is already `occupied`, so restarting the ESP32 cannot reset a running
  clock.
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import {
  ref,
  onValue,
  set,
  update,
  get,
  remove,
} from 'firebase/database';

export type SlotStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';

/** Who currently owns a slot's occupancy (see Slot.sessionSource). */
export type SlotSessionSource = 'gate' | 'sensor' | 'simulator' | '';

export interface Slot {
  id: string;
  status: SlotStatus;
  vehicleNo?: string;
  vehicleModel?: string;
  vehicleType?: string;
  ownerName?: string;
  ownerPhone?: string;
  occupancyTime?: string;
  /**
   * Who last took ownership of this slot:
   *   'gate'      -> an admin gate check-in (QR scan / walk-in IN)
   *   'sensor'    -> the ESP32 occupancy node stamped the identity
   *   'simulator' -> the local IoT demo simulator
   *   ''          -> nobody, the slot is free again
   * The demo simulator refuses to touch a 'gate' slot, so a real check-in can
   * never be wiped by the 15-second simulation loop.
   */
  sessionSource?: SlotSessionSource;
  sensorStatus: 'Active' | 'Inactive';
}

export interface Reservation {
  bookingId: string;
  reservationId: string;
  area: string;
  slotId: string;
  date: string;
  time: string;
  deposit: number;
  name: string;
  phone: string;
  vehicleNo: string;
  vehicleModel: string;
  vehicleType: string;
  status: 'Confirmed' | 'Cancelled';
  createdAt: string;
}

export interface ParkingLog {
  logId: string;
  bookingId?: string;
  area: string;
  slotId: string;
  vehicleNo: string;
  vehicleModel?: string;
  vehicleType?: string;
  ownerName?: string;
  ownerPhone?: string;
  entryTime: string; // ISO string or timestamp
  exitTime?: string; // ISO string or timestamp
  durationMinutes?: number;
  hourlyRate: number;
  depositPaid: number;
  baseFare?: number;
  peakSurcharge?: number;
  totalFare?: number;
  amountDue?: number;
  status: 'PARKED' | 'OUT_COMPLETED';
  createdAt: string;
  /**
   * True while the car has been authorised at the barrier (gate hold,
   * bay 'reserved') but has NOT physically reached the bay yet. The parking
   * clock only starts when the slot sensor confirms arrival (occupied).
   */
  awaitingArrival?: boolean;
  /** True once the exit-gate scan has settled (paid) the bill. */
  billed?: boolean;
  billedAt?: string;
  /** True when the clock was stopped automatically by the occupancy sensor. */
  autoClosedBySensor?: boolean;
}

export interface FareDetails {
  durationMinutes: number;
  durationFormatted: string;
  chargedHours: number;
  hourlyRate: number;
  vehicleType: string;
  vehicleMultiplier: number;
  baseFare: number;
  isPeak: boolean;
  peakSurcharge: number;
  totalFare: number;
  depositPaid: number;
  amountDue: number;
}

export interface ParkingSettings {
  peakHoursStart: string;
  peakHoursEnd: string;
  depositFee: number;
  hourlyRate: number;
  gracePeriod: number;
  reservationExpiry: number;
  isSimulating: boolean;
}

interface ParkingContextType {
  slots: Record<string, Slot[]>;
  bookings: Reservation[];
  parkingLogs: ParkingLog[];
  settings: ParkingSettings;
  activeArea: string;
  loading: boolean;
  setActiveArea: (area: string) => void;
  reserveSlot: (booking: Omit<Reservation, 'bookingId' | 'reservationId' | 'createdAt' | 'status'>) => Promise<Reservation>;
  cancelReservation: (bookingId: string) => void;
  updateSlotStatus: (area: string, slotId: string, status: SlotStatus, extra?: Partial<Slot>) => void;
  updateSettings: (newSettings: Partial<ParkingSettings>) => void;
  isPeakHour: (timeStr: string) => boolean;
  processVehicleEntry: (data: {
    area: string;
    slotId: string;
    vehicleNo: string;
    vehicleModel?: string;
    vehicleType?: string;
    ownerName?: string;
    ownerPhone?: string;
    bookingId?: string;
    entryTime?: string;
  }) => Promise<ParkingLog>;
  processVehicleExit: (
    logIdOrSlotId: string,
    area?: string,
    exitTimeStr?: string
  ) => Promise<{ log: ParkingLog; fareDetails: FareDetails }>;
  calculateFareDetails: (
    entryTimeStr: string,
    exitTimeStr?: string,
    overrideHourlyRate?: number,
    vehicleType?: string,
    depositPaid?: number,
    area?: string
  ) => FareDetails;
}

const ParkingContext = createContext<ParkingContextType | undefined>(undefined);

// ─── Default seed data (written to Firebase only once on first run) ───────────

const buildInitialSlots = (): Record<string, Record<string, Slot>> => {
  const layouts = ['Mall Parking', 'College Parking', 'Hospital Parking', 'Office Parking'];
  const data: Record<string, Record<string, Slot>> = {};

  layouts.forEach((area) => {
    data[area] = {};
    const rows = ['A', 'B'];
    rows.forEach((row) => {
      for (let i = 1; i <= 4; i++) {
        const id = `${row}${i}`;
        let status: SlotStatus = 'available';
        let vehicleNo = '';
        let vehicleModel = '';
        let vehicleType = '';
        let ownerName = '';
        let ownerPhone = '';
        let occupancyTime = '';

        if (area === 'Mall Parking') {
          if (id === 'A2') {
            status = 'occupied'; vehicleNo = 'DL-3C-AB-1234'; vehicleModel = 'Hyundai i20';
            vehicleType = 'Car'; ownerName = 'Amit Sharma'; ownerPhone = '9876543210'; occupancyTime = '45 mins ago';
          } else if (id === 'A3') {
            status = 'reserved'; vehicleNo = 'MH-12-PQ-7890'; vehicleModel = 'Tata Nexon EV';
            vehicleType = 'EV'; ownerName = "Sarah D'souza"; ownerPhone = '8765432109'; occupancyTime = 'Reserved for 15:00';
          } else if (id === 'B3') {
            status = 'occupied'; vehicleNo = 'KA-51-MM-4321'; vehicleModel = 'KTM Duke 390';
            vehicleType = 'Bike'; ownerName = 'Vikram Roy'; ownerPhone = '7654321098'; occupancyTime = '12 mins ago';
          } else if (id === 'B4') {
            status = 'maintenance';
          }
        } else if (area === 'College Parking') {
          if (id === 'A4') {
            status = 'occupied'; vehicleNo = 'UP-16-BD-8800'; vehicleModel = 'Royal Enfield';
            vehicleType = 'Bike'; ownerName = 'Rohit Verma'; ownerPhone = '9999888877'; occupancyTime = '2 hours ago';
          } else if (id === 'B2') {
            status = 'reserved'; vehicleNo = 'HR-26-CZ-5678'; vehicleModel = 'MG ZS EV';
            vehicleType = 'EV'; ownerName = 'Meera Sen'; ownerPhone = '8888777766'; occupancyTime = 'Reserved for 14:30';
          }
        } else if (area === 'Hospital Parking') {
          if (id === 'A1') {
            status = 'occupied'; vehicleNo = 'MH-02-EE-1122'; vehicleModel = 'Toyota Innova';
            vehicleType = 'SUV'; ownerName = 'Dr. Anil Mehta'; ownerPhone = '9811223344'; occupancyTime = '3 hours ago';
          } else if (id === 'A2') {
            status = 'occupied'; vehicleNo = 'DL-1C-ZA-9090'; vehicleModel = 'Mahindra XUV700';
            vehicleType = 'SUV'; ownerName = 'Karan Johar'; ownerPhone = '9811223344'; occupancyTime = '1 hour ago';
          }
        } else {
          if (id === 'B1') {
            status = 'occupied'; vehicleNo = 'KA-03-HH-7777'; vehicleModel = 'Tesla Model 3';
            vehicleType = 'EV'; ownerName = 'Siddharth Nair'; ownerPhone = '9000100020'; occupancyTime = '4 hours ago';
          }
        }

        const slotKey = id.replace(/[^a-zA-Z0-9]/g, '_');
        data[area][slotKey] = {
          id,
          status,
          vehicleNo: vehicleNo || '',
          vehicleModel: vehicleModel || '',
          vehicleType: vehicleType || '',
          ownerName: ownerName || '',
          ownerPhone: ownerPhone || '',
          occupancyTime: occupancyTime || '',
          sensorStatus: status === 'occupied' ? 'Active' : 'Inactive',
        };
      }
    });
  });

  return data;
};

const defaultSettings: ParkingSettings = {
  peakHoursStart: '09:00',
  peakHoursEnd: '18:00',
  depositFee: 50,
  hourlyRate: 20,
  gracePeriod: 15,
  reservationExpiry: 30,
  // OFF by default: the simulator overwrites real gate check-ins and sensor
  // reports, so it must be opt-in only (demo use).
  isSimulating: false,
};

// Convert Firebase object (keyed by slotKey) → Slot[] array
const objectToSlotArray = (obj: Record<string, Slot>): Slot[] => {
  if (!obj) return [];
  return Object.values(obj);
};

// Area name → Firebase-safe key
const areaKey = (area: string) => area.replace(/ /g, '_');

// Estimate an occupancy start timestamp from human-readable slot text such as
// 'Just now', '45 mins ago' or '2 hours ago'. Returns null for reservations.
const parseOccupancyToIso = (occupancyTime?: string): string | null => {
  if (!occupancyTime) return null;
  const text = occupancyTime.trim();
  if (!text || text.includes('Reserved') || text.includes('Gate authorised')) return null;
  if (text === 'Just now') return new Date().toISOString();

  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();

  const mins = text.match(/(\d+)\s*min/i);
  if (mins) return new Date(Date.now() - parseInt(mins[1], 10) * 60000).toISOString();

  const hours = text.match(/(\d+)\s*hour/i);
  if (hours) return new Date(Date.now() - parseInt(hours[1], 10) * 3600000).toISOString();

  return new Date().toISOString();
};

export const ParkingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [slots, setSlots] = useState<Record<string, Slot[]>>({});
  const [bookings, setBookings] = useState<Reservation[]>([]);
  const [settings, setSettings] = useState<ParkingSettings>(defaultSettings);
  const [activeArea, setActiveArea] = useState<string>('Mall Parking');
  const [loading, setLoading] = useState(true);

  // ── Occupancy-clock refs ───────────────────────────────────────────────────
  // The parking clock is driven by SLOT status transitions (the IoT sensor sees
  // a car park → start; sees it leave → stop), NOT by the QR scan. These refs
  // expose the latest data to the transition watcher without stale closures,
  // and guard against opening two sessions for the same slot.
  const slotsRef = useRef<Record<string, Slot[]>>({});
  const logsRef = useRef<ParkingLog[]>([]);
  const bookingsRef = useRef<Reservation[]>([]);
  const prevSlotsRef = useRef<Record<string, Slot[]> | null>(null);
  const activeSessionKeysRef = useRef<Set<string>>(new Set());

  // ── Seed Firebase with initial data if empty ────────────────────────────────
  useEffect(() => {
    const seedIfEmpty = async () => {
      const slotsSnap = await get(ref(db, 'slots'));
      if (!slotsSnap.exists()) {
        const initialSlots = buildInitialSlots();
        // Convert area names to Firebase-safe keys
        const firebaseSlots: Record<string, Record<string, Slot>> = {};
        Object.entries(initialSlots).forEach(([area, slotMap]) => {
          firebaseSlots[areaKey(area)] = slotMap;
        });
        await set(ref(db, 'slots'), firebaseSlots);
      }

      const settingsSnap = await get(ref(db, 'settings'));
      if (!settingsSnap.exists()) {
        await set(ref(db, 'settings'), defaultSettings);
      }
    };
    seedIfEmpty();
  }, []);

  // ── Real-time listener: slots ───────────────────────────────────────────────
  useEffect(() => {
    const unsub = onValue(ref(db, 'slots'), (snap) => {
      if (!snap.exists()) return;
      const raw = snap.val() as Record<string, Record<string, Slot>>;
      const parsed: Record<string, Slot[]> = {};
      // Map Firebase keys back to display names
      const keyToArea: Record<string, string> = {
        Mall_Parking: 'Mall Parking',
        College_Parking: 'College Parking',
        Hospital_Parking: 'Hospital Parking',
        Office_Parking: 'Office Parking',
      };
      Object.entries(raw).forEach(([key, slotMap]) => {
        const displayName = keyToArea[key] || key;
        parsed[displayName] = objectToSlotArray(slotMap);
      });
      setSlots(parsed);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Real-time listener: bookings ────────────────────────────────────────────
  useEffect(() => {
    const unsub = onValue(ref(db, 'bookings'), (snap) => {
      if (!snap.exists()) {
        setBookings([]);
        return;
      }
      const raw = snap.val() as Record<string, Reservation>;
      const list = Object.values(raw).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setBookings(list);
    });
    return () => unsub();
  }, []);

  // ── Real-time listener: settings ────────────────────────────────────────────
  useEffect(() => {
    const unsub = onValue(ref(db, 'settings'), (snap) => {
      if (!snap.exists()) return;
      setSettings(snap.val() as ParkingSettings);
    });
    return () => unsub();
  }, []);

  // ── isPeakHour ──────────────────────────────────────────────────────────────
  const isPeakHour = (timeStr: string): boolean => {
    if (!timeStr) return false;
    const [h, m] = timeStr.split(':').map(Number);
    const val = h * 60 + m;
    const [sh, sm] = settings.peakHoursStart.split(':').map(Number);
    const [eh, em] = settings.peakHoursEnd.split(':').map(Number);
    return val >= sh * 60 + sm && val <= eh * 60 + em;
  };

  // ── reserveSlot (writes to Firebase) ───────────────────────────────────────
  const reserveSlot = async (
    bookingData: Omit<Reservation, 'bookingId' | 'reservationId' | 'createdAt' | 'status'>
  ): Promise<Reservation> => {
    const bookingId = `BK-${Math.floor(10000 + Math.random() * 90000)}`;
    const reservationId = `RSV-${Math.floor(10000 + Math.random() * 90000)}`;

    const newReservation: Reservation = {
      ...bookingData,
      bookingId,
      reservationId,
      status: 'Confirmed',
      createdAt: new Date().toISOString(),
    };

    // Write booking to Firebase
    await set(ref(db, `bookings/${bookingId}`), newReservation);

    // Update slot status in Firebase
    const slotKey = bookingData.slotId.replace(/[^a-zA-Z0-9]/g, '_');
    await update(ref(db, `slots/${areaKey(bookingData.area)}/${slotKey}`), {
      status: 'reserved',
      vehicleNo: bookingData.vehicleNo,
      vehicleModel: bookingData.vehicleModel,
      vehicleType: bookingData.vehicleType,
      ownerName: bookingData.name,
      ownerPhone: bookingData.phone,
      occupancyTime: `Reserved for ${bookingData.time}`,
      sensorStatus: 'Inactive',
    });

    return newReservation;
  };

  // ── cancelReservation (writes to Firebase) ──────────────────────────────────
  const cancelReservation = async (bookingId: string) => {
    // Update booking status
    await update(ref(db, `bookings/${bookingId}`), { status: 'Cancelled' });

    // Free the slot
    const booking = bookings.find((b) => b.bookingId === bookingId);
    if (booking) {
      const slotKey = booking.slotId.replace(/[^a-zA-Z0-9]/g, '_');
      await update(ref(db, `slots/${areaKey(booking.area)}/${slotKey}`), {
        status: 'available',
        vehicleNo: '',
        vehicleModel: '',
        vehicleType: '',
        ownerName: '',
        ownerPhone: '',
        occupancyTime: '',
        sensorStatus: 'Inactive',
      });
    }
  };

  // ── updateSlotStatus (writes to Firebase) ───────────────────────────────────
  const updateSlotStatus = async (
    area: string,
    slotId: string,
    status: SlotStatus,
    extra?: Partial<Slot>
  ) => {
    const slotKey = slotId.replace(/[^a-zA-Z0-9]/g, '_');
    await update(ref(db, `slots/${areaKey(area)}/${slotKey}`), {
      status,
      sensorStatus: status === 'occupied' ? 'Active' : 'Inactive',
      ...(extra || {}),
    });
  };

  // ── updateSettings (writes to Firebase) ─────────────────────────────────────
  const updateSettings = async (newSettings: Partial<ParkingSettings>) => {
    await update(ref(db, 'settings'), newSettings);
  };

  // ── IoT Simulator (runs locally, writes to Firebase) ────────────────────────
  useEffect(() => {
    if (!settings.isSimulating || Object.keys(slots).length === 0) return;

    const interval = setInterval(() => {
      const locations = Object.keys(slots);
      const randomLoc = locations[Math.floor(Math.random() * locations.length)];
      const locSlots = slots[randomLoc];
      if (!locSlots) return;

      // A slot owned by a real GATE check-in is off-limits to the demo
      // simulator while it is a gate HOLD (reserved): the car has not arrived
      // yet, so flipping the bay occupied/available would fake a parking
      // session and wipe the driver's identity. Once the car HAS arrived
      // (gate slot turned 'occupied' by the sensor/simulator), demo mode may
      // free it again to demonstrate check-out.
      const eligible = locSlots.filter((s) => {
        if (s.sessionSource === 'gate' && s.status !== 'occupied') return false;
        return s.status === 'available' || s.status === 'occupied';
      });
      if (eligible.length === 0) return;

      const randomSlot = eligible[Math.floor(Math.random() * eligible.length)];

      if (randomSlot.status === 'available') {
        // Never inject a demo car onto a bay that real traffic is bound for:
        // a gate-held (reserved) or pre-booked bay must keep the booked
        // driver's identity until the real car arrives.
        if (randomSlot.sessionSource === 'gate' || randomSlot.vehicleNo) return;
        const plateCodes = ['DL', 'KA', 'MH', 'HR', 'UP'];
        const plate = `${plateCodes[Math.floor(Math.random() * plateCodes.length)]}-${Math.floor(10 + Math.random() * 89)}-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}-${Math.floor(1000 + Math.random() * 8999)}`;
        const models = {
          Car: ['Maruti Swift', 'Hyundai Verna', 'Honda City'],
          SUV: ['Mahindra Thar', 'Kia Seltos', 'Tata Safari'],
          EV: ['Ather 450X', 'Tata Punch EV', 'Hyundai Ioniq 5'],
        };
        const types = Object.keys(models) as Array<keyof typeof models>;
        const randomType = types[Math.floor(Math.random() * types.length)];
        const randomModel = models[randomType][Math.floor(Math.random() * models[randomType].length)];

        updateSlotStatus(randomLoc, randomSlot.id, 'occupied', {
          vehicleNo: plate,
          vehicleModel: randomModel,
          vehicleType: randomType,
          ownerName: 'IoT Sensor Node ' + Math.floor(1 + Math.random() * 9),
          ownerPhone: '95' + Math.floor(10000000 + Math.random() * 89999999),
          occupancyTime: new Date().toISOString(),
          sessionSource: 'simulator',
        });
      } else if (randomSlot.sessionSource === 'simulator') {
        // Demo mode only frees slots IT occupied: freeing a real gate /
        // sensor session here is what faked check-outs (red -> green) and
        // re-stamped the demo plate on the real car's arrival.
        updateSlotStatus(randomLoc, randomSlot.id, 'available', {
          vehicleNo: '',
          vehicleModel: '',
          vehicleType: '',
          ownerName: '',
          ownerPhone: '',
          occupancyTime: '',
          sessionSource: '',
        });
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [settings.isSimulating, slots]);

  const [parkingLogs, setParkingLogs] = useState<ParkingLog[]>([]);
  // Session watcher only runs once the existing logs have been read, so it never
  // re-creates a session that already exists in Firebase.
  const [logsLoaded, setLogsLoaded] = useState(false);

  // ── Real-time listener: parkingLogs ─────────────────────────────────────────
  useEffect(() => {
    const unsub = onValue(ref(db, 'parkingLogs'), (snap) => {
      if (!snap.exists()) {
        setParkingLogs([]);
        setLogsLoaded(true);
        return;
      }
      const raw = snap.val() as Record<string, ParkingLog>;
      const list = Object.values(raw).sort(
        (a, b) => new Date(b.createdAt || b.entryTime).getTime() - new Date(a.createdAt || a.entryTime).getTime()
      );
      setParkingLogs(list);
      setLogsLoaded(true);
    });
    return () => unsub();
  }, []);

  // ── Keep refs in sync so the transition watcher always sees fresh data ─────
  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  useEffect(() => {
    bookingsRef.current = bookings;
  }, [bookings]);

  useEffect(() => {
    logsRef.current = parkingLogs;
    // Rebuild the set of slots that currently hold an open (PARKED) session
    const keys = new Set<string>();
    parkingLogs.forEach((log) => {
      if (log.status === 'PARKED') keys.add(`${log.area}::${log.slotId}`);
    });
    activeSessionKeysRef.current = keys;
  }, [parkingLogs]);

  // ── calculateFareDetails ───────────────────────────────────────────────────
  const calculateFareDetails = (
    entryTimeStr: string,
    exitTimeStr?: string,
    overrideHourlyRate?: number,
    vehicleType: string = 'Car',
    depositPaid: number = 0,
    _area: string = 'Mall Parking'
  ): FareDetails => {
    let entry = new Date(entryTimeStr);
    if (isNaN(entry.getTime())) {
      // Fallback: parse relative strings like '45 mins ago', 'Just now', '2 hours ago'
      if (entryTimeStr.includes('min')) {
        const mins = parseInt(entryTimeStr) || 15;
        entry = new Date(Date.now() - mins * 60 * 1000);
      } else if (entryTimeStr.includes('hour')) {
        const hrs = parseInt(entryTimeStr) || 1;
        entry = new Date(Date.now() - hrs * 60 * 60 * 1000);
      } else {
        entry = new Date(Date.now() - 30 * 60 * 1000); // 30 mins default
      }
    }
    const exit = exitTimeStr ? new Date(exitTimeStr) : new Date();

    const diffMs = Math.max(0, exit.getTime() - entry.getTime());
    // Round up to the nearest minute, minimum 1 minute
    const durationMinutes = Math.max(1, Math.ceil(diffMs / (1000 * 60)));

    // Billing: charge per started hour, minimum 1 hour
    const chargedHours = Math.max(1, Math.ceil(durationMinutes / 60));

    // Vehicle type multipliers
    const multipliers: Record<string, number> = {
      Bike: 0.5,
      Car: 1.0,
      EV: 1.0,
      SUV: 1.25,
    };
    const vehicleMultiplier = multipliers[vehicleType] ?? 1.0;

    const rate = overrideHourlyRate ?? settings.hourlyRate;
    const baseFare = Math.round(chargedHours * rate * vehicleMultiplier);

    // Peak surcharge check (based on ENTRY time — when car arrived at the slot)
    const entryHH = String(entry.getHours()).padStart(2, '0');
    const entryMM = String(entry.getMinutes()).padStart(2, '0');
    const entryTimeFormatted = `${entryHH}:${entryMM}`;
    const peak = isPeakHour(entryTimeFormatted);
    const peakSurcharge = peak ? Math.round(baseFare * 0.2) : 0; // 20% surcharge during peak

    const totalFare = baseFare + peakSurcharge;
    const amountDue = Math.max(0, totalFare - depositPaid);

    const hrs = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const durationFormatted = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} min`;

    return {
      durationMinutes,
      durationFormatted,
      chargedHours,
      hourlyRate: rate,
      vehicleType,
      vehicleMultiplier,
      baseFare,
      isPeak: peak,
      peakSurcharge,
      totalFare,
      depositPaid,
      amountDue,
    };
  };

  // ── processVehicleEntry ─────────────────────────────────────────────────────
  const processVehicleEntry = async (data: {
    area: string;
    slotId: string;
    vehicleNo: string;
    vehicleModel?: string;
    vehicleType?: string;
    ownerName?: string;
    ownerPhone?: string;
    bookingId?: string;
    entryTime?: string;
  }): Promise<ParkingLog> => {
    const entryTime = data.entryTime || new Date().toISOString();

    // Opening this session now (the slot is HELD at this instant - the car has
    // only been authorised at the barrier and has NOT reached the bay yet) so
    // the occupancy watcher does not open a duplicate one for the same slot.
    const sessionKey = `${data.area}::${data.slotId}`;
    // Guard against double-submit / double-scan creating twin PARKED logs.
    const existingHold =
      logsRef.current.find(
        (l) => l.status === 'PARKED' && l.area === data.area && l.slotId === data.slotId
      ) ||
      parkingLogs.find(
        (l) => l.status === 'PARKED' && l.area === data.area && l.slotId === data.slotId
      );
    if (existingHold) {
      activeSessionKeysRef.current.add(sessionKey);
      return existingHold;
    }
    activeSessionKeysRef.current.add(sessionKey);
    const logId = `LOG-${Math.floor(10000 + Math.random() * 90000)}`;

    let depositPaid = 0;
    if (data.bookingId) {
      const b = bookings.find((bk) => bk.bookingId === data.bookingId);
      if (b) depositPaid = b.deposit;
    } else {
      const areaSlots = slots[data.area] || [];
      const currentSlot = areaSlots.find((s) => s.id === data.slotId);
      if (currentSlot && currentSlot.status === 'reserved') {
        const b = bookings.find(
          (bk) => bk.vehicleNo.toUpperCase() === data.vehicleNo.toUpperCase() && bk.status === 'Confirmed'
        );
        if (b) depositPaid = b.deposit;
      }
    }

    const newLog: ParkingLog = {
      logId,
      bookingId: data.bookingId || '',
      area: data.area,
      slotId: data.slotId,
      vehicleNo: data.vehicleNo.toUpperCase(),
      vehicleModel: data.vehicleModel || 'Standard Vehicle',
      vehicleType: data.vehicleType || 'Car',
      ownerName: data.ownerName || 'Walk-in Driver',
      ownerPhone: data.ownerPhone || 'N/A',
      entryTime,
      hourlyRate: settings.hourlyRate,
      depositPaid,
      status: 'PARKED',
      createdAt: new Date().toISOString(),
      // Gate hold: authorised at the barrier, car has NOT reached the bay yet.
      // The clock starts only when the slot reports occupied (arrival).
      awaitingArrival: true,
    };

    // Write log to Firebase
    await set(ref(db, `parkingLogs/${logId}`), newLog);

    // Update slot status in Firebase.
    // GATE HOLD (not a parking clock): the car has been authorised at the
    // barrier but has NOT reached the bay yet, so the bay is 'reserved' and
    // held. It only turns 'occupied' (clock START) when the slot sensor /
    // simulator confirms the car physically arrived. This is what stops the
    // slot going red briefly and flipping green again before the car arrives.
    const slotKey = data.slotId.replace(/[^a-zA-Z0-9]/g, '_');
    await update(ref(db, `slots/${areaKey(data.area)}/${slotKey}`), {
      status: 'reserved',
      vehicleNo: data.vehicleNo.toUpperCase(),
      vehicleModel: data.vehicleModel || 'Standard Vehicle',
      vehicleType: data.vehicleType || 'Car',
      ownerName: data.ownerName || 'Walk-in Driver',
      ownerPhone: data.ownerPhone || 'N/A',
      occupancyTime: `Gate authorised — awaiting arrival (${entryTime})`,
      sensorStatus: 'Inactive',
      sessionSource: 'gate',
    });

    return newLog;
  };

  // ── processVehicleExit ──────────────────────────────────────────────────────
  const processVehicleExit = async (
    logIdOrSlotId: string,
    area: string = activeArea,
    exitTimeStr?: string
  ): Promise<{ log: ParkingLog; fareDetails: FareDetails }> => {
    const exitTime = exitTimeStr || new Date().toISOString();

    // Locate the session: explicit log id, then the open session for the slot,
    // then a sensor-closed session that is still awaiting the exit-gate bill.
    // A gate HOLD (awaitingArrival) has no running clock: the car was
    // authorised at the barrier but never reached the bay, so scanning OUT
    // must be rejected instead of billing a phantom stay.
    let activeLog =
      logsRef.current.find((l) => l.logId === logIdOrSlotId) ||
      logsRef.current.find(
        (l) => l.status === 'PARKED' && l.slotId === logIdOrSlotId && l.area === area
      ) ||
      parkingLogs.find(
        (l) => l.status === 'PARKED' && (l.logId === logIdOrSlotId || (l.slotId === logIdOrSlotId && l.area === area))
      );
    if (
      activeLog?.status === 'PARKED' &&
      (activeLog.awaitingArrival || activeLog.entryTime?.includes('Gate authorised'))
    ) {
      throw new Error(
        `Vehicle ${activeLog.vehicleNo} was authorised at the gate for slot ${activeLog.slotId} but has not arrived yet — there is no parking time to bill.`
      );
    }

    // ── Case A: the occupancy sensor already stopped the clock when the slot
    // emptied. The exit-gate scan only INDICATES the elapsed time and fare, and
    // settles the bill — it must NOT re-time the stay.
    if (activeLog && activeLog.status === 'OUT_COMPLETED') {
      const sensorExit = activeLog.exitTime || exitTime;
      const sensorFare = calculateFareDetails(
        activeLog.entryTime,
        sensorExit,
        activeLog.hourlyRate || settings.hourlyRate,
        activeLog.vehicleType || 'Car',
        activeLog.depositPaid || 0,
        activeLog.area
      );
      const settledLog: ParkingLog = {
        ...activeLog,
        exitTime: sensorExit,
        durationMinutes: activeLog.durationMinutes ?? sensorFare.durationMinutes,
        baseFare: activeLog.baseFare ?? sensorFare.baseFare,
        peakSurcharge: activeLog.peakSurcharge ?? sensorFare.peakSurcharge,
        totalFare: activeLog.totalFare ?? sensorFare.totalFare,
        amountDue: activeLog.amountDue ?? sensorFare.amountDue,
        status: 'OUT_COMPLETED',
        billed: true,
        billedAt: new Date().toISOString(),
      };
      await set(ref(db, `parkingLogs/${settledLog.logId}`), settledLog);
      activeSessionKeysRef.current.delete(`${settledLog.area}::${settledLog.slotId}`);
      return { log: settledLog, fareDetails: sensorFare };
    }

    if (!activeLog) {
      const areaSlots = slots[area] || [];
      const targetSlot = areaSlots.find((s) => s.id === logIdOrSlotId);
      const entryIso =
        targetSlot?.occupancyTime &&
        !targetSlot.occupancyTime.includes('Gate authorised') &&
        !targetSlot.occupancyTime.includes('ago') &&
        !targetSlot.occupancyTime.includes('Reserved')
          ? targetSlot.occupancyTime
          : new Date(Date.now() - 45 * 60 * 1000).toISOString();

      let depositPaid = 0;
      if (targetSlot?.vehicleNo) {
        const targetPlate = targetSlot.vehicleNo.toUpperCase();
        const b = bookings.find(
          (bk) => bk.vehicleNo.toUpperCase() === targetPlate && bk.status === 'Confirmed'
        );
        if (b) depositPaid = b.deposit;
      }

      activeLog = {
        logId: `LOG-${Math.floor(10000 + Math.random() * 90000)}`,
        area,
        slotId: logIdOrSlotId,
        vehicleNo: targetSlot?.vehicleNo || 'UNKNOWN',
        vehicleModel: targetSlot?.vehicleModel || 'Car',
        vehicleType: targetSlot?.vehicleType || 'Car',
        ownerName: targetSlot?.ownerName || 'Driver',
        ownerPhone: targetSlot?.ownerPhone || 'N/A',
        entryTime: entryIso,
        hourlyRate: settings.hourlyRate,
        depositPaid,
        status: 'PARKED',
        createdAt: entryIso,
      };
    }

    const fare = calculateFareDetails(
      activeLog.entryTime,
      exitTime,
      activeLog.hourlyRate || settings.hourlyRate,
      activeLog.vehicleType || 'Car',
      activeLog.depositPaid || 0,
      activeLog.area
    );

    const updatedLog: ParkingLog = {
      ...activeLog,
      exitTime,
      durationMinutes: fare.durationMinutes,
      baseFare: fare.baseFare,
      peakSurcharge: fare.peakSurcharge,
      totalFare: fare.totalFare,
      amountDue: fare.amountDue,
      status: 'OUT_COMPLETED',
      billed: true,
      billedAt: new Date().toISOString(),
      autoClosedBySensor: false,
    };

    // Update log in Firebase
    await set(ref(db, `parkingLogs/${updatedLog.logId}`), updatedLog);

    // Free slot in Firebase
    const slotKey = activeLog.slotId.replace(/[^a-zA-Z0-9]/g, '_');
    await update(ref(db, `slots/${areaKey(activeLog.area)}/${slotKey}`), {
      status: 'available',
      vehicleNo: '',
      vehicleModel: '',
      vehicleType: '',
      ownerName: '',
      ownerPhone: '',
      occupancyTime: '',
      sensorStatus: 'Inactive',
      sessionSource: '',
    });
    activeSessionKeysRef.current.delete(`${activeLog.area}::${activeLog.slotId}`);

    return { log: updatedLog, fareDetails: fare };
  };

  // ── Sensor-driven parking sessions ────────────────────────────────────────
  // The parking clock is driven by SLOT occupancy ONLY:
  //   reserved(gate hold) -> occupied  ==>  clock START (the car physically arrived)
  //   occupied            -> available ==>  clock STOP  (the car left the slot)
  // Gate check-in only creates a PARKED hold log + 'reserved' slot hold; the clock
  // does NOT run until the slot sensor confirms the car is physically in the bay.
  const openSessionForSlot = async (area: string, slot: Slot) => {
    const key = `${area}::${slot.id}`;
    if (activeSessionKeysRef.current.has(key)) return; // already tracking
    if (!slot.vehicleNo) return; // unknown vehicle — nothing to bill

    // A car authorised at the gate already owns a PARKED hold log.
    // When the slot goes OCCUPIED the sensor confirms arrival → stamp the
    // REAL clock-start time (right now) on the held log instead of opening
    // a duplicate session.
    const heldLog =
      logsRef.current.find(
        (l) => l.status === 'PARKED' && l.area === area && l.slotId === slot.id
      ) ||
      parkingLogs.find(
        (l) => l.status === 'PARKED' && l.area === area && l.slotId === slot.id
      );
    if (heldLog) {
      activeSessionKeysRef.current.add(key);
      // Clock START = the moment the slot sensor sees the car arrive.
      // Use current time as the authoritative entry time (most accurate).
      // If the slot's occupancyTime is a valid ISO string (set by the sensor/
      // simulator at the exact moment the car arrived), prefer that.
      let arrivalIso = new Date().toISOString();
      if (
        slot.occupancyTime &&
        !slot.occupancyTime.includes('Gate authorised') &&
        !slot.occupancyTime.includes('Reserved') &&
        !slot.occupancyTime.includes('ago')
      ) {
        const parsed = new Date(slot.occupancyTime);
        if (!isNaN(parsed.getTime())) arrivalIso = parsed.toISOString();
      }
      const arrivedLog: ParkingLog = {
        ...heldLog,
        entryTime: arrivalIso, // ← REAL clock start (slot occupied time)
        vehicleNo: slot.vehicleNo.toUpperCase(),
        vehicleModel: slot.vehicleModel || heldLog.vehicleModel,
        vehicleType: slot.vehicleType || heldLog.vehicleType,
        ownerName: slot.ownerName || heldLog.ownerName,
        ownerPhone: slot.ownerPhone || heldLog.ownerPhone,
        awaitingArrival: false,
      };
      await set(ref(db, `parkingLogs/${heldLog.logId}`), arrivedLog);
      return;
    }

    // Reserve the key synchronously so two rapid snapshots cannot double-open.
    activeSessionKeysRef.current.add(key);

    const entryTime = parseOccupancyToIso(slot.occupancyTime) || new Date().toISOString();

    let depositPaid = 0;
    const booking = bookingsRef.current.find(
      (b) => b.status === 'Confirmed' && b.vehicleNo.toUpperCase() === slot.vehicleNo!.toUpperCase()
    );
    if (booking) depositPaid = booking.deposit;

    const logId = `LOG-${Math.floor(10000 + Math.random() * 900000)}`;
    const newLog: ParkingLog = {
      logId,
      bookingId: booking?.bookingId || '',
      area,
      slotId: slot.id,
      vehicleNo: slot.vehicleNo.toUpperCase(),
      vehicleModel: slot.vehicleModel || 'Standard Vehicle',
      vehicleType: slot.vehicleType || 'Car',
      ownerName: slot.ownerName || 'Walk-in Driver',
      ownerPhone: slot.ownerPhone || 'N/A',
      entryTime,
      hourlyRate: settings.hourlyRate,
      depositPaid,
      status: 'PARKED',
      createdAt: new Date().toISOString(),
    };
    await set(ref(db, `parkingLogs/${logId}`), newLog);
  };

  // Stops the clock (clock STOP) the moment a slot becomes AVAILABLE.
  // Clock STOP = vehicle physically left the bay (slot → available).
  // A gate-held bay (reserved, car authorised but never arrived) carries no
  // running clock so cancelling it must NOT create a billed session.
  const closeSessionForSlot = async (area: string, slotId: string) => {
    const activeLog =
      logsRef.current.find(
        (l) => l.status === 'PARKED' && l.slotId === slotId && l.area === area
      ) ||
      parkingLogs.find(
        (l) => l.status === 'PARKED' && l.slotId === slotId && l.area === area
      );
    activeSessionKeysRef.current.delete(`${area}::${slotId}`);
    if (!activeLog) return;

    // Gate-hold cancelled before the car ever arrived → delete phantom log.
    if (activeLog.awaitingArrival) {
      try {
        await remove(ref(db, `parkingLogs/${activeLog.logId}`));
      } catch {
        /* best-effort hold cleanup */
      }
      return;
    }

    // Safety guard: if somehow entryTime still contains the old gate-authorised
    // string, don't bill a phantom session.
    if (activeLog.entryTime && activeLog.entryTime.includes('Gate authorised')) {
      try {
        await remove(ref(db, `parkingLogs/${activeLog.logId}`));
      } catch { /* best-effort */ }
      return;
    }

    // Clock STOP: vehicle just left (slot → available). Record exit time NOW.
    const exitTime = new Date().toISOString();
    const fare = calculateFareDetails(
      activeLog.entryTime,
      exitTime,
      activeLog.hourlyRate || settings.hourlyRate,
      activeLog.vehicleType || 'Car',
      activeLog.depositPaid || 0,
      activeLog.area
    );

    // Mark as OUT_COMPLETED but NOT yet billed — billing happens when the
    // driver scans QR at the exit gate.
    const completedLog: ParkingLog = {
      ...activeLog,
      exitTime,
      durationMinutes: fare.durationMinutes,
      baseFare: fare.baseFare,
      peakSurcharge: fare.peakSurcharge,
      totalFare: fare.totalFare,
      amountDue: fare.amountDue,
      status: 'OUT_COMPLETED',
      autoClosedBySensor: true,
      billed: false,
    };
    await set(ref(db, `parkingLogs/${activeLog.logId}`), completedLog);
  };

  // ── Occupancy watcher: slot status transitions drive the parking clock ────
  useEffect(() => {
    if (loading || !logsLoaded) return;
    // Wait until slot data has actually arrived so the first reconcile below
    // is guaranteed to see the already-occupied slots.
    if (Object.keys(slots).length === 0) return;

    const prev = prevSlotsRef.current;
    prevSlotsRef.current = slots;

    // First snapshot: reconcile slots that are already occupied on load.
    if (!prev) {
      Object.entries(slots).forEach(([area, list]) => {
        list.forEach((slot) => {
          if (slot.status === 'occupied') openSessionForSlot(area, slot);
        });
      });
      return;
    }

    Object.entries(slots).forEach(([area, list]) => {
      list.forEach((slot) => {
        const before = (prev[area] || []).find((s) => s.id === slot.id);
        if (!before) return;

        if (before.status !== 'occupied' && slot.status === 'occupied') {
          openSessionForSlot(area, slot); // car arrived → clock starts
        } else if (before.status === 'occupied' && slot.status === 'available') {
          closeSessionForSlot(area, slot.id); // car removed → clock stops
        } else if (before.status === 'reserved' && slot.status === 'available') {
          // A gate-held bay (reserved, car never arrived) was released: drop
          // the hold log instead of billing a phantom stay.
          closeSessionForSlot(area, slot.id);
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, loading, logsLoaded]);

  return (
    <ParkingContext.Provider
      value={{
        slots,
        bookings,
        parkingLogs,
        settings,
        activeArea,
        loading,
        setActiveArea,
        reserveSlot,
        cancelReservation,
        updateSlotStatus,
        updateSettings,
        isPeakHour,
        processVehicleEntry,
        processVehicleExit,
        calculateFareDetails,
      }}
    >
      {children}
    </ParkingContext.Provider>
  );
};

export const useParking = () => {
  const context = useContext(ParkingContext);
  if (!context) throw new Error('useParking must be used within a ParkingProvider');
  return context;
};

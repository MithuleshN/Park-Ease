import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  ref,
  onValue,
  set,
  update,
  get,
} from 'firebase/database';

export type SlotStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';

export interface Slot {
  id: string;
  status: SlotStatus;
  vehicleNo?: string;
  vehicleModel?: string;
  vehicleType?: string;
  ownerName?: string;
  ownerPhone?: string;
  occupancyTime?: string;
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
  settings: ParkingSettings;
  activeArea: string;
  loading: boolean;
  setActiveArea: (area: string) => void;
  reserveSlot: (booking: Omit<Reservation, 'bookingId' | 'reservationId' | 'createdAt' | 'status'>) => Promise<Reservation>;
  cancelReservation: (bookingId: string) => void;
  updateSlotStatus: (area: string, slotId: string, status: SlotStatus, extra?: Partial<Slot>) => void;
  updateSettings: (newSettings: Partial<ParkingSettings>) => void;
  isPeakHour: (timeStr: string) => boolean;
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
  isSimulating: true,
};

// Convert Firebase object (keyed by slotKey) → Slot[] array
const objectToSlotArray = (obj: Record<string, Slot>): Slot[] => {
  if (!obj) return [];
  return Object.values(obj);
};

// Area name → Firebase-safe key
const areaKey = (area: string) => area.replace(/ /g, '_');

export const ParkingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [slots, setSlots] = useState<Record<string, Slot[]>>({});
  const [bookings, setBookings] = useState<Reservation[]>([]);
  const [settings, setSettings] = useState<ParkingSettings>(defaultSettings);
  const [activeArea, setActiveArea] = useState<string>('Mall Parking');
  const [loading, setLoading] = useState(true);

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

      const eligible = locSlots.filter((s) => s.status === 'available' || s.status === 'occupied');
      if (eligible.length === 0) return;

      const randomSlot = eligible[Math.floor(Math.random() * eligible.length)];

      if (randomSlot.status === 'available') {
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
          occupancyTime: 'Just now',
        });
      } else {
        updateSlotStatus(randomLoc, randomSlot.id, 'available', {
          vehicleNo: '',
          vehicleModel: '',
          vehicleType: '',
          ownerName: '',
          ownerPhone: '',
          occupancyTime: '',
        });
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [settings.isSimulating, slots]);

  return (
    <ParkingContext.Provider
      value={{
        slots,
        bookings,
        settings,
        activeArea,
        loading,
        setActiveArea,
        reserveSlot,
        cancelReservation,
        updateSlotStatus,
        updateSettings,
        isPeakHour,
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

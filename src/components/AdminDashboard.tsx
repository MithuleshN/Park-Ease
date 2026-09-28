import React, { useState, useEffect } from 'react';
import { useParking, type Slot, type SlotStatus, type ParkingLog, type FareDetails } from '../context/ParkingContext';
import { 
  Building2, 
  Database, 
  Trash2, 
  Search, 
  Grid, 
  TrendingUp,
  Sliders,
  PlaySquare,
  LogIn,
  LogOut,
  QrCode,
  Clock,
  Calculator,
  CheckCircle2,
  Printer,
  CarFront
} from 'lucide-react';
import { OledPreview } from './OledPreview';
import QRCode from 'react-qr-code';
import { QrGateScanner } from './QrGateScanner';
import { playGateOpenSound } from '../utils/scannerAudio';

export const AdminDashboard: React.FC = () => {
  const { 
    slots, 
    bookings, 
    parkingLogs,
    settings, 
    activeArea, 
    setActiveArea, 
    updateSlotStatus, 
    updateSettings, 
    cancelReservation,
    processVehicleEntry,
    processVehicleExit,
    calculateFareDetails
  } = useParking();

  const [searchQuery, setSearchQuery] = useState('');
  const [logFilterTab, setLogFilterTab] = useState<'all' | 'parked' | 'completed'>('all');

  // Dashboard settings form states
  const [peakStart, setPeakStart] = useState(settings.peakHoursStart);
  const [peakEnd, setPeakEnd] = useState(settings.peakHoursEnd);
  const [deposit, setDeposit] = useState(settings.depositFee);
  const [hourly, setHourly] = useState(settings.hourlyRate);
  const [grace, setGrace] = useState(settings.gracePeriod);
  const [expiry, setExpiry] = useState(settings.reservationExpiry);
  const [simState, setSimState] = useState(settings.isSimulating);

  // Slot Edit Modal state
  const [selectedSlotDetails, setSelectedSlotDetails] = useState<{ area: string; slot: Slot } | null>(null);

  // ── GATE SCANNER TERMINAL STATES ──────────────────────────────────────────────
  const [scanQuery, setScanQuery] = useState('');
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [scanInModalOpen, setScanInModalOpen] = useState(false);
  const [scanOutModalOpen, setScanOutModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // Entry Form state
  const [entryVehicleNo, setEntryVehicleNo] = useState('');
  const [entryVehicleModel, setEntryVehicleModel] = useState('Honda City');
  const [entryVehicleType, setEntryVehicleType] = useState('Car');
  const [entryOwnerName, setEntryOwnerName] = useState('Walk-in Customer');
  const [entryOwnerPhone, setEntryOwnerPhone] = useState('9876543210');
  const [entryArea, setEntryArea] = useState(activeArea);
  const [entrySlotId, setEntrySlotId] = useState('');
  const [entryBookingId, setEntryBookingId] = useState('');
  const [entryTimeInput, setEntryTimeInput] = useState(
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  );

  // Exit & Fare Calculation state
  const [exitTarget, setExitTarget] = useState<{
    area: string;
    slotId: string;
    vehicleNo: string;
    vehicleModel?: string;
    vehicleType?: string;
    ownerName?: string;
    ownerPhone?: string;
    entryTime: string;
    depositPaid: number;
    logId?: string;
  } | null>(null);
  const [exitTimeInput, setExitTimeInput] = useState(
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  );
  const [liveFarePreview, setLiveFarePreview] = useState<FareDetails | null>(null);
  const [completedReceipt, setCompletedReceipt] = useState<ParkingLog | null>(null);

  // Synchronize settings form state if settings change
  useEffect(() => {
    setPeakStart(settings.peakHoursStart);
    setPeakEnd(settings.peakHoursEnd);
    setDeposit(settings.depositFee);
    setHourly(settings.hourlyRate);
    setGrace(settings.gracePeriod);
    setExpiry(settings.reservationExpiry);
    setSimState(settings.isSimulating);
  }, [settings]);

  // Recalculate live fare when exitTarget or exitTimeInput changes
  useEffect(() => {
    if (exitTarget) {
      const exitIso = new Date(exitTimeInput).toISOString();
      const fare = calculateFareDetails(
        exitTarget.entryTime,
        exitIso,
        settings.hourlyRate,
        exitTarget.vehicleType || 'Car',
        exitTarget.depositPaid || 0,
        exitTarget.area
      );
      setLiveFarePreview(fare);
    }
  }, [exitTarget, exitTimeInput, settings.hourlyRate]);

  // Helper stats computation
  const activeLocSlots = slots[activeArea] || [];
  const totalSlotsCount = activeLocSlots.length;
  const availableSlotsCount = activeLocSlots.filter((s) => s.status === 'available').length;
  const occupiedSlotsCount = activeLocSlots.filter((s) => s.status === 'occupied').length;
  const reservedSlotsCount = activeLocSlots.filter((s) => s.status === 'reserved').length;
  const maintenanceSlotsCount = activeLocSlots.filter((s) => s.status === 'maintenance').length;
  
  // Overall statistics
  const totalConfirmedBookings = bookings.filter((b) => b.status === 'Confirmed').length;
  const totalCompletedLogs = parkingLogs.filter((l) => l.status === 'OUT_COMPLETED').length;
  const totalCollectedFare = parkingLogs.reduce((acc, curr) => acc + (curr.totalFare || 0), 0);
  const mockRevenue = (totalConfirmedBookings * settings.depositFee) + totalCollectedFare;

  const handleSettingsSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      peakHoursStart: peakStart,
      peakHoursEnd: peakEnd,
      depositFee: Number(deposit),
      hourlyRate: Number(hourly),
      gracePeriod: Number(grace),
      reservationExpiry: Number(expiry),
      isSimulating: simState,
    });
    alert('Smart Parking Configuration settings updated successfully!');
  };

  const handleCancelClick = (bookingId: string) => {
    if (confirm(`Are you sure you want to cancel booking ${bookingId}?`)) {
      cancelReservation(bookingId);
    }
  };

  // Quick helper to start Check-In Modal for a specific slot
  const openScanInForSlot = (area: string, slot: Slot) => {
    setEntryArea(area);
    setEntrySlotId(slot.id);
    
    // If reserved slot, search corresponding reservation
    if (slot.status === 'reserved' || slot.vehicleNo) {
      const res = bookings.find((b) => b.slotId === slot.id && b.area === area && b.status === 'Confirmed');
      if (res) {
        setEntryVehicleNo(res.vehicleNo);
        setEntryVehicleModel(res.vehicleModel);
        setEntryVehicleType(res.vehicleType || 'Car');
        setEntryOwnerName(res.name);
        setEntryOwnerPhone(res.phone);
        setEntryBookingId(res.bookingId);
      } else {
        setEntryVehicleNo(slot.vehicleNo || '');
        setEntryVehicleModel(slot.vehicleModel || 'Car');
        setEntryVehicleType(slot.vehicleType || 'Car');
        setEntryOwnerName(slot.ownerName || 'Walk-in Driver');
        setEntryOwnerPhone(slot.ownerPhone || '9876543210');
        setEntryBookingId('');
      }
    } else {
      setEntryVehicleNo('');
      setEntryVehicleModel('Maruti Swift');
      setEntryVehicleType('Car');
      setEntryOwnerName('Walk-in Customer');
      setEntryOwnerPhone('9876543210');
      setEntryBookingId('');
    }

    setEntryTimeInput(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    setScanInModalOpen(true);
  };

  // Quick helper to start Check-Out Modal for an occupied slot
  const openScanOutForSlot = (area: string, slot: Slot) => {
    // Find matching active log if any
    const activeLog = parkingLogs.find((l) => l.status === 'PARKED' && l.slotId === slot.id && l.area === area);
    
    let entryIso = new Date(Date.now() - 45 * 60 * 1000).toISOString(); // fallback 45m ago
    if (activeLog?.entryTime) {
      entryIso = activeLog.entryTime;
    } else if (slot.occupancyTime && !slot.occupancyTime.includes('ago') && !slot.occupancyTime.includes('Reserved')) {
      entryIso = slot.occupancyTime;
    }

    let depositPaid = 0;
    if (slot.vehicleNo) {
      const b = bookings.find((bk) => bk.vehicleNo.toUpperCase() === slot.vehicleNo?.toUpperCase() && bk.status === 'Confirmed');
      if (b) depositPaid = b.deposit;
    }

    setExitTarget({
      area,
      slotId: slot.id,
      vehicleNo: slot.vehicleNo || 'UNKNOWN',
      vehicleModel: slot.vehicleModel || 'Car',
      vehicleType: slot.vehicleType || 'Car',
      ownerName: slot.ownerName || 'Driver',
      ownerPhone: slot.ownerPhone || 'N/A',
      entryTime: entryIso,
      depositPaid,
      logId: activeLog?.logId,
    });

    setExitTimeInput(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    setScanOutModalOpen(true);
  };

  // Perform Entry Submit (Gate IN)
  const handlePerformEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryVehicleNo.trim()) {
      alert('Please enter a vehicle registration number.');
      return;
    }

    const availableSlots = slots[entryArea]?.filter((s) => s.status === 'available' || s.id === entrySlotId) || [];
    const targetSlot = entrySlotId || (availableSlots[0]?.id || 'A1');

    const entryIso = new Date(entryTimeInput).toISOString();

    const createdLog = await processVehicleEntry({
      area: entryArea,
      slotId: targetSlot,
      vehicleNo: entryVehicleNo.toUpperCase(),
      vehicleModel: entryVehicleModel,
      vehicleType: entryVehicleType,
      ownerName: entryOwnerName,
      ownerPhone: entryOwnerPhone,
      bookingId: entryBookingId,
      entryTime: entryIso,
    });

    setScanInModalOpen(false);
    alert(`✅ VEHICLE CHECK-IN SUCCESSFUL!\n\nBarrier Gate OPENED for ${createdLog.vehicleNo} at slot ${createdLog.slotId} (${createdLog.area}).\nEntry Time: ${new Date(createdLog.entryTime).toLocaleTimeString()}`);
  };

  // Perform Exit Submit (Gate OUT & Calculate Fare)
  const handlePerformExitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exitTarget) return;

    const exitIso = new Date(exitTimeInput).toISOString();
    const result = await processVehicleExit(
      exitTarget.logId || exitTarget.slotId,
      exitTarget.area,
      exitIso
    );

    setCompletedReceipt(result.log);
    setScanOutModalOpen(false);
    setReceiptModalOpen(true);
  };

  // ── Handle QR Scanner result: parse payload → Gate IN or Gate OUT ──────────────
  const handleQrScan = (rawData: string) => {
    let parsed: Record<string, string | number | boolean> | null = null;

    // Try JSON parse first (structured ParkEase ticket QR)
    try {
      parsed = JSON.parse(rawData);
    } catch {
      parsed = null;
    }

    // ── CASE 1: Structured ParkEase QR payload ─────────────────────────────────
    if (parsed && parsed.parkEasePass) {
      const vehicleNo = String(parsed.vehicleNo || '').toUpperCase();
      const bookingId = String(parsed.bookingId || '');
      const slotId = String(parsed.slotId || '');
      const area = String(parsed.area || activeArea);

      // Check if the vehicle is already PARKED → Gate OUT
      let parkedSlot: Slot | null = null;
      let parkedArea = area;

      Object.entries(slots).forEach(([areaName, slotList]) => {
        const match = slotList.find(
          (s) => s.status === 'occupied' && s.vehicleNo?.toUpperCase() === vehicleNo
        );
        if (match) {
          parkedSlot = match;
          parkedArea = areaName;
        }
      });

      if (parkedSlot) {
        // Vehicle is inside → trigger Gate OUT
        playGateOpenSound();
        openScanOutForSlot(parkedArea, parkedSlot);
        return;
      }

      // Vehicle is NOT inside yet → trigger Gate IN
      // Pre-fill entry form from QR payload
      const availArea = slots[area] ? area : activeArea;
      const availSlots = slots[availArea]?.filter((s) => s.status === 'available' || s.id === slotId) || [];
      const targetSlotId = slotId || availSlots[0]?.id || 'A1';

      setEntryArea(availArea);
      setEntrySlotId(targetSlotId);
      setEntryVehicleNo(vehicleNo);
      setEntryVehicleModel(String(parsed.vehicleModel || 'Car'));
      setEntryVehicleType(String(parsed.vehicleType || 'Car'));
      setEntryOwnerName(String(parsed.name || 'Walk-in Driver'));
      setEntryOwnerPhone(String(parsed.phone || '9876543210'));
      setEntryBookingId(bookingId);
      setEntryTimeInput(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));

      playGateOpenSound();
      setScanInModalOpen(true);
      return;
    }

    // ── CASE 2: Plain text search — booking ID, reservation ID, or plate number ──
    handleScanSearch(rawData.trim());
  };

  // Handle Quick Search in Scanner Field
  const handleScanSearch = (val: string) => {
    setScanQuery(val);
    if (!val.trim()) return;

    const q = val.trim().toLowerCase();
    
    // Check if matches an active booking
    const matchedBk = bookings.find(
      (b) => b.status === 'Confirmed' && (
        b.bookingId.toLowerCase().includes(q) ||
        b.vehicleNo.toLowerCase().includes(q) ||
        b.reservationId.toLowerCase().includes(q)
      )
    );

    if (matchedBk) {
      openScanInForSlot(matchedBk.area, {
        id: matchedBk.slotId,
        status: 'reserved',
        vehicleNo: matchedBk.vehicleNo,
        vehicleModel: matchedBk.vehicleModel,
        vehicleType: matchedBk.vehicleType,
        ownerName: matchedBk.name,
        ownerPhone: matchedBk.phone,
        occupancyTime: `Reserved for ${matchedBk.time}`,
        sensorStatus: 'Inactive'
      });
      return;
    }

    // Check if matches an occupied slot
    let foundSlot: Slot | null = null;
    let foundArea = activeArea;

    Object.entries(slots).forEach(([areaName, slotList]) => {
      const match = slotList.find(
        (s) => s.status === 'occupied' && (
          s.id.toLowerCase() === q ||
          s.vehicleNo?.toLowerCase().includes(q) ||
          s.ownerName?.toLowerCase().includes(q)
        )
      );
      if (match) {
        foundSlot = match;
        foundArea = areaName;
      }
    });

    if (foundSlot) {
      openScanOutForSlot(foundArea, foundSlot);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    const q = searchQuery.toLowerCase();
    return (
      b.bookingId.toLowerCase().includes(q) ||
      b.vehicleNo.toLowerCase().includes(q) ||
      b.name.toLowerCase().includes(q) ||
      b.phone.includes(q) ||
      b.slotId.toLowerCase().includes(q)
    );
  });

  const filteredLogs = parkingLogs.filter((l) => {
    if (logFilterTab === 'parked' && l.status !== 'PARKED') return false;
    if (logFilterTab === 'completed' && l.status !== 'OUT_COMPLETED') return false;
    
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      l.logId.toLowerCase().includes(q) ||
      l.vehicleNo.toLowerCase().includes(q) ||
      (l.ownerName && l.ownerName.toLowerCase().includes(q)) ||
      l.slotId.toLowerCase().includes(q) ||
      l.area.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Administrator Operations</span>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white mt-1">IoT Command Center & Gate Control</h1>
        </div>
        
        {/* Dropdown to switch parking terminals */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5"><Building2 className="h-4.5 w-4.5" /> Monitor Area:</label>
          <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1 rounded-full border border-slate-200 dark:border-slate-800">
            {Object.keys(slots).map((areaName) => (
              <button
                key={areaName}
                onClick={() => setActiveArea(areaName)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                  activeArea === areaName 
                    ? 'bg-primary text-white shadow' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-250'
                }`}
              >
                {areaName.replace(' Parking', '')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── HIGH TECH IN & OUT SCANNER & GATE TERMINAL BAR ───────────────────────── */}
      <div className="glass p-6 rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/5 via-slate-50/50 to-emerald-500/5 dark:from-primary/10 dark:via-slate-900/40 dark:to-emerald-950/20 shadow-md">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <QrCode className="h-6 w-6 text-primary animate-pulse" />
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Smart Gate In / Out QR Scanner Terminal
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Scan the user's booking QR code at entry to start the parking clock, or at exit to automatically calculate and bill the fare.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">

            {/* ── PRIMARY: Open Real QR Scanner ──────────────────────────────── */}
            <button
              onClick={() => setQrScannerOpen(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-blue-500 hover:from-primary-hover hover:to-blue-600 text-white px-6 py-3 rounded-full text-sm font-black shadow-lg cursor-pointer transition-all hover:scale-105 glow-primary"
            >
              <QrCode className="h-5 w-5" />
              Open QR Scanner
            </button>

            {/* Divider */}
            <span className="text-xs text-slate-400 font-semibold hidden lg:block">or</span>

            {/* Manual Search fallback */}
            <div className="relative flex-grow lg:w-56">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Manual: Plate / Booking ID..."
                value={scanQuery}
                onChange={(e) => handleScanSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-xs rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:border-primary shadow-inner"
              />
            </div>

            {/* Gate IN Action Button */}
            <button
              onClick={() => {
                const availSlots = slots[activeArea]?.filter((s) => s.status === 'available') || [];
                setEntryArea(activeArea);
                setEntrySlotId(availSlots[0]?.id || 'A1');
                setEntryVehicleNo('');
                setEntryVehicleModel('Honda City');
                setEntryVehicleType('Car');
                setEntryOwnerName('Walk-in Customer');
                setEntryOwnerPhone('9876543210');
                setEntryBookingId('');
                setEntryTimeInput(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
                setScanInModalOpen(true);
              }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-full text-xs font-bold shadow cursor-pointer transition-transform hover:scale-102"
            >
              <LogIn className="h-4 w-4" /> Walk-in IN
            </button>

            {/* Gate OUT Action Button */}
            <button
              onClick={() => {
                const occSlots = slots[activeArea]?.filter((s) => s.status === 'occupied') || [];
                if (occSlots.length > 0) {
                  openScanOutForSlot(activeArea, occSlots[0]);
                } else {
                  alert('No occupied vehicles currently found in ' + activeArea);
                }
              }}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-full text-xs font-bold shadow cursor-pointer transition-transform hover:scale-102"
            >
              <LogOut className="h-4 w-4" /> Walk-in OUT
            </button>
          </div>
        </div>
      </div>

      {/* METRICS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Metric 1 */}
        <div className="glass p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-850 hover:shadow-md transition-shadow">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Terminal Status</span>
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-2xl font-black">{totalSlotsCount} Slots</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-550">Active Array</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">ESP32 Gate Arm status: <span className="text-emerald-500 font-bold uppercase">Open</span></p>
        </div>

        {/* Metric 2 */}
        <div className="glass p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-850 hover:shadow-md transition-shadow">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Real-time availability</span>
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-2xl font-black text-emerald-500">{availableSlotsCount} Free</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-450">
              {totalSlotsCount > 0 ? Math.round((availableSlotsCount / totalSlotsCount) * 100) : 0}% Available
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">{occupiedSlotsCount} Occ, {reservedSlotsCount} Res, {maintenanceSlotsCount} Maint</p>
        </div>

        {/* Metric 3 */}
        <div className="glass p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-850 hover:shadow-md transition-shadow">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Revenue & Billing</span>
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-2xl font-black text-primary dark:text-blue-400">₹{mockRevenue}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-105 text-primary dark:bg-blue-950/20 dark:text-blue-400">
              {totalCompletedLogs} Exits Billed
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Hourly base rate: ₹{settings.hourlyRate}/hr</p>
        </div>

        {/* Metric 4 */}
        <div className="glass p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-850 hover:shadow-md transition-shadow">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Live Telemetry Gate Logs</span>
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-2xl font-black">
              {parkingLogs.filter(l => l.status === 'PARKED').length} / {totalCompletedLogs}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-105 text-slate-500">In / Out Logs</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Average checkout duration: 45 min</p>
        </div>

      </div>

      {/* DUAL COLUMN MIDDLE SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* PARKING SLOT INTERACTIVE GRID WITH QUICK SCAN BUTTONS */}
        <div className="lg:col-span-2 glass p-6 rounded-3xl border border-slate-205 dark:border-slate-850 relative">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Grid className="h-5 w-5 text-primary" /> Array Map: {activeArea}
              </h2>
              <p className="text-xs text-slate-400">Click a slot block or use Quick Action buttons to check vehicles In or Out.</p>
            </div>
            
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sensors Streaming</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {activeLocSlots.map((slot) => {
              
              let styleBorder = 'border-slate-200 dark:border-slate-800';
              let badgeColor = 'bg-slate-450';
              let textColor = 'text-slate-400';

              if (slot.status === 'available') {
                badgeColor = 'bg-emerald-500';
                textColor = 'text-emerald-500';
                styleBorder = 'border-emerald-100 hover:border-emerald-350 dark:border-emerald-950/20';
              } else if (slot.status === 'occupied') {
                badgeColor = 'bg-rose-500';
                textColor = 'text-rose-500';
                styleBorder = 'border-rose-100 hover:border-rose-350 dark:border-rose-950/20';
              } else if (slot.status === 'reserved') {
                badgeColor = 'bg-amber-400';
                textColor = 'text-amber-500';
                styleBorder = 'border-amber-100 hover:border-amber-350 dark:border-amber-955/20';
              } else if (slot.status === 'maintenance') {
                badgeColor = 'bg-slate-400';
                textColor = 'text-slate-450';
                styleBorder = 'border-dashed border-slate-200 dark:border-slate-800 hover:border-slate-350';
              }

              return (
                <div
                  key={slot.id}
                  className={`p-4 border rounded-2xl text-left transition-all duration-200 hover:shadow bg-white dark:bg-slate-900 ${styleBorder} flex flex-col justify-between`}
                >
                  <div onClick={() => setSelectedSlotDetails({ area: activeArea, slot })} className="cursor-pointer space-y-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-extrabold text-sm">{slot.id}</span>
                      <div className={`h-2.5 w-2.5 rounded-full ${badgeColor}`} />
                    </div>
                    
                    <div className="space-y-0.5 text-[10px]">
                      <p className={`font-bold capitalize ${textColor}`}>{slot.status}</p>
                      <p className="text-slate-400 font-semibold">{slot.vehicleNo || 'Empty spot'}</p>
                      <p className="text-slate-400 truncate">{slot.occupancyTime || 'No duration logs'}</p>
                    </div>
                  </div>
                  
                  {/* QUICK ACTION BUTTON ON SLOT CARD */}
                  <div className="border-t border-slate-100 dark:border-slate-800 mt-3 pt-2">
                    {slot.status === 'available' && (
                      <button
                        onClick={() => openScanInForSlot(activeArea, slot)}
                        className="w-full py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/50 dark:text-emerald-400 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <LogIn className="h-3 w-3" /> + Check-In (IN)
                      </button>
                    )}
                    {slot.status === 'occupied' && (
                      <button
                        onClick={() => openScanOutForSlot(activeArea, slot)}
                        className="w-full py-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 dark:text-rose-400 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Calculator className="h-3 w-3" /> Bill & Exit (OUT)
                      </button>
                    )}
                    {slot.status === 'reserved' && (
                      <button
                        onClick={() => openScanInForSlot(activeArea, slot)}
                        className="w-full py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:hover:bg-amber-900/50 dark:text-amber-400 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <LogIn className="h-3 w-3" /> Check-In Reserved
                      </button>
                    )}
                    {slot.status === 'maintenance' && (
                      <span className="block text-[9px] text-center text-slate-400 font-bold uppercase">Disabled</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* OLED WIDGET PREVIEW PANEL */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <OledPreview activeArea={activeArea} />

          {/* Quick Simulation Controller panel */}
          <div className="glass p-5 rounded-3xl border border-slate-250 dark:border-slate-850 text-left">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-1.5">
              <PlaySquare className="h-4.5 w-4.5 text-primary" /> Simulated Live IoT Sensors
            </h3>
            <p className="text-xs text-slate-450 mb-4 font-medium leading-relaxed">
              When toggled, system auto-simulates vehicle entrances and exits every 15 seconds to demonstrate dynamic dashboards.
            </p>
            <div className="flex justify-between items-center bg-slate-100/50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Simulation interval:</span>
              <button
                onClick={() => {
                  const state = !simState;
                  setSimState(state);
                  updateSettings({ isSimulating: state });
                }}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase transition-all ${
                  simState 
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                    : 'bg-rose-500 hover:bg-rose-600 text-white'
                }`}
              >
                {simState ? 'ON (15s)' : 'OFF'}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ── PARKING AUDIT LOGS & TELEMETRY TABLE ─────────────────────────────────── */}
      <div className="glass p-6 rounded-3xl border border-slate-200 dark:border-slate-850">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Clock className="h-5 w-5 text-primary" /> Vehicle Check-In / Check-Out Telemetry Logs
            </h2>
            <p className="text-xs text-slate-400">Detailed record of vehicle entry timestamps, exit timestamps, parking duration, and calculated fares.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Filter tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-full border border-slate-200 dark:border-slate-800 text-xs font-bold">
              <button
                onClick={() => setLogFilterTab('all')}
                className={`px-3 py-1.5 rounded-full transition ${logFilterTab === 'all' ? 'bg-primary text-white' : 'text-slate-500'}`}
              >
                All Logs ({parkingLogs.length})
              </button>
              <button
                onClick={() => setLogFilterTab('parked')}
                className={`px-3 py-1.5 rounded-full transition ${logFilterTab === 'parked' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}
              >
                Parked ({parkingLogs.filter(l => l.status === 'PARKED').length})
              </button>
              <button
                onClick={() => setLogFilterTab('completed')}
                className={`px-3 py-1.5 rounded-full transition ${logFilterTab === 'completed' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
              >
                Completed ({parkingLogs.filter(l => l.status === 'OUT_COMPLETED').length})
              </button>
            </div>

            {/* Search bar */}
            <div className="relative w-full md:w-56">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search Log, Plate..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* The Telemetry Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900/60 text-slate-400 uppercase font-black tracking-wider border-b border-slate-200 dark:border-slate-850">
                <th className="p-4">Log ID</th>
                <th className="p-4">Vehicle Plate</th>
                <th className="p-4">Terminal / Slot</th>
                <th className="p-4">Entry Timestamp</th>
                <th className="p-4">Exit Timestamp</th>
                <th className="p-4">Duration</th>
                <th className="p-4">Total Fare</th>
                <th className="p-4">Net Paid</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Gate Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  const entryDateFormatted = new Date(log.entryTime).toLocaleString([], {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  });
                  const exitDateFormatted = log.exitTime ? new Date(log.exitTime).toLocaleString([], {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  }) : '--';

                  const durationText = log.durationMinutes 
                    ? `${Math.floor(log.durationMinutes / 60)}h ${log.durationMinutes % 60}m`
                    : 'In Progress';

                  return (
                    <tr key={log.logId} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                      <td className="p-4 font-extrabold">{log.logId}</td>
                      <td className="p-4 font-extrabold text-primary dark:text-blue-400">
                        {log.vehicleNo}
                        <span className="block text-[10px] text-slate-400 font-semibold">{log.vehicleModel} ({log.vehicleType})</span>
                      </td>
                      <td className="p-4 font-semibold">
                        <span>{log.area.replace(' Parking', '')}</span>
                        <span className="block text-[10px] text-emerald-500 font-bold">{log.slotId}</span>
                      </td>
                      <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">{entryDateFormatted}</td>
                      <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">{exitDateFormatted}</td>
                      <td className="p-4 font-extrabold text-amber-600 dark:text-amber-400">{durationText}</td>
                      <td className="p-4 font-extrabold">₹{log.totalFare ?? '--'}</td>
                      <td className="p-4 font-black text-emerald-600 dark:text-emerald-400">
                        {log.amountDue !== undefined ? `₹${log.amountDue}` : '--'}
                      </td>
                      <td className="p-4 font-bold">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase ${
                          log.status === 'PARKED' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-450' 
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400'
                        }`}>
                          {log.status === 'PARKED' ? 'Parked (IN)' : 'Completed (OUT)'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {log.status === 'PARKED' ? (
                          <button
                            onClick={() => openScanOutForSlot(log.area, { id: log.slotId, status: 'occupied', vehicleNo: log.vehicleNo, vehicleModel: log.vehicleModel, vehicleType: log.vehicleType, ownerName: log.ownerName, ownerPhone: log.ownerPhone, occupancyTime: log.entryTime, sensorStatus: 'Active' })}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[10px] cursor-pointer"
                          >
                            Check-Out & Bill
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setCompletedReceipt(log);
                              setReceiptModalOpen(true);
                            }}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold text-[10px] cursor-pointer"
                          >
                            View Receipt
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-bold">No telemetry logs found matching filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RESERVATION MANAGEMENT TABLE */}
      <div className="glass p-6 rounded-3xl border border-slate-200 dark:border-slate-850">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Database className="h-5 w-5 text-primary" /> Pre-Booked Reservations Database
            </h2>
            <p className="text-xs text-slate-400">Search and manage user bookings, scan statuses, and perform cancellations.</p>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search ID, Plate No..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* The Reservations table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900/60 text-slate-400 uppercase font-black tracking-wider border-b border-slate-200 dark:border-slate-850">
                <th className="p-4">Booking ID</th>
                <th className="p-4">Driver Details</th>
                <th className="p-4">Plate Code</th>
                <th className="p-4">Terminal / Slot</th>
                <th className="p-4">Schedule</th>
                <th className="p-4">Deposit</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.length > 0 ? (
                filteredBookings.map((b) => (
                  <tr key={b.bookingId} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                    <td className="p-4 font-extrabold">{b.bookingId}</td>
                    <td className="p-4">
                      <p className="font-bold text-slate-800 dark:text-slate-200">{b.name}</p>
                      <p className="text-[10px] text-slate-400">{b.phone}</p>
                    </td>
                    <td className="p-4 font-bold text-primary dark:text-blue-400">{b.vehicleNo}</td>
                    <td className="p-4 font-semibold">
                      <span>{b.area.replace(' Parking', '')}</span>
                      <span className="block text-[10px] text-emerald-500 font-bold">{b.slotId}</span>
                    </td>
                    <td className="p-4">
                      <p className="font-semibold">{b.date}</p>
                      <p className="text-[10px] text-slate-400 font-semibold">{b.time}</p>
                    </td>
                    <td className="p-4 font-extrabold">₹{b.deposit}</td>
                    <td className="p-4 font-bold">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase ${
                        b.status === 'Confirmed' 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-450' 
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/30'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="p-4 text-right flex items-center justify-end gap-2">
                      {b.status === 'Confirmed' && (
                        <>
                          <button
                            onClick={() => openScanInForSlot(b.area, { id: b.slotId, status: 'reserved', vehicleNo: b.vehicleNo, vehicleModel: b.vehicleModel, vehicleType: b.vehicleType, ownerName: b.name, ownerPhone: b.phone, occupancyTime: `Reserved for ${b.time}`, sensorStatus: 'Inactive' })}
                            className="px-2.5 py-1 bg-emerald-600 text-white rounded-md font-bold text-[10px] cursor-pointer"
                            title="Check-In Reserved Vehicle"
                          >
                            Scan IN
                          </button>
                          <button
                            onClick={() => handleCancelClick(b.bookingId)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl cursor-pointer"
                            title="Cancel Reservation"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">No active reservations matching searches.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ANALYTICAL REPORTS / CHARTS */}
      <div className="glass p-6 rounded-3xl border border-slate-200 dark:border-slate-850 text-left space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <TrendingUp className="h-5 w-5 text-primary" /> Analytical Parking Metrics
          </h2>
          <p className="text-xs text-slate-450">Telemetry summaries derived from sensor activations and gate checkouts.</p>
        </div>

        {/* Render SVGs Custom Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Chart 1: Daily Occupancy (Line chart) */}
          <div className="p-5 border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10 rounded-2xl space-y-4">
            <h4 className="font-bold text-xs uppercase text-slate-450">Daily Occupancy Hourly</h4>
            <div className="h-44 w-full flex items-end">
              <svg className="w-full h-full" viewBox="0 0 300 120">
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0F4C81" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#0F4C81" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <line x1="20" y1="20" x2="280" y2="20" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="3" className="dark:stroke-slate-800" />
                <line x1="20" y1="60" x2="280" y2="60" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="3" className="dark:stroke-slate-800" />
                <line x1="20" y1="100" x2="280" y2="100" stroke="#cbd5e1" strokeWidth="0.5" className="dark:stroke-slate-800" />
                
                <path
                  d="M 20 90 Q 60 40 100 70 T 180 30 T 240 85 T 280 40 L 280 100 L 20 100 Z"
                  fill="url(#chartGrad)"
                />
                <path
                  d="M 20 90 Q 60 40 100 70 T 180 30 T 240 85 T 280 40"
                  fill="none"
                  stroke="#0F4C81"
                  strokeWidth="2.5"
                />
                
                <text x="20" y="112" fontSize="7" fill="#94a3b8" fontWeight="bold">9 AM</text>
                <text x="80" y="112" fontSize="7" fill="#94a3b8" fontWeight="bold">12 PM</text>
                <text x="140" y="112" fontSize="7" fill="#94a3b8" fontWeight="bold">3 PM</text>
                <text x="200" y="112" fontSize="7" fill="#94a3b8" fontWeight="bold">6 PM</text>
                <text x="260" y="112" fontSize="7" fill="#94a3b8" fontWeight="bold">9 PM</text>
              </svg>
            </div>
            <p className="text-[10px] text-slate-450 italic">Spikes occur typically during lunch rush hours.</p>
          </div>

          {/* Chart 2: Weekly Checkout Counts */}
          <div className="p-5 border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10 rounded-2xl space-y-4">
            <h4 className="font-bold text-xs uppercase text-slate-450">Weekly average checkout counts</h4>
            <div className="h-44 w-full">
              <svg className="w-full h-full" viewBox="0 0 300 120">
                <line x1="20" y1="20" x2="280" y2="20" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="3" className="dark:stroke-slate-800" />
                <line x1="20" y1="100" x2="280" y2="100" stroke="#cbd5e1" strokeWidth="0.5" className="dark:stroke-slate-800" />
                
                {[
                  { x: 30, h: 60, day: 'Mon' },
                  { x: 70, h: 80, day: 'Tue' },
                  { x: 110, h: 50, day: 'Wed' },
                  { x: 150, h: 90, day: 'Thu' },
                  { x: 190, h: 100, day: 'Fri' },
                  { x: 230, h: 70, day: 'Sat' },
                  { x: 270, h: 40, day: 'Sun' },
                ].map((bar, idx) => (
                  <g key={idx}>
                    <rect
                      x={bar.x}
                      y={100 - bar.h}
                      width="18"
                      height={bar.h}
                      rx="4"
                      fill="#2ECC71"
                      fillOpacity="0.85"
                    />
                    <text x={bar.x + 2} y="112" fontSize="7" fill="#94a3b8" fontWeight="bold">{bar.day}</text>
                  </g>
                ))}
              </svg>
            </div>
            <p className="text-[10px] text-slate-450 italic">Peak reservations observed towards weekends.</p>
          </div>

          {/* Chart 3: Utilization */}
          <div className="p-5 border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10 rounded-2xl space-y-4">
            <h4 className="font-bold text-xs uppercase text-slate-450">Active Slots Utilization</h4>
            <div className="h-44 w-full flex items-center justify-center gap-6">
              <svg width="100" height="100" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e2e8f0" strokeWidth="3" className="dark:stroke-slate-800" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="none"
                  stroke="#0F4C81"
                  strokeWidth="3.2"
                  strokeDasharray="65 35"
                  strokeDashoffset="25"
                />
              </svg>
              <div className="space-y-1.5 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="font-bold">Reserved / Occupied: 65%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-slate-350" />
                  <span className="font-bold">Available: 35%</span>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-450 italic">Indicates high system utilization ratios.</p>
          </div>

        </div>
      </div>

      {/* SETTINGS PANEL */}
      <div className="glass p-6 rounded-3xl border border-slate-200 dark:border-slate-850 text-left">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-1.5">
          <Sliders className="h-5 w-5 text-primary" /> Core System & Pricing Settings
        </h2>
        <p className="text-xs text-slate-400 mb-6">Modify system-wide peak hour durations, reservation security deposits, and hourly base rate for fare calculations.</p>

        <form onSubmit={handleSettingsSave} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-slate-400">Peak Hours Start</label>
            <input
              type="time"
              value={peakStart}
              onChange={(e) => setPeakStart(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-slate-400">Peak Hours End</label>
            <input
              type="time"
              value={peakEnd}
              onChange={(e) => setPeakEnd(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-slate-400">Reservation Deposit (₹)</label>
            <input
              type="number"
              value={deposit}
              onChange={(e) => setDeposit(Number(e.target.value))}
              className="w-full p-3.5 rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-350 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-slate-400">Base Hourly Rate (₹/Hr)</label>
            <input
              type="number"
              value={hourly}
              onChange={(e) => setHourly(Number(e.target.value))}
              className="w-full p-3.5 rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-350 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-slate-400">Grace Period (Minutes)</label>
            <input
              type="number"
              value={grace}
              onChange={(e) => setGrace(Number(e.target.value))}
              className="w-full p-3.5 rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-350 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-slate-450">Reservation Expiry (Minutes)</label>
            <input
              type="number"
              value={expiry}
              onChange={(e) => setExpiry(Number(e.target.value))}
              className="w-full p-3.5 rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-750 dark:text-slate-350 focus:outline-none"
            />
          </div>

          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              className="bg-primary hover:bg-primary-hover text-white px-8 py-3.5 rounded-full font-bold shadow-md cursor-pointer glow-primary transition-transform hover:scale-102"
            >
              Save Configuration Options
            </button>
          </div>
        </form>
      </div>

      {/* ── QR GATE SCANNER MODAL (Camera / File / Demo / Manual) ─────────────────── */}
      <QrGateScanner
        isOpen={qrScannerOpen}
        onClose={() => setQrScannerOpen(false)}
        onScan={handleQrScan}
        activeArea={activeArea}
        pendingCheckIns={bookings
          .filter((b) => b.status === 'Confirmed')
          .map((b) => ({
            bookingId: b.bookingId,
            vehicleNo: b.vehicleNo,
            vehicleModel: b.vehicleModel,
            vehicleType: b.vehicleType,
            slotId: b.slotId,
            area: b.area,
            name: b.name,
            phone: b.phone,
            date: b.date,
            time: b.time,
            deposit: b.deposit,
          }))}
        activeParkedVehicles={Object.entries(slots).flatMap(([areaName, slotList]) =>
          slotList
            .filter((s) => s.status === 'occupied')
            .map((s) => {
              const activeLog = parkingLogs.find(
                (l) => l.status === 'PARKED' && l.slotId === s.id && l.area === areaName
              );
              return {
                slotId: s.id,
                vehicleNo: s.vehicleNo || '',
                vehicleModel: s.vehicleModel,
                vehicleType: s.vehicleType,
                area: areaName,
                ownerName: s.ownerName,
                ownerPhone: s.ownerPhone,
                entryTime: activeLog?.entryTime || s.occupancyTime || new Date(Date.now() - 45 * 60000).toISOString(),
                logId: activeLog?.logId,
                depositPaid: activeLog?.depositPaid,
              };
            })
        )}
      />

      {/* ── MODAL 1: CHECK-IN VEHICLE (GATE IN) ─────────────────────────────────── */}
      {scanInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-lg glass-solid rounded-3xl p-6 border border-slate-200 dark:border-slate-800 text-left space-y-6 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <LogIn className="h-5 w-5 text-emerald-500" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Vehicle Gate Entry (Check-In)
                </h3>
              </div>
              <button 
                onClick={() => setScanInModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handlePerformEntrySubmit} className="space-y-4 text-xs">
              
              {/* Area & Slot selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Terminal Area</label>
                  <select
                    value={entryArea}
                    onChange={(e) => {
                      setEntryArea(e.target.value);
                      const avail = slots[e.target.value]?.filter(s => s.status === 'available') || [];
                      setEntrySlotId(avail[0]?.id || 'A1');
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold"
                  >
                    {Object.keys(slots).map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Target Slot</label>
                  <select
                    value={entrySlotId}
                    onChange={(e) => setEntrySlotId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-emerald-600"
                  >
                    {(slots[entryArea] || []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.id} ({s.status.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Vehicle Registration & Model */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1 flex items-center gap-1">
                    <CarFront className="h-3.5 w-3.5 text-primary" /> Vehicle Plate No
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="KA-03-MM-1234"
                    value={entryVehicleNo}
                    onChange={(e) => setEntryVehicleNo(e.target.value.toUpperCase())}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Vehicle Model</label>
                  <input
                    type="text"
                    placeholder="Honda City"
                    value={entryVehicleModel}
                    onChange={(e) => setEntryVehicleModel(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold"
                  />
                </div>
              </div>

              {/* Vehicle Type & Owner Details */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Vehicle Type</label>
                  <select
                    value={entryVehicleType}
                    onChange={(e) => setEntryVehicleType(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold"
                  >
                    <option value="Car">Car (1.0x)</option>
                    <option value="SUV">SUV (1.25x)</option>
                    <option value="EV">EV (1.0x)</option>
                    <option value="Bike">Bike (0.5x)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Driver Name</label>
                  <input
                    type="text"
                    value={entryOwnerName}
                    onChange={(e) => setEntryOwnerName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Driver Contact</label>
                  <input
                    type="tel"
                    value={entryOwnerPhone}
                    onChange={(e) => setEntryOwnerPhone(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold"
                  />
                </div>
              </div>

              {/* Entry Timestamp input */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-primary" /> Entry Timestamp (Automated / Manual Override)
                </label>
                <div className="flex gap-2">
                  <input
                    type="datetime-local"
                    value={entryTimeInput}
                    onChange={(e) => setEntryTimeInput(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setEntryTimeInput(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16))}
                    className="px-3 py-2 bg-slate-200 dark:bg-slate-800 rounded-xl text-[10px] font-bold shrink-0 cursor-pointer"
                  >
                    Now
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setScanInModalOpen(false)}
                  className="px-5 py-2.5 border rounded-full text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-bold cursor-pointer glow-emerald shadow"
                >
                  Check-In & Open Gate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: CHECK-OUT & AUTOMATED FARE CALCULATOR (GATE OUT) ─────────────── */}
      {scanOutModalOpen && exitTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-lg glass-solid rounded-3xl p-6 border border-slate-200 dark:border-slate-800 text-left space-y-6 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-rose-500" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Vehicle Gate Exit & Automated Fare Calculator
                </h3>
              </div>
              <button 
                onClick={() => setScanOutModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handlePerformExitSubmit} className="space-y-4 text-xs">
              
              {/* Target info card */}
              <div className="p-4 bg-slate-100/60 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-black text-sm text-primary dark:text-blue-400">{exitTarget.vehicleNo}</span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 uppercase">
                    Slot {exitTarget.slotId} ({exitTarget.area.replace(' Parking', '')})
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                  <p><strong>Driver:</strong> {exitTarget.ownerName}</p>
                  <p><strong>Model:</strong> {exitTarget.vehicleModel} ({exitTarget.vehicleType})</p>
                </div>
              </div>

              {/* Exit Timestamp input */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-primary" /> Exit Timestamp (Automated / Manual Override)
                </label>
                <div className="flex gap-2">
                  <input
                    type="datetime-local"
                    value={exitTimeInput}
                    onChange={(e) => setExitTimeInput(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setExitTimeInput(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16))}
                    className="px-3 py-2 bg-slate-200 dark:bg-slate-800 rounded-xl text-[10px] font-bold shrink-0 cursor-pointer"
                  >
                    Now
                  </button>
                </div>
              </div>

              {/* ── ITEMIZED FARE BREAKDOWN CARD ──────────────────────────────────── */}
              {liveFarePreview && (
                <div className="p-4 bg-emerald-500/5 dark:bg-emerald-950/20 rounded-2xl border border-emerald-500/30 space-y-3">
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                    <span>Automated Fare Breakdown</span>
                    <span className="text-[10px] font-bold bg-emerald-200/50 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full">
                      Duration: {liveFarePreview.durationFormatted}
                    </span>
                  </h4>

                  <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span>Base Rate ({liveFarePreview.chargedHours} hrs @ ₹{liveFarePreview.hourlyRate}/hr × {liveFarePreview.vehicleMultiplier}x):</span>
                      <span className="font-bold">₹{liveFarePreview.baseFare}</span>
                    </div>

                    <div className="flex justify-between">
                      <span>Peak Hours Surcharge ({liveFarePreview.isPeak ? '20% Active' : 'Off-Peak 0%'}):</span>
                      <span className={`font-bold ${liveFarePreview.isPeak ? 'text-amber-500' : 'text-slate-400'}`}>
                        +₹{liveFarePreview.peakSurcharge}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Pre-Paid Reservation Deposit:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        -₹{liveFarePreview.depositPaid}
                      </span>
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex justify-between items-center font-black text-sm">
                      <span className="text-slate-900 dark:text-white">Net Balance Payable:</span>
                      <span className="text-xl text-primary dark:text-blue-400">₹{liveFarePreview.amountDue}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setScanOutModalOpen(false)}
                  className="px-5 py-2.5 border rounded-full text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-xs font-bold cursor-pointer glow-rose shadow"
                >
                  Complete Checkout & Print Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: DIGITAL BILLING RECEIPT ───────────────────────────────────── */}
      {receiptModalOpen && completedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md glass-solid rounded-3xl p-6 border border-slate-200 dark:border-slate-800 text-left space-y-6 shadow-2xl relative">
            
            <div className="text-center space-y-1">
              <div className="mx-auto h-10 w-10 flex items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Official Parking Billing Receipt
              </h3>
              <p className="text-[11px] text-slate-400">Payment Processed & Exit Barrier Gate Opened.</p>
            </div>

            {/* Printable Receipt Card */}
            <div id="printable-receipt" className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-sm text-xs">
              <div className="flex justify-between items-center pb-3 border-b border-dashed border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Receipt Code</span>
                  <p className="font-black text-slate-800 dark:text-slate-200">{completedReceipt.logId}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Location</span>
                  <p className="font-extrabold text-primary">{completedReceipt.area}</p>
                </div>
              </div>

              {/* QR Payload */}
              <div className="flex justify-center p-2 bg-white rounded-xl w-fit mx-auto border">
                <QRCode
                  value={JSON.stringify({
                    receiptId: completedReceipt.logId,
                    vehicleNo: completedReceipt.vehicleNo,
                    totalFare: completedReceipt.totalFare,
                    amountDue: completedReceipt.amountDue,
                    status: 'PAID'
                  })}
                  size={100}
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800 text-[11px]">
                <div className="flex justify-between"><span>Vehicle Reg:</span> <span className="font-bold">{completedReceipt.vehicleNo}</span></div>
                <div className="flex justify-between"><span>Slot ID:</span> <span className="font-bold text-emerald-500">{completedReceipt.slotId}</span></div>
                <div className="flex justify-between"><span>Entry Time:</span> <span className="font-semibold">{new Date(completedReceipt.entryTime).toLocaleTimeString()}</span></div>
                <div className="flex justify-between"><span>Exit Time:</span> <span className="font-semibold">{completedReceipt.exitTime ? new Date(completedReceipt.exitTime).toLocaleTimeString() : '--'}</span></div>
                <div className="flex justify-between"><span>Total Duration:</span> <span className="font-bold text-amber-500">{completedReceipt.durationMinutes ? `${Math.floor(completedReceipt.durationMinutes / 60)}h ${completedReceipt.durationMinutes % 60}m` : '--'}</span></div>
                <div className="flex justify-between"><span>Base Rate:</span> <span>₹{completedReceipt.baseFare || 0}</span></div>
                <div className="flex justify-between"><span>Peak Surcharge:</span> <span>₹{completedReceipt.peakSurcharge || 0}</span></div>
                <div className="flex justify-between"><span>Pre-paid Deposit:</span> <span>-₹{completedReceipt.depositPaid || 0}</span></div>
                <div className="border-t pt-2 flex justify-between font-black text-sm">
                  <span>Net Amount Paid:</span>
                  <span className="text-emerald-600 dark:text-emerald-400">₹{completedReceipt.amountDue || 0}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full font-bold text-xs cursor-pointer"
              >
                <Printer className="h-4 w-4" /> Print Receipt
              </button>
              <button
                onClick={() => setReceiptModalOpen(false)}
                className="px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-full font-bold text-xs cursor-pointer glow-primary"
              >
                Done / Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SLOT DETAIL EDIT POPUP MODAL */}
      {selectedSlotDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-sm glass-solid rounded-3xl p-6 border border-slate-200 dark:border-slate-800 text-left space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                Slot Override: {selectedSlotDetails.slot.id}
              </h3>
              <button 
                onClick={() => setSelectedSlotDetails(null)} 
                className="text-slate-400 hover:text-slate-650 cursor-pointer font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-slate-400 font-semibold block mb-1">Update Status:</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: 'available', bg: 'bg-emerald-500' },
                    { val: 'occupied', bg: 'bg-rose-500' },
                    { val: 'reserved', bg: 'bg-amber-400' },
                    { val: 'maintenance', bg: 'bg-slate-400' }
                  ].map((st) => (
                    <button
                      key={st.val}
                      onClick={() => {
                        updateSlotStatus(
                          selectedSlotDetails.area,
                          selectedSlotDetails.slot.id,
                          st.val as SlotStatus,
                          st.val === 'available' ? {
                            vehicleNo: undefined,
                            vehicleModel: undefined,
                            vehicleType: undefined,
                            ownerName: undefined,
                            ownerPhone: undefined,
                            occupancyTime: undefined
                          } : st.val === 'occupied' ? {
                            vehicleNo: 'KL-01-AA-9999',
                            vehicleModel: 'Direct drive-in vehicle',
                            vehicleType: 'Car',
                            ownerName: 'Walk-in customer',
                            occupancyTime: new Date().toISOString()
                          } : {}
                        );
                        setSelectedSlotDetails(null);
                      }}
                      className={`p-2 rounded-xl text-left border border-slate-200 dark:border-slate-800 font-bold transition hover:scale-102 flex items-center gap-1.5 cursor-pointer capitalize ${
                        selectedSlotDetails.slot.status === st.val ? 'bg-primary/10 border-primary text-primary' : 'bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className={`h-2.5 w-2.5 rounded-full ${st.bg}`} />
                      <span>{st.val}</span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedSlotDetails.slot.vehicleNo && (
                <div className="p-3 bg-slate-100/50 dark:bg-slate-900/60 rounded-xl space-y-1.5 border border-slate-200/50 dark:border-slate-800/50">
                  <p className="font-extrabold text-slate-800 dark:text-slate-200 uppercase">Assigned Log info</p>
                  <p><strong>Plate number:</strong> {selectedSlotDetails.slot.vehicleNo}</p>
                  <p><strong>Driver:</strong> {selectedSlotDetails.slot.ownerName}</p>
                  <p><strong>Contact:</strong> {selectedSlotDetails.slot.ownerPhone}</p>
                  <p><strong>Time:</strong> {selectedSlotDetails.slot.occupancyTime}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedSlotDetails(null)}
                className="px-4 py-2 border rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

import React, { useState } from 'react';
import { useParking, type Slot, type SlotStatus } from '../context/ParkingContext';
import { 
  Building2, 
  Database, 
  Trash2, 
  Search, 
  Grid, 
  TrendingUp,
  Sliders,
  PlaySquare
} from 'lucide-react';
import { OledPreview } from './OledPreview';

export const AdminDashboard: React.FC = () => {
  const { 
    slots, 
    bookings, 
    settings, 
    activeArea, 
    setActiveArea, 
    updateSlotStatus, 
    updateSettings, 
    cancelReservation 
  } = useParking();

  const [searchQuery, setSearchQuery] = useState('');
  
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

  // Helper stats computation
  const activeLocSlots = slots[activeArea] || [];
  const totalSlotsCount = activeLocSlots.length;
  const availableSlotsCount = activeLocSlots.filter((s) => s.status === 'available').length;
  const occupiedSlotsCount = activeLocSlots.filter((s) => s.status === 'occupied').length;
  const reservedSlotsCount = activeLocSlots.filter((s) => s.status === 'reserved').length;
  const maintenanceSlotsCount = activeLocSlots.filter((s) => s.status === 'maintenance').length;
  
  // Overall statistics
  const totalConfirmedBookings = bookings.filter((b) => b.status === 'Confirmed').length;
  const mockRevenue = totalConfirmedBookings * settings.depositFee;

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Administrator Operations</span>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white mt-1">IoT Command Center</h1>
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
              {Math.round((availableSlotsCount / totalSlotsCount) * 100)}% Available
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">{occupiedSlotsCount} Occ, {reservedSlotsCount} Res, {maintenanceSlotsCount} Maint</p>
        </div>

        {/* Metric 3 */}
        <div className="glass p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-850 hover:shadow-md transition-shadow">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Today's Revenue</span>
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-2xl font-black text-primary dark:text-blue-400">₹{mockRevenue}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-105 text-primary dark:bg-blue-950/20 dark:text-blue-400">
              {totalConfirmedBookings} Booked
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Reservation rate: ₹{settings.depositFee} per slip</p>
        </div>

        {/* Metric 4 */}
        <div className="glass p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-850 hover:shadow-md transition-shadow">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Today's Gate Entries</span>
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-2xl font-black">28 / 22</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-105 text-slate-500">In / Out</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Average occupancy cycle: 45 min</p>
        </div>

      </div>

      {/* DUAL COLUMN MIDDLE SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* PARKING SLOT INTERACTIVE GRID */}
        <div className="lg:col-span-2 glass p-6 rounded-3xl border border-slate-205 dark:border-slate-850 relative">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Grid className="h-5 w-5 text-primary" /> Array Map: {activeArea}
              </h2>
              <p className="text-xs text-slate-400">Click a slot block to update parameters or change status manually.</p>
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
                  onClick={() => setSelectedSlotDetails({ area: activeArea, slot })}
                  className={`p-4 border rounded-2xl cursor-pointer text-left transition-all duration-200 hover:shadow bg-white dark:bg-slate-900 ${styleBorder}`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-extrabold text-sm">{slot.id}</span>
                    <div className={`h-2.5 w-2.5 rounded-full ${badgeColor}`} />
                  </div>
                  
                  <div className="space-y-1 text-[10px]">
                    <p className={`font-bold capitalize ${textColor}`}>{slot.status}</p>
                    <p className="text-slate-400 font-semibold">{slot.vehicleNo || 'Empty spot'}</p>
                    <p className="text-slate-400">{slot.occupancyTime || 'No duration logs'}</p>
                  </div>
                  
                  <div className="border-t border-slate-100 dark:border-slate-800 mt-2.5 pt-1.5 flex justify-between items-center text-[9px] text-slate-400">
                    <span>IoT Snsr: {slot.sensorStatus === 'Active' ? 'Active' : 'Standby'}</span>
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

      {/* RESERVATION MANAGEMENT TABLE */}
      <div className="glass p-6 rounded-3xl border border-slate-200 dark:border-slate-850">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Database className="h-5 w-5 text-primary" /> Active Reservations Database
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
                    <td className="p-4 text-right">
                      {b.status === 'Confirmed' && (
                        <button
                          onClick={() => handleCancelClick(b.bookingId)}
                          className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl cursor-pointer"
                          title="Cancel Reservation"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
          <p className="text-xs text-slate-450">Telemetry summaries derived from sensor activations.</p>
        </div>

        {/* Render Gorgeous SVGs Custom Charts */}
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
                {/* Horizontal Guide lines */}
                <line x1="20" y1="20" x2="280" y2="20" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="3" className="dark:stroke-slate-800" />
                <line x1="20" y1="60" x2="280" y2="60" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="3" className="dark:stroke-slate-800" />
                <line x1="20" y1="100" x2="280" y2="100" stroke="#cbd5e1" strokeWidth="0.5" className="dark:stroke-slate-800" />
                
                {/* The Path */}
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
                
                {/* Axis Labels */}
                <text x="20" y="112" fontSize="7" fill="#94a3b8" fontWeight="bold">9 AM</text>
                <text x="80" y="112" fontSize="7" fill="#94a3b8" fontWeight="bold">12 PM</text>
                <text x="140" y="112" fontSize="7" fill="#94a3b8" fontWeight="bold">3 PM</text>
                <text x="200" y="112" fontSize="7" fill="#94a3b8" fontWeight="bold">6 PM</text>
                <text x="260" y="112" fontSize="7" fill="#94a3b8" fontWeight="bold">9 PM</text>
              </svg>
            </div>
            <p className="text-[10px] text-slate-450 italic">Spikes occur typically during lunch rush hours.</p>
          </div>

          {/* Chart 2: Weekly Occupancy (Bar Chart) */}
          <div className="p-5 border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10 rounded-2xl space-y-4">
            <h4 className="font-bold text-xs uppercase text-slate-450">Weekly average checkout counts</h4>
            <div className="h-44 w-full">
              <svg className="w-full h-full" viewBox="0 0 300 120">
                <line x1="20" y1="20" x2="280" y2="20" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="3" className="dark:stroke-slate-800" />
                <line x1="20" y1="100" x2="280" y2="100" stroke="#cbd5e1" strokeWidth="0.5" className="dark:stroke-slate-800" />
                
                {/* Graph bars */}
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

          {/* Chart 3: Utilization (Donut chart) */}
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
          <Sliders className="h-5 w-5 text-primary" /> Core System Settings
        </h2>
        <p className="text-xs text-slate-400 mb-6">Modify system-wide peak hour durations, reservation security deposits, and timeout configurations.</p>

        <form onSubmit={handleSettingsSave} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Peak hour start */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-slate-400">Peak Hours Start</label>
            <input
              type="time"
              value={peakStart}
              onChange={(e) => setPeakStart(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary"
            />
          </div>

          {/* Peak hour end */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-slate-400">Peak Hours End</label>
            <input
              type="time"
              value={peakEnd}
              onChange={(e) => setPeakEnd(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary"
            />
          </div>

          {/* Reservation Deposit */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-slate-400">Reservation Deposit (₹)</label>
            <input
              type="number"
              value={deposit}
              onChange={(e) => setDeposit(Number(e.target.value))}
              className="w-full p-3.5 rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-350 focus:outline-none"
            />
          </div>

          {/* Normal parking fee */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-slate-400">Hourly Rate (₹/Hr)</label>
            <input
              type="number"
              value={hourly}
              onChange={(e) => setHourly(Number(e.target.value))}
              className="w-full p-3.5 rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-350 focus:outline-none"
            />
          </div>

          {/* Grace Period */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-slate-400">Grace Period (Minutes)</label>
            <input
              type="number"
              value={grace}
              onChange={(e) => setGrace(Number(e.target.value))}
              className="w-full p-3.5 rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-350 focus:outline-none"
            />
          </div>

          {/* Expiry limit */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-slate-450">Reservation Expiry (Minutes)</label>
            <input
              type="number"
              value={expiry}
              onChange={(e) => setExpiry(Number(e.target.value))}
              className="w-full p-3.5 rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-750 dark:text-slate-350 focus:outline-none animate-custom"
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
                        // Change statuses directly
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
                            occupancyTime: 'Just now'
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

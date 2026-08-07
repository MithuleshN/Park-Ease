import React, { useState, useEffect } from 'react';
import { useParking, type Slot } from '../context/ParkingContext';
import { 
  ArrowLeft, 
  ArrowRight, 
  MapPin, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  User, 
  Phone, 
  CarFront, 
  CreditCard, 
  Printer, 
  Download, 
  Sparkles,
  Ticket
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'react-qr-code';

interface BookingWizardProps {
  onClose: () => void;
}

export const BookingWizard: React.FC<BookingWizardProps> = ({ onClose }) => {
  const { slots, reserveSlot, settings, isPeakHour } = useParking();
  const [step, setStep] = useState(1);

  // Form State
  const [selectedArea, setSelectedArea] = useState<string>('Mall Parking');
  
  // Date and Time selection
  const [bookingDate, setBookingDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [bookingTime, setBookingTime] = useState<string>('10:00'); // default peak hour time
  const [isPeak, setIsPeak] = useState<boolean>(true);

  // Selected Slot
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Driver details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleType, setVehicleType] = useState('Car');

  // Payment status
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Confirmed ticket state
  const [confirmedBooking, setConfirmedBooking] = useState<any>(null);

  // Form Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setIsPeak(isPeakHour(bookingTime));
  }, [bookingTime, settings]);

  const handleAreaSelect = (area: string) => {
    setSelectedArea(area);
    setSelectedSlot(null); // Reset slot selection when area changes
  };

  const getAvailableCount = (areaName: string): number => {
    return slots[areaName]?.filter((s) => s.status === 'available').length || 0;
  };

  // Indian vehicle registration regex format checks e.g., KA-51-AB-1234 or DL 03 C 1234
  const validateVehicleNo = (val: string): boolean => {
    const regex = /^[A-Z]{2}[-|\s]?\d{2}[-|\s]?[A-Z]{1,2}[-|\s]?\d{4}$/i;
    return regex.test(val.trim());
  };

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!customerName.trim()) newErrors.customerName = 'Full Name is required.';
    
    if (!customerPhone.trim()) {
      newErrors.customerPhone = 'Phone Number is required.';
    } else if (!/^\d{10}$/.test(customerPhone.trim())) {
      newErrors.customerPhone = 'Phone Number must be exactly 10 digits.';
    }

    if (!vehicleNo.trim()) {
      newErrors.vehicleNo = 'Vehicle registration number is required.';
    } else if (!validateVehicleNo(vehicleNo)) {
      newErrors.vehicleNo = 'Register number format invalid. (e.g. KA-03-MM-1234)';
    }

    if (!vehicleModel.trim()) newErrors.vehicleModel = 'Vehicle model is required (e.g. Swift).';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setStep(5); // Proceed to payment
  };

  const handlePayment = async () => {
    if (!selectedSlot) return;
    setPaymentLoading(true);

    // Simulate payment delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Save Reservation in Firebase
    const ticket = await reserveSlot({
      area: selectedArea,
      slotId: selectedSlot.id,
      date: bookingDate,
      time: bookingTime,
      deposit: settings.depositFee,
      name: customerName,
      phone: customerPhone,
      vehicleNo: vehicleNo.toUpperCase(),
      vehicleModel: vehicleModel,
      vehicleType: vehicleType,
    });

    setPaymentLoading(false);
    setPaymentSuccess(true);
    setConfirmedBooking(ticket);

    setTimeout(() => setStep(6), 1000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadTicket = () => {
    if (!confirmedBooking) return;
    const ticketData = JSON.stringify(confirmedBooking, null, 2);
    const blob = new Blob([ticketData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ticket-${confirmedBooking.bookingId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetWizardState = () => {
    setStep(1);
    setSelectedSlot(null);
    setCustomerName('');
    setCustomerPhone('');
    setVehicleNo('');
    setVehicleModel('');
    setVehicleType('Car');
    setPaymentSuccess(false);
    setConfirmedBooking(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl glass-solid rounded-3xl overflow-hidden shadow-2xl relative border border-slate-200 dark:border-slate-800 transition-all duration-300">
        
        {/* Wizard Header */}
        <div className="px-6 py-4 bg-slate-100/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">
              Reserve Parking Slot
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200/50 dark:bg-slate-800 hover:bg-slate-350 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Step progress meter */}
        {step < 6 && (
          <div className="px-6 pt-4 flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div 
                key={i} 
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  i <= step ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'
                }`}
              />
            ))}
          </div>
        )}

        {/* Step Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: PARKING AREA */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Step 1: Choose Parking Area</h3>
                  <p className="text-sm text-slate-500">Pick a monitored location for your reservation.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { name: 'Mall Parking', desc: 'Premium mall retail zone parking lot', distance: '1.2 km away' },
                    { name: 'College Parking', desc: 'Main academic campus slot field', distance: '0.4 km away' },
                    { name: 'Hospital Parking', desc: 'Emergency response lot (24/7 priority)', distance: '3.1 km away' },
                    { name: 'Office Parking', desc: 'Corporate tech park employee lot', distance: '1.8 km away' },
                  ].map((loc) => {
                    const isSelected = selectedArea === loc.name;
                    const avail = getAvailableCount(loc.name);
                    return (
                      <div
                        key={loc.name}
                        onClick={() => handleAreaSelect(loc.name)}
                        className={`p-5 rounded-2xl border text-left cursor-pointer transition-all duration-200 hover:shadow-md ${
                          isSelected 
                            ? 'bg-primary/10 border-primary text-primary dark:border-blue-500 dark:bg-slate-800/50' 
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="flex items-center gap-1.5 font-extrabold text-slate-800 dark:text-slate-200">
                            <MapPin className="h-4.5 w-4.5 text-primary" /> {loc.name}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            avail > 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-450' : 'bg-red-100 text-red-800'
                          }`}>
                            {avail} Spots Available
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">{loc.desc}</p>
                        <span className="text-[10px] text-slate-400 font-semibold">{loc.distance}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setStep(2)}
                    className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-full font-bold cursor-pointer glow-primary"
                  >
                    Select Date & Time <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: DATE & TIME */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Step 2: Reservation Date & Time</h3>
                  <p className="text-sm text-slate-500">Reservations are available only during configured peak hours.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Date Input */}
                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-primary" /> Booking Date
                    </label>
                    <input
                      type="date"
                      value={bookingDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setBookingDate(e.target.value)}
                      className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-350 focus:border-primary focus:outline-none"
                    />
                  </div>

                  {/* Time Input */}
                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-primary" /> Booking Time
                    </label>
                    <input
                      type="time"
                      value={bookingTime}
                      onChange={(e) => setBookingTime(e.target.value)}
                      className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-350 focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                {/* Peak Hours Alert Indicators */}
                <div className={`p-4 rounded-2xl flex items-start gap-3 border text-left ${
                  isPeak 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-450 dark:bg-emerald-950/20' 
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-450 dark:bg-rose-950/20'
                }`}>
                  {isPeak ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold">Peak Hours Reservation Active</h4>
                        <p className="text-xs opacity-80 mt-0.5">
                          Selected time slot is inside configuring window ({settings.peakHoursStart} - {settings.peakHoursEnd}). Ready to reserve.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold">Reservation Unavailable</h4>
                        <p className="text-xs opacity-80 mt-0.5">
                          Peak Reserve is closed. Free off-peak hours offer direct drive-in parking without deposit. Please pick a time between {settings.peakHoursStart} and {settings.peakHoursEnd}.
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-4">
                  <button
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 px-6 py-3 rounded-full font-bold cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                  <button
                    disabled={!isPeak}
                    onClick={() => setStep(3)}
                    className={`flex items-center gap-1.5 px-6 py-3 rounded-full font-bold cursor-pointer glow-primary text-white ${
                      isPeak 
                        ? 'bg-primary hover:bg-primary-hover' 
                        : 'bg-slate-300 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50 shadow-none'
                    }`}
                  >
                    Select Spot Map <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: INTERACTIVE PARKING GRID */}
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Step 3: Interactive Parking Map</h3>
                  <p className="text-sm text-slate-500">Pick an available parking slot from the visual terminal layout.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                  
                  {/* Parking Map grid column */}
                  <div className="md:col-span-2 bg-slate-100/50 dark:bg-slate-950/40 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 text-center">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mb-6">
                      🚗 ENTRY BARRIER
                    </span>
                    
                    {/* The Grid layout */}
                    <div className="grid grid-cols-4 gap-4 max-w-sm mx-auto">
                      {(slots[selectedArea] || []).map((slot) => {
                        const isSelected = selectedSlot?.id === slot.id;
                        
                        let colorClass = 'border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-600 bg-white dark:bg-slate-900';
                        let badgeColor = 'bg-slate-200 text-slate-500';

                        if (slot.status === 'available') {
                          badgeColor = 'bg-emerald-500';
                          colorClass = isSelected 
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-450 ring-2 ring-emerald-500/20' 
                            : 'border-emerald-100 hover:border-emerald-450 hover:bg-emerald-50/50 bg-emerald-50/10 dark:bg-emerald-950/5 hover:scale-103';
                        } else if (slot.status === 'occupied') {
                          badgeColor = 'bg-rose-500';
                          colorClass = 'border-rose-200 bg-rose-50 dark:bg-rose-950/15 cursor-not-allowed opacity-80';
                        } else if (slot.status === 'reserved') {
                          badgeColor = 'bg-amber-400';
                          colorClass = 'border-amber-200 bg-amber-50 dark:bg-amber-950/15 cursor-not-allowed opacity-80';
                        } else if (slot.status === 'maintenance') {
                          badgeColor = 'bg-slate-400';
                          colorClass = 'border-slate-200 bg-slate-100 dark:bg-slate-800/50 cursor-not-allowed opacity-50 border-dashed';
                        }

                        return (
                          <div
                            key={slot.id}
                            onClick={() => slot.status === 'available' && setSelectedSlot(slot)}
                            className={`p-3.5 border rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-extrabold cursor-pointer relative ${colorClass}`}
                          >
                            <span className="text-slate-400 text-[10px] font-bold">{slot.id}</span>
                            <div className={`h-3 w-3 rounded-full ${badgeColor}`} />
                          </div>
                        );
                      })}
                    </div>

                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mt-8">
                      🚧 EXIT GATES
                    </span>

                    {/* Legend */}
                    <div className="flex flex-wrap justify-center gap-4 mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                      {[
                        { label: 'Available', color: 'bg-emerald-500' },
                        { label: 'Occupied', color: 'bg-rose-500' },
                        { label: 'Reserved', color: 'bg-amber-400' },
                        { label: 'Maintenance', color: 'bg-slate-400' },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-1.5 text-xs text-slate-500">
                          <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Summary Side Card */}
                  <div className="glass p-5 rounded-2xl border border-slate-200 dark:border-slate-850 text-left space-y-4">
                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                      Selection Summary
                    </h4>

                    {selectedSlot ? (
                      <div className="space-y-4 text-xs">
                        <div className="space-y-2 pb-4 border-b border-slate-200 dark:border-slate-800">
                          <div className="flex justify-between"><span className="text-slate-400">Area:</span> <span className="font-bold">{selectedArea}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Slot No:</span> <span className="font-bold text-emerald-500">{selectedSlot.id}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Date:</span> <span className="font-bold">{bookingDate}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Time:</span> <span className="font-bold">{bookingTime}</span></div>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-1">
                          <span className="font-bold text-slate-500">Deposit:</span>
                          <span className="text-lg font-black text-primary dark:text-blue-400">₹{settings.depositFee}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Please click on an available (green) slot on the map layout.</p>
                    )}
                  </div>

                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-4">
                  <button
                    onClick={() => setStep(2)}
                    className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 px-6 py-3 rounded-full font-bold cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                  <button
                    disabled={!selectedSlot}
                    onClick={() => setStep(4)}
                    className={`flex items-center gap-1.5 px-6 py-3 rounded-full font-bold cursor-pointer glow-primary text-white ${
                      selectedSlot 
                        ? 'bg-primary hover:bg-primary-hover hover:scale-103' 
                        : 'bg-slate-300 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50'
                    }`}
                  >
                    Vehicle Details <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: VEHICLE DETAILS */}
            {step === 4 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Step 4: Driver & Vehicle Details</h3>
                  <p className="text-sm text-slate-500">Provide registration license and contact logs to finalize ticket.</p>
                </div>

                <form onSubmit={handleDetailsSubmit} className="space-y-4 text-left">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5"><User className="h-4 w-4 text-primary" /> Full Name</label>
                      <input
                        type="text"
                        value={customerName}
                        placeholder="John Doe"
                        onChange={(e) => setCustomerName(e.target.value)}
                        className={`w-full p-4 rounded-xl border bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none ${
                          errors.customerName ? 'border-rose-450 focus:border-rose-500' : 'border-slate-200 dark:border-slate-805 focus:border-primary'
                        }`}
                      />
                      {errors.customerName && <p className="text-xs text-rose-500 font-bold">{errors.customerName}</p>}
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5"><Phone className="h-4 w-4 text-primary" /> Phone Number</label>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="9876543210"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
                        className={`w-full p-4 rounded-xl border bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none ${
                          errors.customerPhone ? 'border-rose-450 focus:border-rose-500' : 'border-slate-200 dark:border-slate-805 focus:border-primary'
                        }`}
                      />
                      {errors.customerPhone && <p className="text-xs text-rose-500 font-bold">{errors.customerPhone}</p>}
                    </div>

                    {/* Vehicle Registration */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5"><CarFront className="h-4 w-4 text-primary" /> Vehicle Registration</label>
                      <input
                        type="text"
                        placeholder="KA-03-MM-1234"
                        value={vehicleNo}
                        onChange={(e) => setVehicleNo(e.target.value)}
                        className={`w-full p-4 rounded-xl border bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none ${
                          errors.vehicleNo ? 'border-rose-450 focus:border-rose-500' : 'border-slate-200 dark:border-slate-850 focus:border-primary'
                        }`}
                      />
                      {errors.vehicleNo && <p className="text-xs text-rose-500 font-bold">{errors.vehicleNo}</p>}
                    </div>

                    {/* Vehicle Model */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5"><CarFront className="h-4 w-4 text-primary" /> Vehicle Model</label>
                      <input
                        type="text"
                        placeholder="Honda City"
                        value={vehicleModel}
                        onChange={(e) => setVehicleModel(e.target.value)}
                        className={`w-full p-4 rounded-xl border bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none ${
                          errors.vehicleModel ? 'border-rose-450 focus:border-rose-500' : 'border-slate-200 dark:border-slate-850 focus:border-primary'
                        }`}
                      />
                      {errors.vehicleModel && <p className="text-xs text-rose-500 font-bold">{errors.vehicleModel}</p>}
                    </div>

                    {/* Vehicle Type */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5"><CarFront className="h-4 w-4 text-primary" /> Vehicle Type</label>
                      <select
                        value={vehicleType}
                        onChange={(e) => setVehicleType(e.target.value)}
                        className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-750 dark:text-slate-300 focus:outline-none focus:border-primary"
                      >
                        <option value="Car">Car (ICE)</option>
                        <option value="SUV">SUV (Sport Utility)</option>
                        <option value="EV">Electric Vehicle (EV)</option>
                      </select>
                    </div>

                  </div>

                  {/* Nav Actions */}
                  <div className="flex justify-between pt-6">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 px-6 py-3 rounded-full font-bold cursor-pointer"
                    >
                      <ArrowLeft className="h-4 w-4" /> Back
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-8 py-3 rounded-full font-bold cursor-pointer glow-primary hover:scale-103 transition-transform"
                    >
                      Proceed to Payment <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* STEP 5: PAYMENT CONTAINER */}
            {step === 5 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Step 5: Process Secure Payment</h3>
                  <p className="text-sm text-slate-500">Pay deposit fee to secure your slot instantly on ESP32 mesh.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  
                  {/* Summary ticket */}
                  <div className="p-5 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-100/30 dark:bg-slate-900/10 text-left space-y-4">
                    <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-400">Reservation Summary</h4>
                    <div className="space-y-2.5 text-xs text-slate-650 dark:text-slate-350">
                      <div className="flex justify-between"><span>Location:</span> <span className="font-bold text-slate-850 dark:text-slate-100">{selectedArea}</span></div>
                      <div className="flex justify-between"><span>Parking Slot:</span> <span className="font-bold text-emerald-500">{selectedSlot?.id}</span></div>
                      <div className="flex justify-between"><span>Schedule Date:</span> <span className="font-bold text-slate-850 dark:text-slate-100">{bookingDate}</span></div>
                      <div className="flex justify-between"><span>Schedule Time:</span> <span className="font-bold text-slate-850 dark:text-slate-100">{bookingTime}</span></div>
                      <div className="flex justify-between"><span>Vehicle Type:</span> <span className="font-bold text-slate-850 dark:text-slate-100">{vehicleType}</span></div>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex justify-between items-center text-sm font-extrabold">
                      <span>Reserve Deposit:</span>
                      <span className="text-xl font-black text-primary dark:text-blue-400">₹{settings.depositFee}</span>
                    </div>
                  </div>

                  {/* Payment Choices */}
                  <div className="space-y-4 text-left">
                    <label className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5"><CreditCard className="h-4 w-4 text-primary" /> Payment Method</label>
                    
                    <div className="grid grid-cols-1 gap-2.5">
                      {['UPI (PhonePe / GPay)', 'Credit Card', 'Debit Card', 'Net Banking', 'Paytm Wallet'].map((method) => {
                        const isSel = paymentMethod === method;
                        return (
                          <div
                            key={method}
                            onClick={() => setPaymentMethod(method)}
                            className={`p-3.5 rounded-xl border text-xs font-bold cursor-pointer flex items-center gap-2.5 transition-all duration-200 ${
                              isSel 
                                ? 'bg-primary/5 border-primary text-primary dark:border-blue-500 dark:bg-purple-950/15'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700'
                            }`}
                          >
                            <input
                              type="radio"
                              name="paymentChoice"
                              checked={isSel}
                              onChange={() => {}}
                              className="accent-primary"
                            />
                            <span>{method}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

                {/* Loading state simulation overlay */}
                {paymentLoading && (
                  <div className="p-6 bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3">
                    <div className="h-9 w-9 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400">Processing Reservation Deposit...</span>
                  </div>
                )}

                {/* Successful payment alert */}
                {paymentSuccess && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-450 dark:bg-emerald-950/20 rounded-2xl flex items-center gap-3 justify-center font-bold text-sm">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 animate-bounce" />
                    <span>Payment Confirmed! Handshaking Slot allocation...</span>
                  </div>
                )}

                {/* Back / Pay buttons */}
                {!paymentLoading && (
                  <div className="flex justify-between pt-4">
                    <button
                      onClick={() => setStep(4)}
                      className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-705 dark:text-slate-300 px-6 py-3 rounded-full font-bold cursor-pointer"
                    >
                      <ArrowLeft className="h-4 w-4" /> Back
                    </button>
                    <button
                      onClick={handlePayment}
                      className="flex items-center gap-1.5 bg-secondary hover:bg-secondary-hover text-white px-8 py-3.5 rounded-full font-bold cursor-pointer glow-secondary hover:scale-103 transition-transform"
                    >
                      Pay ₹{settings.depositFee} <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 6: CONFIRMED TICKET */}
            {step === 6 && confirmedBooking && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                
                {/* Successful ticket animation header */}
                <div className="text-center space-y-2">
                  <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
                    Slot Secured Successfully! <Sparkles className="h-5 w-5 text-amber-400" />
                  </h3>
                  <p className="text-xs text-slate-500">Scan QR Code below at the parking terminal gateway sensor.</p>
                </div>

                {/* Classic printable Ticket styling */}
                <div id="printable-ticket" className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 rounded-3xl overflow-hidden shadow-lg p-6 relative">
                  
                  {/* Outer ticket punch dots */}
                  <div className="absolute top-1/2 -left-3 h-6 w-6 rounded-full bg-slate-900 dark:bg-[#0b0f19] border-r border-slate-200 dark:border-slate-850" />
                  <div className="absolute top-1/2 -right-3 h-6 w-6 rounded-full bg-slate-900 dark:bg-[#0b0f19] border-l border-slate-200 dark:border-slate-850" />

                  {/* Header band */}
                  <div className="flex justify-between items-center pb-4 border-b border-dashed border-slate-200 dark:border-slate-800 mb-6">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">System Ticket</span>
                      <p className="text-sm font-black text-slate-700 dark:text-slate-200">{confirmedBooking.area}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Reserved Spot</span>
                      <p className="text-lg font-black text-emerald-580 dark:text-emerald-400">{confirmedBooking.slotId}</p>
                    </div>
                  </div>

                  {/* QR rendering container */}
                  <div className="p-4 bg-white dark:bg-white rounded-2xl w-fit mx-auto border border-slate-200 shadow-sm mb-6 flex justify-center items-center">
                    <QRCode
                      value={JSON.stringify({
                        bookingId: confirmedBooking.bookingId,
                        vehicleNo: confirmedBooking.vehicleNo,
                        slotId: confirmedBooking.slotId,
                        area: confirmedBooking.area,
                        date: confirmedBooking.date,
                        time: confirmedBooking.time
                      })}
                      size={150}
                    />
                  </div>

                  {/* Meta fields */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-left text-xs pb-4 border-b border-dashed border-slate-200 dark:border-slate-800 mb-4">
                    <div><span className="text-slate-400 block font-semibold">Driver:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{confirmedBooking.name}</span></div>
                    <div><span className="text-slate-400 block font-semibold">Phone:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{confirmedBooking.phone}</span></div>
                    <div><span className="text-slate-400 block font-semibold">Plate No:</span> <span className="font-bold text-primary">{confirmedBooking.vehicleNo}</span></div>
                    <div><span className="text-slate-400 block font-semibold">Model / Type:</span> <span className="font-bold text-slate-850 dark:text-slate-200">{confirmedBooking.vehicleModel} ({confirmedBooking.vehicleType})</span></div>
                    <div><span className="text-slate-400 block font-semibold">Date & Time:</span> <span className="font-bold text-slate-855 dark:text-slate-200">{confirmedBooking.date} / {confirmedBooking.time}</span></div>
                    <div><span className="text-slate-400 block font-semibold">Deposit status:</span> <span className="font-black text-emerald-500">₹{confirmedBooking.deposit} paid</span></div>
                  </div>

                  {/* Ticket bottom code */}
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
                    <span>ID: {confirmedBooking.bookingId}</span>
                    <span>Status: Confirmed</span>
                  </div>

                </div>

                {/* Print/Download Button Group */}
                <div className="flex flex-wrap gap-3 justify-center pt-4">
                  <button
                    onClick={handleDownloadTicket}
                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 px-5 py-2.5 rounded-full font-bold cursor-pointer text-xs"
                  >
                    <Download className="h-4.5 w-4.5" /> Download Ticket
                  </button>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 px-5 py-2.5 rounded-full font-bold cursor-pointer text-xs"
                  >
                    <Printer className="h-4.5 w-4.5" /> Print Ticket
                  </button>
                  <button
                    onClick={resetWizardState}
                    className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-7 py-3 rounded-full font-bold cursor-pointer text-xs glow-primary"
                  >
                    Book Another Slot
                  </button>
                </div>

              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>
    </div>
  );
};

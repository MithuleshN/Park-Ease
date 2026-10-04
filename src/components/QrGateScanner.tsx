import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Camera, 
  UploadCloud, 
  Zap, 
  Keyboard, 
  X, 
  RefreshCw, 
  AlertCircle,
  CheckCircle2,
  QrCode,
  LogIn,
  LogOut,
  CarFront,
  Clock
} from 'lucide-react';
import { playScanSuccessBeep, playScanErrorBeep } from '../utils/scannerAudio';

interface QrGateScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (scannedData: string) => void;
  activeArea: string;
  pendingCheckIns: {
    bookingId: string;
    vehicleNo: string;
    vehicleModel?: string;
    vehicleType?: string;
    slotId: string;
    area: string;
    name: string;
    phone: string;
    date: string;
    time: string;
    deposit: number;
  }[];
  activeParkedVehicles: {
    slotId: string;
    vehicleNo: string;
    vehicleModel?: string;
    vehicleType?: string;
    area: string;
    ownerName?: string;
    ownerPhone?: string;
    entryTime: string;
    logId?: string;
    depositPaid?: number;
  }[];
  recentCheckouts: {
    logId: string;
    slotId: string;
    vehicleNo: string;
    vehicleModel?: string;
    vehicleType?: string;
    area: string;
    entryTime: string;
    exitTime: string;
    durationMinutes: number;
    totalFare: number;
    amountDue: number;
  }[];
}

export const QrGateScanner: React.FC<QrGateScannerProps> = ({
  isOpen,
  onClose,
  onScan,
  activeArea,
  pendingCheckIns,
  activeParkedVehicles,
  recentCheckouts,
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'file' | 'demo' | 'manual'>('camera');
  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [manualInput, setManualInput] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);

  // Initialize camera scanner when modal opens and camera tab is active
  useEffect(() => {
    if (!isOpen || activeTab !== 'camera') {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, facingMode]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      // Small delay to ensure DOM element exists
      await new Promise((r) => setTimeout(r, 150));
      const element = document.getElementById('qr-camera-feed');
      if (!element) return;

      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-camera-feed');
      }

      if (isScanningRef.current) {
        await html5QrCodeRef.current.stop();
        isScanningRef.current = false;
      }

      await html5QrCodeRef.current.start(
        { facingMode },
        {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleSuccess(decodedText);
        },
        () => {
          // ignore frame decode noise
        }
      );

      isScanningRef.current = true;
      setCameraStarted(true);
    } catch (err: unknown) {
      console.warn('Camera failed to start:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setCameraError(errMsg || 'Camera permission denied or camera not found. Please try File Upload or Demo mode.');
      setCameraStarted(false);
      isScanningRef.current = false;
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current && isScanningRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (e) {
        console.warn('Error stopping camera:', e);
      }
      isScanningRef.current = false;
    }
    setCameraStarted(false);
  };

  const handleSuccess = (data: string) => {
    playScanSuccessBeep();
    stopCamera();
    onScan(data);
    onClose();
  };

  // File Upload scan
  const handleFileUpload = async (file: File) => {
    try {
      setCameraError(null);
      const scanner = new Html5Qrcode('qr-temp-file-scanner');
      const decoded = await scanner.scanFile(file, true);
      scanner.clear();
      handleSuccess(decoded);
    } catch {
      playScanErrorBeep();
      setCameraError('No valid QR code was detected in this image. Please upload a clear QR code image.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleSuccess(manualInput.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-left">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary dark:bg-blue-500/20 dark:text-blue-400">
              <QrCode className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-base">
                Smart Gate QR Scanner Terminal
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Gate In (Start Timestamp) & Gate Out (Automated Fare Billing)
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center cursor-pointer transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="px-6 pt-4 flex gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('camera')}
            className={`flex items-center gap-1.5 pb-3 px-3 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'camera'
                ? 'border-primary text-primary dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Camera className="h-4 w-4" /> Live Camera
          </button>

          <button
            onClick={() => setActiveTab('file')}
            className={`flex items-center gap-1.5 pb-3 px-3 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'file'
                ? 'border-primary text-primary dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <UploadCloud className="h-4 w-4" /> Upload Ticket QR
          </button>

          <button
            onClick={() => setActiveTab('demo')}
            className={`flex items-center gap-1.5 pb-3 px-3 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'demo'
                ? 'border-primary text-primary dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Zap className="h-4 w-4 text-amber-500" /> 1-Click Test Simulation
          </button>

          <button
            onClick={() => setActiveTab('manual')}
            className={`flex items-center gap-1.5 pb-3 px-3 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'manual'
                ? 'border-primary text-primary dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Keyboard className="h-4 w-4" /> Barcode / Text Input
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          
          {/* TAB 1: LIVE CAMERA */}
          {activeTab === 'camera' && (
            <div className="space-y-4 text-center">
              <div className="relative mx-auto w-full max-w-sm aspect-square bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-inner flex items-center justify-center">
                
                {/* Scanner container for html5-qrcode */}
                <div id="qr-camera-feed" className="w-full h-full" />

                {/* Laser scan line overlay */}
                {cameraStarted && (
                  <div className="absolute inset-x-6 top-1/4 h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_12px_#f43f5e] animate-pulse pointer-events-none" />
                )}

                {/* Target box viewfinder */}
                {cameraStarted && (
                  <div className="absolute inset-10 border-2 border-dashed border-emerald-400/70 rounded-2xl pointer-events-none flex flex-col justify-between p-2">
                    <div className="flex justify-between">
                      <div className="w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                      <div className="w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                    </div>
                    <div className="text-[10px] text-emerald-400 font-bold bg-black/60 px-2 py-0.5 rounded-full mx-auto">
                      Align User QR Here
                    </div>
                    <div className="flex justify-between">
                      <div className="w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                      <div className="w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
                    </div>
                  </div>
                )}

                {!cameraStarted && !cameraError && (
                  <div className="p-6 text-slate-400 space-y-2">
                    <Camera className="h-10 w-10 mx-auto text-slate-600 animate-pulse" />
                    <p className="text-xs font-semibold">Starting camera video stream...</p>
                  </div>
                )}

                {cameraError && (
                  <div className="p-6 text-rose-400 space-y-2 bg-slate-900/95 absolute inset-0 flex flex-col items-center justify-center">
                    <AlertCircle className="h-10 w-10 text-rose-500" />
                    <p className="text-xs font-bold text-slate-200">Camera Unavailable</p>
                    <p className="text-[11px] text-slate-400 max-w-xs">{cameraError}</p>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={startCamera}
                        className="px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="h-3 w-3" /> Retry
                      </button>
                      <button
                        onClick={() => setActiveTab('demo')}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-[11px] font-bold cursor-pointer"
                      >
                        Switch to 1-Click Demo
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Camera Switcher Controls */}
              <div className="flex justify-center items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Flip Camera ({facingMode === 'environment' ? 'Rear' : 'Front'})
                </button>
                <p className="text-[11px] text-slate-400">
                  Point camera at the ticket generated in User Portal.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: FILE UPLOAD */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`p-10 border-2 border-dashed rounded-3xl text-center cursor-pointer transition-all duration-200 ${
                  dragOver
                    ? 'border-primary bg-primary/10'
                    : 'border-slate-300 dark:border-slate-700 hover:border-primary bg-slate-50 dark:bg-slate-900/50'
                }`}
                onClick={() => document.getElementById('qr-file-input')?.click()}
              >
                <UploadCloud className="h-12 w-12 text-primary mx-auto mb-3 animate-bounce" />
                <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                  Upload or Drag & Drop Ticket QR Image
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Upload a screenshot or downloaded QR ticket file (PNG, JPG, WEBP).
                </p>
                <input
                  id="qr-file-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
              </div>

              {cameraError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}

              {/* Hidden element required by html5-qrcode for scanFile */}
              <div id="qr-temp-file-scanner" className="hidden" />
            </div>
          )}

          {/* TAB 3: ONE-CLICK TEST SIMULATION */}
          {activeTab === 'demo' && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xs text-blue-600 dark:text-blue-300 flex items-start gap-2.5">
                <Zap className="h-4.5 w-4.5 shrink-0 text-amber-500 mt-0.5" />
                <p>
                  <strong>Instant Demo Mode:</strong> Test the full IoT flow in 1 click — occupy a slot to <strong>start the clock</strong>, vacate it to <strong>stop the clock</strong>, then scan at the exit gate to <strong>show the elapsed time & fare</strong>. No camera or phone needed!
                </p>
              </div>

              {/* Section 1: Gate IN (Arriving Bookings) */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <LogIn className="h-4 w-4 text-emerald-500" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    1. Arriving Vehicles (Test Gate IN & Start Clock)
                  </h4>
                </div>
                
                {pendingCheckIns.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {pendingCheckIns.map((bk) => {
                      const payload = JSON.stringify({
                        parkEasePass: true,
                        bookingId: bk.bookingId,
                        vehicleNo: bk.vehicleNo,
                        vehicleModel: bk.vehicleModel || 'Car',
                        vehicleType: bk.vehicleType || 'Car',
                        name: bk.name,
                        phone: bk.phone,
                        area: bk.area,
                        slotId: bk.slotId,
                        date: bk.date,
                        time: bk.time,
                        deposit: bk.deposit,
                      });

                      return (
                        <button
                          key={bk.bookingId}
                          type="button"
                          onClick={() => handleSuccess(payload)}
                          className="p-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-left cursor-pointer transition flex justify-between items-center"
                        >
                          <div>
                            <span className="font-black text-xs text-slate-800 dark:text-slate-100">{bk.vehicleNo}</span>
                            <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                              Slot {bk.slotId} • {bk.name}
                            </span>
                          </div>
                          <span className="px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg shrink-0">
                            + Scan IN
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic bg-slate-100 dark:bg-slate-800/40 p-3 rounded-xl">
                    No reserved bookings waiting to check in. (You can book one from the User Portal or use a walk-in demo below).
                  </p>
                )}

                {/* Walk-in simulation */}
                <button
                  type="button"
                  onClick={() => {
                    const walkInPayload = JSON.stringify({
                      parkEasePass: true,
                      bookingId: `WALK-${Math.floor(1000 + Math.random() * 9000)}`,
                      vehicleNo: `KA-01-EQ-${Math.floor(1000 + Math.random() * 9000)}`,
                      vehicleModel: 'Toyota Innova',
                      vehicleType: 'Car',
                      name: 'Walk-in Driver',
                      phone: '9876543210',
                      area: activeArea,
                      slotId: 'A1',
                      deposit: 0,
                    });
                    handleSuccess(walkInPayload);
                  }}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CarFront className="h-4 w-4 text-primary" /> Simulate New Walk-in Vehicle Scan
                </button>
              </div>

              {/* Section 2: Gate OUT (Parked Vehicles) */}
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <LogOut className="h-4 w-4 text-rose-500" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    2. Parked Vehicles (Test Gate OUT & Automated Fare)
                  </h4>
                </div>

                {activeParkedVehicles.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activeParkedVehicles.map((parked) => {
                      const payload = JSON.stringify({
                        parkEasePass: true,
                        vehicleNo: parked.vehicleNo,
                        slotId: parked.slotId,
                        area: parked.area,
                        logId: parked.logId,
                        vehicleType: parked.vehicleType,
                      });

                      const entryTimeFormatted = new Date(parked.entryTime).toLocaleTimeString([], {
                        hour: '2-digit', minute: '2-digit'
                      });

                      return (
                        <button
                          key={`${parked.area}-${parked.slotId}`}
                          type="button"
                          onClick={() => handleSuccess(payload)}
                          className="p-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-left cursor-pointer transition flex justify-between items-center"
                        >
                          <div>
                            <span className="font-black text-xs text-slate-800 dark:text-slate-100">{parked.vehicleNo}</span>
                            <span className="block text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                              Slot {parked.slotId} • In @ {entryTimeFormatted}
                            </span>
                          </div>
                          <span className="px-2 py-1 bg-rose-600 text-white text-[10px] font-bold rounded-lg shrink-0">
                            - Scan OUT
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic bg-slate-100 dark:bg-slate-800/40 p-3 rounded-xl">
                    No vehicles currently parked inside. Scan a vehicle in first!
                  </p>
                )}
              </div>

              {/* Section 3: Gate OUT (Sensor-Closed Sessions) */}
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    3. Vacated Slots (Sensor Stopped Clock — Awaiting Exit Bill)
                  </h4>
                </div>

                {recentCheckouts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {recentCheckouts.map((job) => {
                      const payload = JSON.stringify({
                        parkEasePass: true,
                        vehicleNo: job.vehicleNo,
                        slotId: job.slotId,
                        area: job.area,
                        logId: job.logId,
                        vehicleType: job.vehicleType,
                      });

                      const hrs = Math.floor(job.durationMinutes / 60);
                      const mins = job.durationMinutes % 60;
                      const durationText = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

                      return (
                        <button
                          key={job.logId}
                          type="button"
                          onClick={() => handleSuccess(payload)}
                          className="p-3 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-left cursor-pointer transition flex justify-between items-center"
                        >
                          <div>
                            <span className="font-black text-xs text-slate-800 dark:text-slate-100">{job.vehicleNo}</span>
                            <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                              Slot {job.slotId} • {durationText} • ₹{job.amountDue} due
                            </span>
                          </div>
                          <span className="px-2 py-1 bg-amber-600 text-white text-[10px] font-bold rounded-lg shrink-0">
                            - Bill OUT
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic bg-slate-100 dark:bg-slate-800/40 p-3 rounded-xl">
                    No vacated slots awaiting billing yet. Let the IoT simulator free a slot (or use a slot override) to stop a clock, then bill it here.
                  </p>
                )}
              </div>

            </div>
          )}

          {/* TAB 4: MANUAL TEXT INPUT */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-slate-400 block mb-1.5">
                  Paste Scanned QR String, Booking ID, or License Plate
                </label>
                <textarea
                  rows={4}
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder='Paste JSON payload or enter e.g. KA-03-MM-1234 or BK-12345...'
                  className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-full text-xs font-bold cursor-pointer glow-primary transition"
                >
                  Process Scanned Code
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-[11px] text-slate-400">
          <span>Target Area: <strong className="text-slate-700 dark:text-slate-200">{activeArea}</strong></span>
          <span className="flex items-center gap-1 text-emerald-500 font-bold">
            <CheckCircle2 className="h-3.5 w-3.5" /> Barrier Gate Sensor Online
          </span>
        </div>

      </div>
    </div>
  );
};

import React from 'react';
import { 
  Map, 
  Layers, 
  QrCode, 
  CreditCard, 
  Calculator, 
  Activity, 
  History, 
  Cpu, 
  Car, 
  Sparkles,
  Zap,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  BatteryCharging,
  Smartphone,
  CloudLightning,
  Navigation
} from 'lucide-react';
import { motion } from 'framer-motion';

interface LandingProps {
  onStartBooking: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onStartBooking }) => {
  
  const features = [
    { icon: <Activity className="h-6 w-6 text-primary" />, title: 'Real-Time Availability', desc: 'IoT sensors detect occupancy changes instantly, reflecting live status.' },
    { icon: <Map className="h-6 w-6 text-emerald-500" />, title: 'Interactive Map', desc: 'Select preferred parking slots through a beautiful grid interface.' },
    { icon: <Layers className="h-6 w-6 text-blue-500" />, title: 'Hybrid Reservation', desc: 'Reserve online for peak hours, or park directly via sensor automation.' },
    { icon: <QrCode className="h-6 w-6 text-purple-500" />, title: 'QR Code Entry/Exit', desc: 'Seamless gate access. Just scan your generated ticket QR at the kiosk.' },
    { icon: <CreditCard className="h-6 w-6 text-amber-500" />, title: 'Reservation Deposit', desc: 'Pay a nominal ₹50 deposit to hold your slot during busiest times.' },
    { icon: <Calculator className="h-6 w-6 text-pink-500" />, title: 'Automatic Fee Calc', desc: 'Intelligent computation of dues based on actual park duration.' },
    { icon: <Cpu className="h-6 w-6 text-red-500" />, title: 'IoT Powered Monitoring', desc: 'Integrates natively with ESP32 nodes and optical proximity sensors.' },
    { icon: <History className="h-6 w-6 text-emerald-600" />, title: 'Parking History', desc: 'Trace back previous sessions and invoices directly on dashboard.' },
    { icon: <TrendingUp className="h-6 w-6 text-indigo-500" />, title: 'Live Slot Monitoring', desc: 'Constant telemetry streaming directly to the administrator dashboard.' },
  ];

  const steps = [
    { num: '1', title: 'Select Parking Area', desc: 'Choose your desired endpoint (Mall, Campus, Hospital).' },
    { num: '2', title: 'Choose Date & Time', desc: 'Indicate your check-in time during enabled configuration.' },
    { num: '3', title: 'Select Parking Slot', desc: 'Inspect layout and pick your spot from active grid.' },
    { num: '4', title: 'Enter Vehicle Details', desc: 'Input owner logs and license plate number.' },
    { num: '5', title: 'Pay Reservation Deposit', desc: 'Checkout securely online with ₹50 reserve security.' },
    { num: '6', title: 'Receive QR Code', desc: 'Show ticket at the entry scanner to open gate arm.' },
  ];

  const futureFeatures = [
    { icon: <CreditCard className="h-6 w-6" />, title: 'Digital Payment Integration', desc: 'Auto debit wallets (Fastag/UPI AutoPay) on parking exit.' },
    { icon: <Zap className="h-6 w-6" />, title: 'AI Prediction engine', desc: 'AI forecast models predicting spot availability hourly.' },
    { icon: <ShieldCheck className="h-6 w-6" />, title: 'ANPR (License Plate Scan)', desc: 'Automatic camera recognition of vehicle plates.' },
    { icon: <BatteryCharging className="h-6 w-6" />, title: 'EV Smart Charger Reserve', desc: 'Book charging docks simultaneously with parking slot.' },
    { icon: <Smartphone className="h-6 w-6" />, title: 'Mobile Companion App', desc: 'React Native companion app offering offline access.' },
    { icon: <CloudLightning className="h-6 w-6" />, title: 'Cloud Analytics', desc: 'Cross-site coordination and analytics pipelines.' },
    { icon: <Navigation className="h-6 w-6" />, title: 'Indoor Smart Navigation', desc: 'AR guidance leading driver exactly to the reserved spot.' },
  ];

  const handleLearnMore = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="space-y-24 pb-20">
      
      {/* HERO SECTION */}
      <section id="home" className="relative pt-16 md:pt-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Hero Left Content */}
          <div className="col-span-1 lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-xs font-semibold text-primary dark:text-blue-300">
              <Sparkles className="h-3.5 w-3.5" /> Next-gen IoT Parking Management
            </div>
            
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-none text-slate-900 dark:text-white">
              Smart Parking <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                Made Easy
              </span>
            </h1>

            <p className="text-lg text-slate-500 dark:text-slate-400 max-w-xl">
              Find available parking spaces in real time, reserve your preferred slot during peak hours, pay a reservation deposit, and receive a QR code for hassle-free parking.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <button
                onClick={onStartBooking}
                className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-8 py-4 rounded-full font-bold shadow-lg shadow-blue-500/20 hover:scale-103 transition-all duration-200 glow-primary cursor-pointer"
              >
                Book Parking <ArrowRight className="h-5 w-5" />
              </button>
              <button
                onClick={handleLearnMore}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 px-8 py-4 rounded-full font-bold shadow-sm transition-all duration-200 cursor-pointer"
              >
                Learn More
              </button>
            </div>
          </div>

          {/* Hero Right Visuals */}
          <div className="col-span-1 lg:col-span-5 relative flex justify-center items-center">
            
            {/* Background design blobs */}
            <div className="absolute -top-12 -left-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-secondary/15 rounded-full blur-3xl" />

            {/* Smart City Simulation Visualizer */}
            <div className="relative glass p-6 rounded-3xl w-full max-w-md shadow-2xl border border-white/20 dark:border-white/5 animate-float-slow">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-bold text-xs uppercase text-slate-400">Live Simulator</h3>
                  <p className="text-lg font-black text-slate-800 dark:text-slate-200">Terminal 1 Lot</p>
                </div>
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              {/* Grid map visuals */}
              <div className="grid grid-cols-4 gap-4 p-4 bg-slate-100/50 dark:bg-slate-950/40 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                {/* Visual slot indicators */}
                {[
                  { id: 'A1', color: 'bg-emerald-500' },
                  { id: 'A2', color: 'bg-rose-500' },
                  { id: 'A3', color: 'bg-amber-400 animate-pulse' },
                  { id: 'A4', color: 'bg-emerald-500' },
                  { id: 'B1', color: 'bg-emerald-500' },
                  { id: 'B2', color: 'bg-emerald-500' },
                  { id: 'B3', color: 'bg-rose-500' },
                  { id: 'B4', color: 'bg-slate-400' },
                ].map((slot, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1.5 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <span className="text-[9px] font-bold text-slate-400">{slot.id}</span>
                    <div className={`h-4.5 w-4.5 rounded-full ${slot.color}`} />
                  </div>
                ))}
              </div>

              {/* Car Visual Overlay */}
              <div className="mt-4 flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/10">
                <Car className="h-5 w-5 text-primary animate-bounce" />
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Gate Bar open: Vehicle entering...
                </span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-4 text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">
            Smart Features built for reliability
          </h2>
          <p className="text-slate-500 dark:text-slate-400">
            Park Ease bridges logic and physical hardware, bringing web simplicity to core parking management.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              whileHover={{ y: -5 }}
              className="glass p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-850 hover:shadow-md transition-all duration-300"
            >
              <div className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 rounded-xl w-fit mb-4">
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS TIMELINE */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-4 text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">
            Seamless 6-Step Implementation
          </h2>
          <p className="text-slate-500 dark:text-slate-400">
            The process of reserving a parking slot online, taking less than 2 minutes.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative">
          {steps.map((step, idx) => (
            <div key={idx} className="relative p-6 glass rounded-3xl border border-slate-100 dark:border-slate-850">
              <span className="absolute top-4 right-6 text-5xl font-black text-slate-200 dark:text-slate-800 select-none">
                {step.num}
              </span>
              <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-600 text-white font-black text-lg mb-6 shadow-md glow-primary">
                {step.num}
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{step.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FUTURE DESIGNS */}
      <section id="future-plans" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-4 text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">
            Future IoT Advancements
          </h2>
          <p className="text-slate-500 dark:text-slate-400">
            Planned updates integration with edge computers and deep computer-vision networks (under construction).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {futureFeatures.map((fut, idx) => (
            <div 
              key={idx} 
              className="p-6 bg-slate-100/50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl opacity-65 select-none"
            >
              <div className="p-2.5 bg-slate-200 dark:bg-slate-850 rounded-xl w-fit text-slate-400 dark:text-slate-600 mb-4">
                {fut.icon}
              </div>
              <h3 className="text-base font-bold text-slate-500 dark:text-slate-400 mb-1">{fut.title}</h3>
              <p className="text-xs text-slate-400 dark:text-slate-550 leading-relaxed">{fut.desc}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
};

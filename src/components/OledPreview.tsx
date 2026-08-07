import React from 'react';
import { useParking } from '../context/ParkingContext';
import { Cpu } from 'lucide-react';

interface OledPreviewProps {
  activeArea: string;
}

export const OledPreview: React.FC<OledPreviewProps> = ({ activeArea }) => {
  const { slots } = useParking();
  const areaSlots = slots[activeArea] || [];
  
  const available = areaSlots.filter(s => s.status === 'available').length;
  const occupied = areaSlots.filter(s => s.status === 'occupied').length;
  const reserved = areaSlots.filter(s => s.status === 'reserved').length;

  const padZero = (n: number) => {
    return n < 10 ? `0${n}` : `${n}`;
  };

  const isOpen = available > 0;

  return (
    <div id="oled-monitor" className="relative p-6 glass rounded-3xl border border-slate-205 dark:border-slate-850 text-left">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-xs uppercase text-slate-400 flex items-center gap-1">
          <Cpu className="h-4 w-4 text-emerald-500" /> SSD1306 OLED Display
        </h3>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-450 font-bold uppercase tracking-wider">
          ESP32 I2C
        </span>
      </div>
      
      <p className="text-[11px] text-slate-450 mb-4 font-medium leading-normal">
        Simulates SSD1306 OLED 128x64 display powered by micro-controller, updating in real-time as sensors trigger state.
      </p>

      {/* Frame of the physical OLED Module */}
      <div className="bg-slate-900 dark:bg-slate-950 p-4 pt-8 rounded-2xl border-4 border-slate-700 shadow-2xl relative max-w-sm mx-auto overflow-hidden">
        
        {/* I2C Pins labels */}
        <div className="absolute top-1 left-12 right-12 flex justify-between text-[8px] font-black text-slate-500 tracking-wider">
          <span>GND</span>
          <span>VCC</span>
          <span>SCL</span>
          <span>SDA</span>
        </div>

        {/* OLED Screen (Monochrome Blue/Yellow theme) */}
        <div className="bg-black border border-blue-900/60 p-4 rounded shadow-inner min-h-36 flex flex-col justify-between oled-screen">
          
          {/* Top Yellow Band (Common in 0.96 inch SSD1306 widgets) */}
          <div className="border-b border-yellow-500/30 pb-1.5 flex justify-between text-[11px] font-bold text-yellow-400 tracking-normal antialiased">
            <span>Park Ease IoT</span>
            <span className="animate-pulse">● LIVE</span>
          </div>

          {/* Bottom Blue Screen Content */}
          <div className="pt-3 space-y-1.5 text-xs text-blue-400 font-bold tracking-wider leading-relaxed">
            <div className="flex justify-between">
              <span>Available :</span>
              <span className="text-right text-blue-300 font-black">{padZero(available)}</span>
            </div>
            
            <div className="flex justify-between">
              <span>Occupied  :</span>
              <span className="text-right text-blue-300 font-black">{padZero(occupied)}</span>
            </div>

            <div className="flex justify-between">
              <span>Reserved  :</span>
              <span className="text-right text-blue-300 font-black">{padZero(reserved)}</span>
            </div>

            <div className="flex justify-between pt-2 border-t border-blue-900/20 text-[10px]">
              <span>Gate Arm  :</span>
              <span className={`font-black uppercase ${isOpen ? 'text-emerald-450' : 'text-rose-450 animate-pulse'}`}>
                {isOpen ? 'OPEN' : 'FULL'}
              </span>
            </div>
          </div>
          
        </div>
      </div>

      {/* Breadboard details underneath */}
      <div className="mt-4 p-2.5 bg-slate-100 dark:bg-slate-900/40 rounded-xl flex items-center justify-between text-[10px] text-slate-500 font-bold border border-slate-205 dark:border-slate-800">
        <span>Node: esp32_node_01</span>
        <span>I2C Addr: 0x3C</span>
      </div>
    </div>
  );
};

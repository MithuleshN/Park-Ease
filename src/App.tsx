import { useState, useEffect } from 'react';
import { ParkingProvider, useParking } from './context/ParkingContext';
import { Navbar } from './components/Navbar';
import { Landing } from './components/Landing';
import { BookingWizard } from './components/BookingWizard';
import { AdminDashboard } from './components/AdminDashboard';
import { Footer } from './components/Footer';

function MainApp() {
  const [currentTab, setCurrentTab] = useState<'user' | 'admin'>('user');
  const [darkMode, setDarkMode] = useState(false);
  const [bookingWizardOpen, setBookingWizardOpen] = useState(false);
  const { loading } = useParking();

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className="flex flex-col min-h-screen text-slate-800 dark:text-slate-100 transition-colors duration-300">

      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      <main className="flex-grow pt-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-400">Connecting to live parking data...</p>
          </div>
        ) : currentTab === 'user' ? (
          <Landing onStartBooking={() => setBookingWizardOpen(true)} />
        ) : (
          <AdminDashboard />
        )}
      </main>

      <Footer />

      {bookingWizardOpen && (
        <BookingWizard onClose={() => setBookingWizardOpen(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ParkingProvider>
      <MainApp />
    </ParkingProvider>
  );
}

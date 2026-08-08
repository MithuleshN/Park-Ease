import React, { useState } from 'react';
import { Shield, Sparkles, Sun, Moon, Menu, X, Landmark } from 'lucide-react';

interface NavbarProps {
  currentTab: 'user' | 'admin';
  setCurrentTab: (tab: 'user' | 'admin') => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  darkMode,
  setDarkMode,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Home', href: '#home' },
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'OLED Monitor', href: '#oled-monitor' },
    { label: 'Future Plans', href: '#future-plans' },
  ];

  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    if (currentTab !== 'user') {
      setCurrentTab('user');
      setTimeout(() => {
        document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  return (
    <nav className="sticky top-4 z-50 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="glass-solid rounded-full px-6 py-4 shadow-lg transition-all duration-300">
        <div className="flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => setCurrentTab('user')}>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white glow-primary">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-primary dark:text-blue-400">
                Park<span className="text-secondary">Ease</span>
              </span>
              <span className="block text-[8px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                IoT Reservation
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-7 xl:gap-9">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleScroll(e, link.href)}
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary dark:hover:text-blue-400 transition-colors duration-200 whitespace-nowrap"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Control Group */}
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            {/* Theme Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors duration-200"
              title="Toggle Theme"
            >
              {darkMode ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-slate-700" />}
            </button>

            {/* Portal Switcher */}
            <button
              onClick={() => {
                setCurrentTab(currentTab === 'user' ? 'admin' : 'user');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all duration-300 shadow-md whitespace-nowrap ${
                currentTab === 'admin'
                  ? 'bg-secondary text-white hover:bg-secondary-hover glow-secondary'
                  : 'bg-primary text-white hover:bg-primary-hover glow-primary'
              }`}
            >
              {currentTab === 'admin' ? (
                <><Sparkles className="h-4 w-4" /> Guest Portal</>
              ) : (
                <><Shield className="h-4 w-4" /> Admin Dashboard</>
              )}
            </button>
          </div>

          {/* Mobile Menu Actions */}
          <div className="flex items-center gap-2 sm:hidden">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="absolute top-22 left-4 right-4 z-50 rounded-3xl glass-solid p-6 shadow-2xl transition-all duration-300 sm:hidden border border-slate-200 dark:border-slate-800">
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleScroll(e, link.href)}
                className="text-base font-semibold text-slate-800 dark:text-slate-300 py-2 border-b border-slate-200 dark:border-slate-800"
              >
                {link.label}
              </a>
            ))}
            <button
              onClick={() => {
                setCurrentTab(currentTab === 'user' ? 'admin' : 'user');
                setMobileMenuOpen(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-bold uppercase text-sm tracking-wider ${
                currentTab === 'admin' ? 'bg-secondary text-white' : 'bg-primary text-white'
              }`}
            >
              {currentTab === 'admin' ? (
                <><Sparkles className="h-4 w-4" /> Go to Guest Booking</>
              ) : (
                <><Shield className="h-4 w-4" /> Go to Admin Dashboard</>
              )}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

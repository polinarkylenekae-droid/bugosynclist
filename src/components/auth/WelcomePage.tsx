import React from 'react';
import { 
  UserPlus, 
  LogIn, 
  ShieldCheck, 
  FileCheck2, 
  Users 
} from 'lucide-react';
import { BugoSealEmblem } from '../BugoLogo';
import { useApp } from '../../context/AppContext';

export const WelcomePage: React.FC = () => {
  const { setAuthView } = useApp();

  return (
    <div className="min-h-screen bg-[#f3f6f9] flex flex-col justify-between text-gray-800 font-sans antialiased selection:bg-emerald-100 selection:text-emerald-900">

      {/* Main Centered Content in Landscape Web Format */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-8 py-10 flex flex-col items-center justify-center">
        
        {/* Main Card Container */}
        <div className="w-full bg-white rounded-3xl border border-gray-200/90 shadow-xl overflow-hidden p-8 sm:p-14 flex flex-col justify-between items-center text-center space-y-8">
          
          {/* Center Area: Official Seal, Welcome To, Bugo Sync List, and Tagline */}
          <div className="w-full flex flex-col items-center space-y-4 my-auto">
            
            {/* Prominent Official Seal Badge */}
            <div className="relative group cursor-default mb-1">
              <BugoSealEmblem 
                sizePx={148} 
                className="relative transform transition-transform duration-300 group-hover:scale-105" 
              />
            </div>

            {/* "Welcome to" + Title + Tagline */}
            <div className="space-y-1">
              <p className="text-base sm:text-lg font-normal text-gray-800 tracking-normal">
                Welcome to
              </p>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0c532b] tracking-tight leading-tight">
                Bugo Sync List
              </h1>
              <p className="text-sm sm:text-base font-medium text-gray-600 max-w-sm mx-auto">
                Stronger Community, Better Services
              </p>
            </div>

            {/* Action Buttons (Login & Create Account) */}
            <div className="w-full max-w-sm space-y-3 pt-4">
              {/* 1. Login Primary Solid Button */}
              <button
                onClick={() => setAuthView('login')}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#0c532b] hover:bg-[#083c1f] active:scale-[0.99] text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Login</span>
              </button>

              {/* 2. Create an Account Secondary Button */}
              <button
                onClick={() => setAuthView('register')}
                className="w-full py-3.5 px-6 rounded-2xl bg-white hover:bg-emerald-50/70 active:scale-[0.99] border-2 border-[#0c532b] text-[#0c532b] font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create an Account</span>
              </button>
            </div>
          </div>

          {/* Bottom Highlights & Quality Indicators */}
          <div className="w-full pt-6 border-t border-gray-100 flex flex-wrap items-center justify-center gap-6 text-[11px] sm:text-xs text-gray-500 font-medium">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0c532b]" />
              Official Portal
            </span>
            <span className="flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5 text-[#0c532b]" />
              Direct Verification
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#0c532b]" />
              Citizen Support
            </span>
          </div>

        </div>

      </main>

      {/* Standard Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 px-6 text-center text-xs text-gray-500">
        <div>
          <p className="font-bold text-gray-800 text-xs sm:text-sm">
            Bugo Sync List • Barangay of Bugo
          </p>
          <p className="mt-0.5 text-[11px] text-gray-500">
            City of Cagayan de Oro, Misamis Oriental
          </p>
        </div>
      </footer>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { useApp, AppProvider } from './context/AppContext';
import { WelcomePage } from './components/auth/WelcomePage';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { GuestPortalView } from './components/guest/GuestPortalView';
import { AdminLayout } from './components/admin/AdminLayout';
import { ResidentLayout } from './components/resident/ResidentLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Clock, ShieldAlert } from 'lucide-react';

const SessionTimeoutModal: React.FC = () => {
  const { isSessionTimedOut, dismissSessionTimeout, setAuthView } = useApp();

  if (!isSessionTimedOut) return null;

  const handleSignInAgain = () => {
    dismissSessionTimeout();
    setAuthView('login');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 border border-gray-200 shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <Clock className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-gray-900">Session Locked (Inactivity)</h3>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            For security, your session was automatically locked after 15 minutes of inactivity on this device.
          </p>
        </div>
        <div className="pt-2 flex flex-col gap-2">
          <button
            onClick={handleSignInAgain}
            className="w-full py-2.5 bg-[#0c532b] hover:bg-[#094222] text-white text-xs font-bold rounded-xl transition shadow-xs"
          >
            Sign In Again
          </button>
          <button
            onClick={dismissSessionTimeout}
            className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

const AccountStatusAlertModal: React.FC = () => {
  const { accountStatusAlert, dismissAccountStatusAlert, setAuthView } = useApp();

  if (!accountStatusAlert) return null;

  const handleAcknowledge = () => {
    dismissAccountStatusAlert();
    setAuthView('login');
  };

  return (
    <div className="fixed inset-0 z-[105] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 border border-rose-200 shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-gray-900">Account Access Updated</h3>
          <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
            {accountStatusAlert}
          </p>
        </div>
        <div className="pt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleAcknowledge}
            className="w-full py-2.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
          >
            Return to Sign In
          </button>
          <button
            type="button"
            onClick={dismissAccountStatusAlert}
            className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

const MainContent: React.FC = () => {
  const { role, authView } = useApp();

  return (
    <>

      {/* 1. Unauthenticated / Guest View Flow */}
      {role === 'guest' && (
        <>
          {authView === 'login' && <LoginPage />}
          {authView === 'register' && <RegisterPage />}
          {authView === 'guest' && <GuestPortalView />}
          {authView === 'welcome' && <WelcomePage />}
        </>
      )}

      {/* 2. Admin Operations Portal */}
      {role === 'admin' && <AdminLayout />}

      {/* 3. Resident Operations Portal */}
      {role === 'resident' && <ResidentLayout />}

      {/* Global Modals: Session Security Timeout & Account Access Updates */}
      <SessionTimeoutModal />
      <AccountStatusAlertModal />
    </>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainContent />
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;

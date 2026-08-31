import React, { useState, useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import Home from "./components/Home";
import OrderForm from "./components/OrderForm";
import StaffDashboard from "./components/StaffDashboard";
import { supabase } from "./lib/supabaseClient";

export default function App() {
  const location = useLocation();
  const isStaff = location.pathname.startsWith("/staff");
  const [staffSession, setStaffSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setStaffSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setStaffSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="mp-app">
      {!isStaff && (
        <header className="mp-site-header">
          <Link to="/" className="mp-logo">मु.पो.महाराष्ट्र</Link>
          <nav>
            <Link to="/order" className="mp-nav-order">Order Now</Link>
            {staffSession ? (
              <Link to="/staff" className="mp-nav-staff">Dashboard</Link>
            ) : (
              <Link to="/staff" className="mp-nav-staff">Staff Login</Link>
            )}
          </nav>
        </header>
      )}

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/order" element={<OrderForm />} />
          <Route path="/staff" element={<StaffDashboard />} />
        </Routes>
      </main>
    </div>
  );
}

import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ClientDashboard from "./components/Dashboard/ClientDashboard";
import FreelancerDashboard from "./components/Dashboard/FreelancerDashboard";
import ProtectedRoute from "./components/ProtectedRoute"; // Import ProtectedRoute
import FreelancerProfile from "./pages/FreelancerProfile";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./components/Dashboard/AdminDashboard";
import VerifyOTP from "./pages/VerifyOtp"; // Import the VerifyOTP page

function App() {
  return (
    <>

      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-otp" element={<VerifyOTP />} /> {/* Add this route */}
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute allowedRole="client" />}>
            <Route path="/client-dashboard" element={<ClientDashboard />} />
          </Route>
          <Route element={<ProtectedRoute allowedRole="freelancer" />}>
            <Route path="/freelancer-dashboard" element={<FreelancerDashboard />} />
            <Route path="/freelancer-dashboard/profile" element={<FreelancerProfile />} />
          </Route>
        </Routes>
      </Router>
    </>
  );
}

export default App;
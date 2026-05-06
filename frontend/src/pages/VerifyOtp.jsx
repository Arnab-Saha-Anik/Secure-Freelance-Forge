import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

const VerifyOTP = () => {
  const [formData, setFormData] = useState({ otp: "" });
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

  useEffect(() => {
    document.title = "Freelance Forge - Verify OTP";
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { otp } = formData;

    if (!otp) {
      setErrorMessage("Please provide the OTP.");
      return;
    }

    try {
      const response = await axios.post("http://localhost:5000/users/verify-otp", { email, otp });
      setSuccessMessage(response.data.message);
      setErrorMessage("");
      alert("Account verified successfully! Redirecting to login...");
      navigate("/login");
    } catch (err) {
      console.error(err.response);
      setErrorMessage(err.response?.data?.error || "An error occurred.");
      setSuccessMessage("");
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "linear-gradient(to bottom, #D16BA5, #C777B9, #BA83CA, #AA8FD8, #9A9AE1)",
      }}
    >
      <div
        style={{
          width: "400px",
          padding: "30px",
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          borderRadius: "10px",
          boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
        }}
      >
        <h1 style={{ color: "#593D3D", textAlign: "center" }}>Verify OTP</h1>
        <form onSubmit={handleSubmit} style={{ marginTop: "20px" }}>
          {errorMessage && (
            <p style={{ color: "red", textAlign: "center", marginBottom: "15px" }}>{errorMessage}</p>
          )}
          {successMessage && (
            <p style={{ color: "green", textAlign: "center", marginBottom: "15px" }}>{successMessage}</p>
          )}
          <div className="form-group" style={{ marginBottom: "15px", textAlign: "left" }}>
            <label htmlFor="otp" style={{ color: "#593D3D", display: "block", marginBottom: "5px" }}>
              OTP:
            </label>
            <input
              type="text"
              id="otp"
              name="otp"
              value={formData.otp}
              onChange={handleInputChange}
              required
              style={{
                padding: "10px",
                borderRadius: "5px",
                border: "1px solid #ccc",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: "10px 20px",
              margin: "10px 0",
              backgroundColor: "#1E7E34",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              transition: "background-color 0.3s",
              width: "100%",
              boxSizing: "border-box",
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#28A745")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = "#1E7E34")}
          >
            Verify OTP
          </button>
        </form>
      </div>
    </div>
  );
};

export default VerifyOTP;

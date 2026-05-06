import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const Register = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "default",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Freelance Forge - Register";
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { fullName, email, password, confirmPassword, role } = formData;

    if (!fullName || !email || !password || !confirmPassword) {
      setErrorMessage("Please fill out all fields.");
      return;
    }

    if (role === "default") {
      setErrorMessage("Please select a valid role (Client or Freelancer).");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please try again.");
      return;
    }

    try {
      const emailCheckResponse = await axios.post("http://localhost:5000/users/check-email", { email });

      if (emailCheckResponse.data.exists) {
        setErrorMessage("This email is already registered. Please use a different email.");
        return;
      }

      alert("An OTP has been sent to your email (check spam if you don't find). Please verify to complete registration.");
      navigate("/verify-otp", { state: { email } });

      await axios.post("http://localhost:5000/users/register", {
        name: fullName,
        email,
        password,
        role,
      });
    } catch (err) {
      console.error(err.response);
      setErrorMessage(err.response?.data?.message || "An error occurred.");
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
        <h1 style={{ color: "#593D3D", textAlign: "center" }}>Sign Up</h1>
        <form onSubmit={handleSubmit} style={{ marginTop: "20px" }}>
          {errorMessage && (
            <p style={{ color: "red", textAlign: "center", marginBottom: "15px" }}>
              {errorMessage}
            </p>
          )}
          <div className="form-group" style={{ marginBottom: "15px", textAlign: "left" }}>
            <label htmlFor="fullName" style={{ color: "#593D3D", display: "block", marginBottom: "5px" }}>
              Full Name:
            </label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
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
          <div className="form-group" style={{ marginBottom: "15px", textAlign: "left" }}>
            <label htmlFor="email" style={{ color: "#593D3D", display: "block", marginBottom: "5px" }}>
              Email:
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
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
          <div className="form-group" style={{ marginBottom: "15px", textAlign: "left" }}>
            <label htmlFor="password" style={{ color: "#593D3D", display: "block", marginBottom: "5px" }}>
              Password:
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
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
          <div className="form-group" style={{ marginBottom: "15px", textAlign: "left" }}>
            <label htmlFor="confirmPassword" style={{ color: "#593D3D", display: "block", marginBottom: "5px" }}>
              Confirm Password:
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
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
          <div className="form-group" style={{ marginBottom: "15px", textAlign: "left" }}>
            <label htmlFor="role" style={{ color: "#593D3D", display: "block", marginBottom: "5px" }}>
              Role:
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              required
              style={{
                padding: "10px",
                borderRadius: "5px",
                border: "1px solid #ccc",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <option value="default">Select Role</option>
              <option value="Client">Client</option>
              <option value="Freelancer">Freelancer</option>
            </select>
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
            Sign Up
          </button>
        </form>
        <p style={{ color: "#593D3D", marginTop: "20px", textAlign: "center" }}>
          Already signed up?{" "}
          <span
            style={{
              color: "#007BFF",
              textDecoration: "underline",
              cursor: "pointer",
            }}
            onClick={() => navigate("/login")}
          >
            Login
          </span>
        </p>
      </div>
    </div>
  );
};

export default Register;

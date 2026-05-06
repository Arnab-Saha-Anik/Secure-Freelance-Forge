import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    userType: "default",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Freelance Forge - Login";
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { email, password, role } = formData;

    if (role === "default") {
      setErrorMessage("Please select a user type.");
      return;
    }

    if (!email || !password) {
      setErrorMessage("Please fill out all fields.");
      return;
    }

    try {
      const response = await axios.post("http://localhost:5000/users/login", {
        email,
        password,
        role,
      });

      const backendRole = response.data.role;

      if (backendRole.toLowerCase() !== role.toLowerCase()) {
        setErrorMessage("Selected role does not match your account role.");
        return;
      }

      setSuccessMessage("Login successful!");
      setErrorMessage("");
      localStorage.setItem("token", response.data.token);

      if (backendRole.toLowerCase() === "freelancer") {
        localStorage.setItem("freelancerToken", response.data.token);
        navigate("/freelancer-dashboard");
      } else if (backendRole.toLowerCase() === "client") {
        localStorage.setItem("clientToken", response.data.token);
        navigate("/client-dashboard");
      }
    } catch (err) {
      console.log(err.response);
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
        backgroundImage:
          'url("https://thumbs.dreamstime.com/b/work-frome-home-notebook-smartphone-documents-coffee-stop-virus-epidemic-outbreak-reduce-epidemic-concept-flat-191883560.jpg")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div
        style={{
          width: "400px",
          padding: "30px",
          backgroundColor: "rgba(255, 255, 255, 0.5)",
          borderRadius: "10px",
          boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
          backdropFilter: "blur(10px)",
        }}
      >
        <h1 style={{ color: "#593D3D", textAlign: "center" }}>Login</h1>

        {errorMessage && (
          <p style={{ color: "red", textAlign: "center", marginBottom: "15px" }}>{errorMessage}</p>
        )}
        {successMessage && (
          <p style={{ color: "green", textAlign: "center", marginBottom: "15px" }}>{successMessage}</p>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: "20px" }}>
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
              <option value="client">Client</option>
              <option value="freelancer">Freelancer</option>
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
            Login
          </button>
        </form>
        <p style={{ color: "#593D3D", marginTop: "20px", textAlign: "center" }}>
          Didn't sign up yet?{" "}
          <span
            style={{
              color: "#007BFF",
              textDecoration: "underline",
              cursor: "pointer",
            }}
            onClick={() => navigate("/register")}
          >
            Sign up
          </span>
        </p>
      </div>
    </div>
  );
};

export default Login;

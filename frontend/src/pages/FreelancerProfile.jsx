import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { handleGlobalLogout } from "../utils/logout";

const FreelancerProfile = () => {
  const location = useLocation(); // Get the state passed from the dashboard
  const navigate = useNavigate(); // For navigation

  // Use token from state or fallback to localStorage
  const token = location.state?.token || localStorage.getItem("token");

  const [freelancerInfo, setFreelancerInfo] = useState({
    skills: "",
    portfolio: "",
    experience: "",
  });

  const [userInfo, setUserInfo] = useState({
    name: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showEmailOtpModal, setShowEmailOtpModal] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [newEmailToVerify, setNewEmailToVerify] = useState("");

  const [deleteAccountInfo, setDeleteAccountInfo] = useState({
    email: "",
    currentPassword: "",
  });

  const [originalUserInfo, setOriginalUserInfo] = useState({});
  const [originalFreelancerInfo, setOriginalFreelancerInfo] = useState({});
  const [profileExists, setProfileExists] = useState(false); // Track if the profile exists
  const [loadingProfile, setLoadingProfile] = useState(true); // New state for profile loading
  const [loggedInUserEmail, setLoggedInUserEmail] = useState(""); // State to store the logged-in user's email

  useEffect(() => {
    if (!token) {
      navigate("/login"); // Redirect to login if no token is found
      return;
    }

    const fetchProfileData = async () => {
      setLoadingProfile(true); // Start loading
      try {
        const userId = JSON.parse(atob(token.split(".")[1])).id; // Decode userId from token

        // Fetch profile existence and freelancer/user information in parallel
        const [profileExistenceResponse, freelancerResponse, userResponse] = await Promise.all([
          fetch(`http://localhost:5000/freelancers/check/${userId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`http://localhost:5000/freelancers/${userId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`http://localhost:5000/users/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        // Handle profile existence response
        if (profileExistenceResponse.ok) {
          const profileExistenceData = await profileExistenceResponse.json();
          setProfileExists(profileExistenceData.exists);
        } else {
          setProfileExists(false); // Profile does not exist
        }

        // Handle freelancer information response
        if (freelancerResponse.ok) {
          const freelancerData = await freelancerResponse.json();
          setFreelancerInfo({
            skills: freelancerData.skills.length > 0 ? freelancerData.skills.join(", ") : "",
            portfolio: freelancerData.portfolio || "",
            experience: freelancerData.experience || "",
          });
          setOriginalFreelancerInfo({
            skills: freelancerData.skills.length > 0 ? freelancerData.skills.join(", ") : "",
            portfolio: freelancerData.portfolio || "",
            experience: freelancerData.experience || "",
          });
        }

        // Handle user information response
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUserInfo((prev) => ({
            ...prev,
            name: userData.name || "Not given",
            email: userData.email || "",
          }));
          setOriginalUserInfo({
            name: userData.name || "Not given",
            email: userData.email || "",
          });
          setLoggedInUserEmail(userData.email);
        }
      } catch (err) {
        console.error("Error fetching profile data:", err);
        setProfileExists(false); // Assume profile does not exist on error
      } finally {
        setLoadingProfile(false); // End loading after all data is fetched
      }
    };

    fetchProfileData();
  }, [token, navigate]);

  useEffect(() => {
    console.log("useEffect triggered"); // Debugging log

    if (!token) {
      navigate("/login"); // Redirect to login if no token is found
      return;
    }

    const userId = JSON.parse(atob(token.split(".")[1])).id;

    const checkUserExists = async () => {
      try {
        console.log("Checking if user exists..."); // Debugging log
        const response = await fetch(`http://localhost:5000/users/check/${userId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          handleGlobalLogout(navigate); // Log out after the alert is dismissed
        }
      } catch (err) {
        console.error("Error checking user existence:", err);
        handleGlobalLogout(navigate); // Log out after the alert is dismissed
      }
    };

    const interval = setInterval(checkUserExists, 1000); // Check every 5 seconds

    return () => clearInterval(interval); // Cleanup on component unmount
  }, [token, navigate]);

  useEffect(() => {
    document.title = "Freelance Forge - Freelancer Profile"; // Set the document title
  }, []);

  const handleFreelancerInfoChange = (e) => {
    setFreelancerInfo({ ...freelancerInfo, [e.target.name]: e.target.value });
  };

  const handleUserInfoChange = (e) => {
    setUserInfo({ ...userInfo, [e.target.name]: e.target.value });
  };

  const handleDeleteAccountChange = (e) => {
    setDeleteAccountInfo({ ...deleteAccountInfo, [e.target.name]: e.target.value });
  };

  const handleFreelancerInfoSubmit = async (e) => {
    e.preventDefault();

    // Validation: Ensure all fields are filled
    if (!freelancerInfo.skills.trim() || !freelancerInfo.portfolio.trim() || !freelancerInfo.experience.trim()) {
      alert("All fields are required to update the profile.");
      return;
    }

    try {
      const userId = JSON.parse(atob(token.split(".")[1])).id;

      const response = await fetch(`http://localhost:5000/freelancers/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          skills: freelancerInfo.skills.split(",").map((skill) => skill.trim()),
          portfolio: freelancerInfo.portfolio,
          experience: freelancerInfo.experience,
        }),
      });

      if (response.ok) {
        alert("Freelancer information updated successfully!");
        setOriginalFreelancerInfo(freelancerInfo); // Update original values
      } else {
        alert("Failed to update freelancer information.");
      }
    } catch (err) {
      console.error("Error updating freelancer information:", err);
      alert("An error occurred.");
    }
  };

  const handleCreateFreelancerProfile = async (e) => {
    e.preventDefault();

    // Validation: Ensure all fields are filled
    if (!freelancerInfo.skills.trim() || !freelancerInfo.portfolio.trim() || !freelancerInfo.experience.trim()) {
      alert("All fields are required to create a profile.");
      return;
    }

    try {
      const userId = JSON.parse(atob(token.split(".")[1])).id;

      console.log("Request Data:", {
        userId,
        skills: freelancerInfo.skills.split(",").map((skill) => skill.trim()),
        portfolio: freelancerInfo.portfolio,
        experience: freelancerInfo.experience,
      }); // Log the request data for debugging

      const response = await fetch(`http://localhost:5000/freelancers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          skills: freelancerInfo.skills.split(",").map((skill) => skill.trim()),
          portfolio: freelancerInfo.portfolio,
          experience: freelancerInfo.experience,
        }),
      });

      if (response.ok) {
        alert("Freelancer profile created successfully!");
        setProfileExists(true); // Set profile existence to true
        setOriginalFreelancerInfo(freelancerInfo); // Update original values
      } else {
        const errorData = await response.json();
        console.error("Error Response:", errorData); // Log the error response
        alert(errorData.error || "Failed to create freelancer profile.");
      }
    } catch (err) {
      console.error("Error creating freelancer profile:", err);
      alert("An error occurred while creating the profile.");
    }
  };

  const handleUserInfoSubmit = async (e) => {
    e.preventDefault();

    if (
      userInfo.name === originalUserInfo.name &&
      userInfo.email === originalUserInfo.email &&
      !userInfo.newPassword
    ) {
      alert("No changes detected.");
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/users/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: userInfo.name,
          newEmail: userInfo.email !== originalUserInfo.email ? userInfo.email : undefined,
          currentPassword: userInfo.currentPassword,
          newPassword: userInfo.newPassword,
          confirmPassword: userInfo.confirmPassword,
        }),
      });

      if (response.status === 202) {
        setNewEmailToVerify(userInfo.email);
        setShowEmailOtpModal(true);
      } else if (response.ok) {
        const data = await response.json();
        alert("User information updated successfully!");
        setOriginalUserInfo({ name: data.name, email: userInfo.email });
        setUserInfo((prev) => ({
          ...prev,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        }));
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update user information.");
      }
    } catch (err) {
      console.error("Error updating user information:", err);
      alert("An error occurred.");
    }
  };

  const handleEmailOtpSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`http://localhost:5000/users/verify-email-update-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ otp: emailOtp }),
      });

      if (response.ok) {
        const data = await response.json();
        alert("Email updated successfully!");
        setShowEmailOtpModal(false);
        setEmailOtp("");
        setOriginalUserInfo((prev) => ({ ...prev, email: data.newEmail }));
        setUserInfo((prev) => ({ ...prev, email: data.newEmail, currentPassword: "", newPassword: "", confirmPassword: "" }));
        setLoggedInUserEmail(data.newEmail);
      } else {
        const data = await response.json();
        alert(data.error || "Invalid OTP.");
      }
    } catch (error) {
      console.error("Error verifying email OTP:", error);
      alert("An error occurred during verification.");
    }
  };

  const handleAccountDelete = async (e) => {
    e.preventDefault();

    // Check if the email matches the logged-in user's email
    if (deleteAccountInfo.email !== loggedInUserEmail) {
      alert("The email provided does not match the logged-in user's email.");
      return;
    }

    // Validate email and password
    try {
      const validateResponse = await fetch(`http://localhost:5000/users/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: deleteAccountInfo.email,
          password: deleteAccountInfo.currentPassword,
        }),
      });

      if (!validateResponse.ok) {
        const errorData = await validateResponse.json();
        alert(errorData.error || "Invalid email or password.");
        return;
      }
    } catch (err) {
      console.error("Error validating credentials:", err);
      alert("An error occurred while validating your credentials.");
      return;
    }

    // Show confirmation alert
    const confirmDelete = window.confirm(
      "Are you sure you want to delete your account? All the information will be lost if you delete your account."
    );

    if (!confirmDelete) {
      // If the user cancels, stop the deletion process
      return;
    }

    // Proceed with account deletion
    try {
      const response = await fetch(`http://localhost:5000/users/delete`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: deleteAccountInfo.email,
          password: deleteAccountInfo.currentPassword,
        }),
      });

      if (response.ok) {
        alert("Account deleted successfully. Taking you to the login page!");
        localStorage.removeItem("token"); // Remove the token from localStorage
        navigate("/login"); // Redirect to the login page
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete account.");
      }
    } catch (err) {
      console.error("Error deleting account:", err);
      alert("An error occurred.");
    }
  };

  const isFreelancerInfoChanged = JSON.stringify(freelancerInfo) !== JSON.stringify(originalFreelancerInfo);
  const isUserInfoChanged =
    userInfo.name !== originalUserInfo.name || 
    userInfo.email !== originalUserInfo.email ||
    userInfo.newPassword.trim() !== "";

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      {loadingProfile ? (
        <p style={{ textAlign: "center", fontSize: "18px", color: "#FFD700" }}>
          Loading profile information...
        </p>
      ) : (
        <>
          <h1>Welcome, {userInfo.name}</h1>
          <p style={{ fontSize: "18px", marginBottom: "20px" }}>
            {userInfo.name}, you can update and delete your profile here.
          </p>

          {/* Freelancer Information Form */}
          {profileExists ? (
            <>
              <h2>Update Freelancer Profile</h2>
              <form onSubmit={handleFreelancerInfoSubmit}>
                <div style={{ marginBottom: "10px" }}>
                  <label>
                    Skills (comma-separated): <span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="skills"
                    value={freelancerInfo.skills}
                    onChange={handleFreelancerInfoChange}
                    style={{ width: "100%", padding: "8px", marginTop: "5px" }}
                    placeholder="Enter your skills"
                  />
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <label>
                    Portfolio URL: <span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="portfolio"
                    value={freelancerInfo.portfolio}
                    onChange={handleFreelancerInfoChange}
                    style={{ width: "100%", padding: "8px", marginTop: "5px" }}
                    placeholder="Enter your portfolio URL"
                  />
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <label>
                    Experience: <span style={{ color: "red" }}>*</span>
                  </label>
                  <textarea
                    name="experience"
                    value={freelancerInfo.experience}
                    onChange={handleFreelancerInfoChange}
                    style={{ width: "100%", padding: "8px", marginTop: "5px" }}
                    placeholder="Describe your experience"
                  />
                </div>
                <button
                  type="submit"
                  style={{ padding: "10px 15px" }}
                  disabled={!isFreelancerInfoChanged} 
                >
                  Update Freelancer Information
                </button>
              </form>
            </>
          ) : (
            <>
              <h2>Create Freelancer Profile</h2>
              <form onSubmit={handleCreateFreelancerProfile}>
                <div style={{ marginBottom: "10px" }}>
                  <label>
                    Skills (comma-separated): <span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="skills"
                    value={freelancerInfo.skills}
                    onChange={handleFreelancerInfoChange}
                    style={{ width: "100%", padding: "8px", marginTop: "5px" }}
                    placeholder="Enter your skills"
                  />
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <label>
                    Portfolio URL: <span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="portfolio"
                    value={freelancerInfo.portfolio}
                    onChange={handleFreelancerInfoChange}
                    style={{ width: "100%", padding: "8px", marginTop: "5px" }}
                    placeholder="Enter your portfolio URL"
                  />
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <label>
                    Experience: <span style={{ color: "red" }}>*</span>
                  </label>
                  <textarea
                    name="experience"
                    value={freelancerInfo.experience}
                    onChange={handleFreelancerInfoChange}
                    style={{ width: "100%", padding: "8px", marginTop: "5px" }}
                    placeholder="Describe your experience"
                  />
                </div>
                <button type="submit" style={{ padding: "10px 15px" }}>
                  Create Freelancer Profile
                </button>
              </form>
            </>
          )}
        </>
      )}

      {/* User Information Form */}
      <h2 style={{ marginTop: "30px" }}>Update User Information</h2>
      <form onSubmit={handleUserInfoSubmit}>
        <div style={{ marginBottom: "10px" }}>
          <label>Name:</label>
          <input
            type="text"
            name="name"
            value={userInfo.name}
            onChange={handleUserInfoChange}
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
            placeholder="Enter your name"
          />
        </div>
        <div style={{ marginBottom: "10px" }}>
          <label>Email:</label>
          <input
            type="email"
            name="email"
            value={userInfo.email}
            onChange={handleUserInfoChange}
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
            placeholder="Enter your email"
          />
        </div>
        <div style={{ marginBottom: "10px" }}>
          <label>Current Password:</label>
          <input
            type="password"
            name="currentPassword"
            value={userInfo.currentPassword}
            onChange={handleUserInfoChange}
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
            placeholder="Enter your current password"
            required
          />
        </div>
        <div style={{ marginBottom: "10px" }}>
          <label>New Password:</label>
          <input
            type="password"
            name="newPassword"
            value={userInfo.newPassword}
            onChange={handleUserInfoChange}
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
            placeholder="Enter your new password"
          />
        </div>
        <div style={{ marginBottom: "10px" }}>
          <label>Confirm New Password:</label>
          <input
            type="password"
            name="confirmPassword"
            value={userInfo.confirmPassword}
            onChange={handleUserInfoChange}
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
            placeholder="Confirm your new password"
          />
        </div>
        <button type="submit" style={{ padding: "10px 15px" }} disabled={!isUserInfoChanged}>
          Update User Information
        </button>
      </form>

      {/* Delete Account Form */}
      <h2 style={{ marginTop: "30px", color: "red" }}>Delete Account</h2>
      <form onSubmit={handleAccountDelete}>
        <div style={{ marginBottom: "10px" }}>
          <label>Email:</label>
          <input
            type="email"
            name="email"
            value={deleteAccountInfo.email}
            onChange={handleDeleteAccountChange}
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
            placeholder="Enter your email"
            required
          />
        </div>
        <div style={{ marginBottom: "10px" }}>
          <label>Current Password:</label>
          <input
            type="password"
            name="currentPassword"
            value={deleteAccountInfo.currentPassword}
            onChange={handleDeleteAccountChange}
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
            placeholder="Enter your current password"
            required
          />
        </div>
        <button
          type="submit"
          style={{
            padding: "10px 15px",
            backgroundColor: "red",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Delete Account
        </button>
      </form>

      {showEmailOtpModal && (
        <div style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          backgroundColor: "#fff", padding: "30px", borderRadius: "10px", boxShadow: "0 0 20px rgba(0,0,0,0.3)",
          zIndex: 3000, width: "350px", textAlign: "center", color: "#000"
        }}>
          <h3 style={{ color: "#333", marginBottom: "20px" }}>Verify New Email</h3>
          <p style={{ fontSize: "14px", color: "#666", marginBottom: "20px" }}>
            An OTP has been sent to <strong>{newEmailToVerify}</strong>. Please enter it below to confirm the change.
          </p>
          <form onSubmit={handleEmailOtpSubmit}>
            <input
              type="text"
              placeholder="Enter 6-digit OTP"
              value={emailOtp}
              onChange={(e) => setEmailOtp(e.target.value)}
              style={{
                width: "100%", padding: "12px", marginBottom: "20px",
                borderRadius: "5px", border: "1px solid #ddd", textAlign: "center", fontSize: "18px", letterSpacing: "4px"
              }}
              maxLength="6"
              required
            />
            <div style={{ display: "flex", gap: "10px" }}>
              <button type="submit" style={{
                flex: 1, padding: "10px", backgroundColor: "#28a745", color: "#fff",
                border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold"
              }}>Verify</button>
              <button type="button" onClick={() => { setShowEmailOtpModal(false); setEmailOtp(""); }} style={{
                flex: 1, padding: "10px", backgroundColor: "#dc3545", color: "#fff",
                border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold"
              }}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default FreelancerProfile;
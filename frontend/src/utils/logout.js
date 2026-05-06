// utils/logout.js
export const handleGlobalLogout = (navigate) => {
    localStorage.removeItem("token"); // Remove the token from localStorage
    navigate("/login"); // Redirect to the login page
  };
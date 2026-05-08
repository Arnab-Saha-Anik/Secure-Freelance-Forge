
const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; 
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); 
    req.user = decoded; 
    next(); 
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

const isAdmin = async (req, res, next) => {
  const User = require("../models/userModel");
  const { rsaDecrypt } = require("../utils/cryptoUtils");

  try {
    const user = await User.findById(req.user.id);
    if (!user || rsaDecrypt(user.role).toLowerCase() !== "admin") {
      return res.status(403).json({ error: "Access denied. Admins only." });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: "Server error during admin check." });
  }
};

module.exports = { verifyToken, isAdmin };
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [learningMaterials, setLearningMaterials] = useState([]);
  const [projects, setProjects] = useState([]);
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [newMaterial, setNewMaterial] = useState({ title: "", description: "", link: "" });
  const [newAdmin, setNewAdmin] = useState({ name: "", email: "", password: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState({ status: "Loading...", encryption: "...", integrity: "..." });
  const [showEmailOtpModal, setShowEmailOtpModal] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const api = useMemo(() => axios.create({
    baseURL: "http://localhost:5000/admin",
    headers: { Authorization: `Bearer ${token}` }
  }), [token]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [profileRes, healthRes] = await Promise.all([
          api.get("/me"),
          api.get("/health")
        ]);
        setProfile(profileRes.data);
        setHealthStatus(healthRes.data);
        setIsLoading(false);
      } catch (err) {
        console.error("Auth error:", err);
        navigate("/admin-login");
      }
    };

    if (!token) {
      navigate("/admin-login");
    } else {
      fetchInitialData();
    }
  }, [token, navigate, api]); // Added api as dependency

  const fetchUsers = async () => {
    try {
      const res = await api.get("/users");
      setUsers(res.data);
    } catch (err) {
      alert("Error fetching users");
    }
  };

  const fetchActivities = async () => {
    try {
      const res = await api.get("/activities");
      setActivities(res.data);
    } catch (err) {
      alert("Error fetching activities");
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await api.get("/projects");
      setProjects(res.data);
    } catch (err) {
      alert("Error fetching projects");
    }
  };

  const handleDeleteProject = async (id) => {
    if (window.confirm("Delete this project?")) {
      try {
        await api.delete(`/projects/${id}`);
        fetchProjects();
      } catch (err) {
        alert("Error deleting project");
      }
    }
  };

  const fetchLearningMaterials = async () => {
    try {
      const res = await axios.get("http://localhost:5000/learning-materials");
      setLearningMaterials(res.data);
    } catch (err) {
      alert("Error fetching materials");
    }
  };

  const handleVerifyEmailOtp = async (e) => {
    e.preventDefault();
    try {
      await api.post("/verify-email-otp", { otp: emailOtp });
      alert("Email updated successfully");
      setShowEmailOtpModal(false);
      setEmailOtp("");
      setProfile({ ...profile, newPassword: "", currentPassword: "" });
      // Refresh profile data
      const res = await api.get("/me");
      setProfile(res.data);
    } catch (err) {
      alert(err.response?.data?.error || "Invalid OTP");
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await api.put(`/users/role/${userId}`, { role: newRole });
      alert("Role updated successfully");
      fetchUsers();
    } catch (err) {
      alert("Error updating role");
    }
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    try {
      await api.post("/users/add-admin", newAdmin);
      alert("Admin added successfully");
      setNewAdmin({ name: "", email: "", password: "" });
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || "Error adding admin");
    }
  };

  const handleRotateKeys = async () => {
    if (window.confirm("WARNING: Rotating keys will affect how new data is encrypted. Older data will remain compatible via versioning. Proceed?")) {
      try {
        const res = await api.post("/rotate-keys");
        alert(res.data.message);
        // Refresh health status to show new key counts
        const healthRes = await api.get("/health");
        setHealthStatus(healthRes.data);
      } catch (err) {
        alert("Error rotating keys");
      }
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put("/me", {
        name: profile.name,
        email: profile.email,
        newPassword: profile.newPassword,
        currentPassword: profile.currentPassword
      });

      if (res.status === 202) {
        alert(res.data.message);
        setShowEmailOtpModal(true);
      } else {
        alert("Profile updated successfully");
        setProfile({ ...profile, newPassword: "", currentPassword: "" }); // Reset sensitive fields
      }
    } catch (err) {
      alert(err.response?.data?.error || "Error updating profile");
    }
  };

  const handleSaveMaterial = async (e) => {
    e.preventDefault();
    try {
        if (editingMaterial) {
            await axios.put(`http://localhost:5000/learning-materials/${editingMaterial._id}`, editingMaterial, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEditingMaterial(null);
        } else {
            await axios.post("http://localhost:5000/learning-materials", newMaterial, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNewMaterial({ title: "", description: "", link: "" });
        }
        fetchLearningMaterials();
        alert("Material saved successfully");
    } catch (err) {
        alert("Error saving material");
    }
  };

  const handleDeleteUser = async (id) => {
      if (window.confirm("Delete this user?")) {
          try {
              await api.delete(`/users/${id}`);
              fetchUsers();
          } catch (err) {
              alert("Error deleting user");
          }
      }
  };

  if (isLoading) return <div style={{ color: "white", textAlign: "center", marginTop: "100px" }}>Loading Secure Environment...</div>;

  return (
    <div style={styles.container}>
      <aside style={styles.sidebar}>
        <h2 style={styles.logo}>FF Admin</h2>
        <nav style={styles.nav}>
          <button onClick={() => setActiveTab("overview")} style={activeTab === "overview" ? styles.activeNavLink : styles.navLink}>Overview</button>
          <button onClick={() => { setActiveTab("users"); fetchUsers(); }} style={activeTab === "users" ? styles.activeNavLink : styles.navLink}>Users</button>
          <button onClick={() => { setActiveTab("projects"); fetchProjects(); }} style={activeTab === "projects" ? styles.activeNavLink : styles.navLink}>Projects</button>
          <button onClick={() => { setActiveTab("materials"); fetchLearningMaterials(); }} style={activeTab === "materials" ? styles.activeNavLink : styles.navLink}>Learning Materials</button>
          <button onClick={() => { setActiveTab("audit"); fetchActivities(); }} style={activeTab === "audit" ? styles.activeNavLink : styles.navLink}>Audit Logs</button>
          <button onClick={() => setActiveTab("security")} style={activeTab === "security" ? styles.activeNavLink : styles.navLink}>Security</button>
          <button onClick={() => setActiveTab("profile")} style={activeTab === "profile" ? styles.activeNavLink : styles.navLink}>My Profile</button>
        </nav>
        <button onClick={() => { localStorage.clear(); navigate("/admin-login"); }} style={styles.logoutBtn}>Logout</button>
      </aside>

      <main style={styles.main}>
        <header style={styles.header}>
          <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
          <div style={styles.adminBadge}>Primary Admin: {profile.name}</div>
        </header>

        <section style={styles.content}>
          {activeTab === "overview" && (
            <div style={styles.statsGrid}>
              <div style={styles.statCard}><h3>Encryption</h3><p>{healthStatus.encryption}</p></div>
              <div style={styles.statCard}><h3>Integrity</h3><p>{healthStatus.integrity}</p></div>
              <div style={styles.statCard}>
                <h3>Key Status</h3>
                <p style={{ color: healthStatus.status === "Healthy" ? "#4ade80" : "#fb7185" }}>
                  {healthStatus.status}
                </p>
              </div>
            </div>
          )}

          {activeTab === "users" && (
            <div>
              <div style={styles.card}>
                <h3>Add New Administrator</h3>
                <form onSubmit={handleAddAdmin} style={styles.rowForm}>
                  <input placeholder="Name" value={newAdmin.name} onChange={e => setNewAdmin({...newAdmin, name: e.target.value})} required style={styles.input}/>
                  <input placeholder="Email" value={newAdmin.email} onChange={e => setNewAdmin({...newAdmin, email: e.target.value})} required style={styles.input}/>
                  <input placeholder="Password" type="password" value={newAdmin.password} onChange={e => setNewAdmin({...newAdmin, password: e.target.value})} required style={styles.input}/>
                  <button type="submit" style={styles.btnPrimary}>Add Admin</button>
                </form>
              </div>

              <div style={styles.card}>
                <h3>System Users</h3>
                <table style={styles.table}>
                  <thead>
                    <tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u._id}>
                        <td>{u.name}</td>
                        <td>{u.email}</td>
                        <td>
                          <select value={u.role} onChange={e => handleUpdateRole(u._id, e.target.value)} style={styles.select}>
                            <option value="client">Client</option>
                            <option value="freelancer">Freelancer</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td><button onClick={() => handleDeleteUser(u._id)} style={styles.btnDanger}>Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "projects" && (
            <div style={styles.card}>
              <h3>All Platform Projects</h3>
              <table style={styles.table}>
                <thead>
                  <tr><th>Title</th><th>Description</th><th>Budget</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {projects.map(p => (
                    <tr key={p._id}>
                      <td>{p.title}</td>
                      <td>{p.description}</td>
                      <td>${p.budget}</td>
                      <td>{p.status}</td>
                      <td><button onClick={() => handleDeleteProject(p._id)} style={styles.btnDanger}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "materials" && (
            <div>
              <div style={styles.card}>
                <h3>{editingMaterial ? "Edit Material" : "Add Learning Material"}</h3>
                <form onSubmit={handleSaveMaterial} style={styles.columnForm}>
                  <input placeholder="Title" value={editingMaterial ? editingMaterial.title : newMaterial.title} onChange={e => editingMaterial ? setEditingMaterial({...editingMaterial, title: e.target.value}) : setNewMaterial({...newMaterial, title: e.target.value})} required style={styles.input}/>
                  <textarea placeholder="Description" value={editingMaterial ? editingMaterial.description : newMaterial.description} onChange={e => editingMaterial ? setEditingMaterial({...editingMaterial, description: e.target.value}) : setNewMaterial({...newMaterial, description: e.target.value})} required style={styles.textarea}/>
                  <input placeholder="URL Link" value={editingMaterial ? editingMaterial.link : newMaterial.link} onChange={e => editingMaterial ? setEditingMaterial({...editingMaterial, link: e.target.value}) : setNewMaterial({...newMaterial, link: e.target.value})} required style={styles.input}/>
                  <div style={styles.rowForm}>
                    <button type="submit" style={styles.btnPrimary}>{editingMaterial ? "Update" : "Create"}</button>
                    {editingMaterial && <button onClick={() => setEditingMaterial(null)} style={styles.btnSecondary}>Cancel</button>}
                  </div>
                </form>
              </div>

              <div style={styles.materialsList}>
                {learningMaterials.map(m => (
                  <div key={m._id} style={styles.materialItem}>
                    <h4>{m.title}</h4>
                    <p>{m.description}</p>
                    <div style={styles.rowForm}>
                      <button onClick={() => setEditingMaterial(m)} style={styles.btnSecondary}>Edit</button>
                      <button onClick={async () => { if(window.confirm("Delete?")) { await axios.delete(`http://localhost:5000/learning-materials/${m._id}`, { headers: { Authorization: `Bearer ${token}` } }); fetchLearningMaterials(); } }} style={styles.btnDanger}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "audit" && (
            <div style={styles.card}>
              <h3>Audit Trails (Encrypted at Rest)</h3>
              <table style={styles.table}>
                <thead>
                  <tr><th>Timestamp</th><th>Email</th><th>User ID</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {activities.map((a, i) => (
                    <tr key={i}>
                      <td>{new Date(a.timestamp).toLocaleString()}</td>
                      <td style={{ color: "#38bdf8" }}>{a.userEmail}</td>
                      <td style={styles.smallText}>{a.userId}</td>
                      <td>{a.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "security" && (
            <div style={styles.card}>
              <h3>Cryptographic Infrastructure</h3>
              <p>Current Algorithm: RSA / ECC (Elliptic Curve Cryptography)</p>
              <div style={styles.securityWarning}>
                <strong>Warning:</strong> Rotating keys creates a new version for all future encryptions. All previous data remains decryptable via the versioned key archive.
              </div>
              <button onClick={handleRotateKeys} style={styles.btnWarning}>Rotate Keys (v{activities.length > 0 ? "..." : "Next"})</button>
            </div>
          )}

          {activeTab === "profile" && (
            <div style={styles.card}>
              <h3>Update My Credentials</h3>
              <form onSubmit={handleUpdateProfile} style={styles.columnForm}>
                <label style={styles.label}>Full Name</label>
                <input value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} style={styles.input}/>
                
                <label style={styles.label}>Email Address</label>
                <input value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} style={styles.input}/>
                
                <label style={styles.label}>New Password (Optional)</label>
                <input type="password" value={profile.newPassword || ""} onChange={e => setProfile({...profile, newPassword: e.target.value})} placeholder="Leave blank to keep current" style={styles.input}/>
                
                <hr style={{ border: "0", borderTop: "1px solid #334155", margin: "20px 0" }} />
                
                <label style={{ ...styles.label, color: "#f87171" }}>Current Password (Required to Save)</label>
                <input type="password" value={profile.currentPassword || ""} onChange={e => setProfile({...profile, currentPassword: e.target.value})} placeholder="Verify your identity" required style={{ ...styles.input, borderColor: "#ef4444" }}/>
                
                <button type="submit" style={styles.btnPrimary}>Save Changes</button>
              </form>
            </div>
          )}
        </section>
      </main>

      {/* Email Change OTP Modal */}
      {showEmailOtpModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3>Verify New Email</h3>
            <p>An OTP has been sent to your new email address. Please enter it below to confirm the change.</p>
            <form onSubmit={handleVerifyEmailOtp} style={styles.columnForm}>
              <input 
                type="text" 
                placeholder="6-digit OTP" 
                value={emailOtp} 
                onChange={e => setEmailOtp(e.target.value)} 
                required 
                style={{ ...styles.input, textAlign: "center", fontSize: "24px", letterSpacing: "5px" }}
              />
              <div style={styles.rowForm}>
                <button type="submit" style={styles.btnPrimary}>Verify & Save</button>
                <button type="button" onClick={() => setShowEmailOtpModal(false)} style={styles.btnSecondary}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { display: "flex", height: "100vh", backgroundColor: "#0f172a", color: "#f8fafc", fontFamily: "'Inter', sans-serif" },
  sidebar: { width: "260px", backgroundColor: "#1e293b", padding: "20px", display: "flex", flexDirection: "column", borderRight: "1px solid #334155" },
  logo: { fontSize: "24px", fontWeight: "bold", marginBottom: "40px", color: "#38bdf8" },
  nav: { flex: 1, display: "flex", flexDirection: "column", gap: "10px" },
  navLink: { background: "none", border: "none", color: "#94a3b8", textAlign: "left", padding: "12px 15px", cursor: "pointer", borderRadius: "8px", fontSize: "16px", transition: "all 0.2s" },
  activeNavLink: { background: "#334155", border: "none", color: "#f8fafc", textAlign: "left", padding: "12px 15px", cursor: "pointer", borderRadius: "8px", fontSize: "16px", fontWeight: "600" },
  logoutBtn: { padding: "12px", backgroundColor: "#ef4444", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", marginTop: "20px" },
  main: { flex: 1, overflowY: "auto", padding: "40px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", borderBottom: "1px solid #334155", paddingBottom: "20px" },
  adminBadge: { backgroundColor: "#0ea5e9", padding: "5px 12px", borderRadius: "20px", fontSize: "14px" },
  content: { display: "flex", flexDirection: "column", gap: "30px" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" },
  statCard: { backgroundColor: "#1e293b", padding: "20px", borderRadius: "12px", border: "1px solid #334155" },
  card: { backgroundColor: "#1e293b", padding: "25px", borderRadius: "12px", border: "1px solid #334155" },
  table: { width: "100%", borderCollapse: "collapse", marginTop: "20px" },
  input: { padding: "10px", borderRadius: "6px", border: "1px solid #334155", backgroundColor: "#0f172a", color: "white", marginBottom: "10px" },
  textarea: { padding: "10px", borderRadius: "6px", border: "1px solid #334155", backgroundColor: "#0f172a", color: "white", marginBottom: "10px", minHeight: "100px" },
  btnPrimary: { padding: "10px 20px", backgroundColor: "#0ea5e9", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" },
  btnSecondary: { padding: "10px 20px", backgroundColor: "#475569", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" },
  btnDanger: { padding: "8px 15px", backgroundColor: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" },
  btnWarning: { padding: "15px 30px", backgroundColor: "#f59e0b", color: "black", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" },
  select: { padding: "5px", borderRadius: "4px", backgroundColor: "#0f172a", color: "white", border: "1px solid #334155" },
  rowForm: { display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" },
  columnForm: { display: "flex", flexDirection: "column", gap: "10px" },
  materialItem: { backgroundColor: "#334155", padding: "15px", borderRadius: "8px", marginBottom: "15px" },
  smallText: { fontSize: "10px", opacity: 0.7, maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis" },
  securityWarning: { padding: "15px", backgroundColor: "rgba(245, 158, 11, 0.1)", border: "1px solid #f59e0b", borderRadius: "8px", marginBottom: "20px", color: "#f59e0b" },
  label: { fontSize: "14px", color: "#94a3b8", marginBottom: "5px" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modalContent: { backgroundColor: "#1e293b", padding: "40px", borderRadius: "16px", border: "1px solid #334155", maxWidth: "450px", textAlign: "center" }
};

export default AdminDashboard;
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [learningMaterials, setLearningMaterials] = useState([]);
  const [newMaterial, setNewMaterial] = useState({ title: "", description: "", link: "" });
  const [showAddMaterialForm, setShowAddMaterialForm] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [showLearningMaterials, setShowLearningMaterials] = useState(false); // Toggle learning materials
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const alertShown = useRef(false);

  useEffect(() => {
    if (!token) {
      if (!alertShown.current) {
        alert("Unauthorized access. Please log in as an admin.");
        alertShown.current = true;
      }
      navigate("/admin-login");
    } else {
      setIsLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    document.title = "Freelance Forge - Admin Dashboard";
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    alert("You have been logged out.");
    navigate("/admin-login");
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await fetch("http://localhost:5000/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.map(({ _id, name, email, role }) => ({ _id, name, email, role })));
      } else {
        const errorData = await response.json();
        console.error("Error fetching users:", errorData);
        alert(errorData.message || "Failed to fetch users.");
      }
    } catch (err) {
      console.error("Error fetching users:", err);
      alert("An error occurred while fetching users.");
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const response = await fetch("http://localhost:5000/projects", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setProjects(
          data.map(({ _id, title, description, budget, deadline, client }) => ({
            _id,
            title,
            description,
            budget,
            deadline,
            clientEmail: client?.email || "N/A", // Include client's email
          }))
        );
      } else {
        alert("Failed to fetch projects.");
      }
    } catch (err) {
      console.error("Error fetching projects:", err);
      alert("An error occurred while fetching projects.");
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    console.log("Deleting user with ID:", userId);

    if (!userId) {
      console.error("User ID is undefined.");
      alert("Failed to delete user. Invalid user ID.");
      return;
    }

    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        const response = await fetch(`http://localhost:5000/users/admin/${userId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        console.log("Response status:", response.status);
        if (response.ok) {
          const data = await response.json();
          console.log("Response data:", data);
          alert(data.message || "User deleted successfully.");
          setUsers(users.filter((user) => user._id !== userId));
        } else {
          const errorData = await response.json();
          console.error("Error response data:", errorData);
          alert(errorData.message || "Failed to delete user.");
        }
      } catch (err) {
        console.error("Error deleting user:", err);
        alert("An error occurred while deleting the user.");
      }
    }
  };

  const handleDeleteProject = async (projectId) => {
    console.log("Deleting project with ID:", projectId);

    if (!projectId) {
      console.error("Project ID is undefined.");
      alert("Failed to delete project. Invalid project ID.");
      return;
    }

    if (window.confirm("Are you sure you want to delete this project?")) {
      try {
        const response = await fetch(`http://localhost:5000/projects/admin/${projectId}`, {
          method: "DELETE",
        });
        if (response.ok) {
          alert("Project deleted successfully.");
          setProjects(projects.filter((project) => project._id !== projectId));
        } else {
          const errorData = await response.json();
          console.error("Error deleting project:", errorData);
          alert(errorData.message || "Failed to delete project.");
        }
      } catch (err) {
        console.error("Error deleting project:", err);
        alert("An error occurred while deleting the project.");
      }
    }
  };

  const fetchLearningMaterials = async () => {
    try {
      const response = await fetch("http://localhost:5000/learning-materials", {
        headers: {
          Authorization: `Bearer ${token}`, // Pass the token in the Authorization header
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLearningMaterials(data); // Update the state with fetched materials
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to fetch learning materials.");
      }
    } catch (err) {
      console.error("Error fetching learning materials:", err);
      alert("An error occurred while fetching learning materials.");
    }
  };

  const handleAddMaterial = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("http://localhost:5000/learning-materials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // Pass the token in the Authorization header
        },
        body: JSON.stringify(newMaterial),
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message || "Learning material added successfully.");
        setNewMaterial({ title: "", description: "", link: "" }); // Reset form
        setShowAddMaterialForm(false); // Hide form
        fetchLearningMaterials(); // Refresh the list
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to add learning material.");
      }
    } catch (err) {
      console.error("Error adding learning material:", err);
      alert("An error occurred while adding the learning material.");
    }
  };

  const handleDeleteMaterial = async (materialId) => {
    if (window.confirm("Are you sure you want to delete this learning material?")) {
      try {
        const response = await fetch(`http://localhost:5000/learning-materials/${materialId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          alert("Learning material deleted successfully.");
          setLearningMaterials(learningMaterials.filter((material) => material._id !== materialId));
        } else {
          const errorData = await response.json();
          alert(errorData.error || "Failed to delete learning material.");
        }
      } catch (err) {
        console.error("Error deleting learning material:", err);
        alert("An error occurred while deleting the learning material.");
      }
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto", textAlign: "center", position: "relative" }}>
      {/* Logout Button */}
      <button
        onClick={handleLogout}
        style={{position: "absolute",top: "20px",right: "20px",padding: "10px 20px",backgroundColor: "#DC3545",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",fontSize: "16px",

        }}
      >
        Logout
      </button>

      <h2 style={{ marginBottom: "50px", fontSize: "28px" }}>Admin Dashboard</h2>

      {/* Add New Learning Materials Button */}
      <button
        onClick={() => setShowAddMaterialForm(!showAddMaterialForm)}
        style={{padding: "15px 30px",backgroundColor: "#FFC107",color: "#000000",border: "none",borderRadius: "5px",cursor: "pointer",fontSize: "18px", marginBottom: "20px",

        }}
      >
        {showAddMaterialForm ? "Close Form" : "Add New Learning Materials"}
      </button>

      {/* Add Learning Material Form */}
      {showAddMaterialForm && (
        <form onSubmit={handleAddMaterial} style={{ marginBottom: "20px" }}>
          <input
            type="text"
            placeholder="Title"
            value={newMaterial.title}
            onChange={(e) => setNewMaterial({ ...newMaterial, title: e.target.value })}
            required
            style={{ padding: "10px", marginBottom: "10px", width: "100%" }}
          />
          <textarea
            placeholder="Description"
            value={newMaterial.description}
            onChange={(e) => setNewMaterial({ ...newMaterial, description: e.target.value })}
            required
            style={{ padding: "10px", marginBottom: "10px", width: "100%" }}
          />
          <input
            type="url"
            placeholder="Link"
            value={newMaterial.link}
            onChange={(e) => setNewMaterial({ ...newMaterial, link: e.target.value })}
            required
            style={{ padding: "10px", marginBottom: "10px", width: "100%" }}
          />
          <button
            type="submit"
            style={{padding: "10px 20px",backgroundColor: "#28A745",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",fontSize: "16px",
            }}
          >
            Submit
          </button>
        </form>
      )}

      {/* Fetch Users and Fetch Projects Buttons */}
      <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginBottom: "40px" }}>
        <button
          onClick={() => {
            setShowUsers(!showUsers);
            if (!showUsers && users.length === 0) fetchUsers();
          }}
          style={{padding: "15px 30px",backgroundColor: "#007BFF",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",fontSize: "18px",
          }}
        >
          {loadingUsers ? "Loading Users..." : `Fetch Users ${showUsers ? "▲" : "▼"}`}
        </button>

        <button
          onClick={() => {
            setShowProjects(!showProjects);
            if (!showProjects && projects.length === 0) fetchProjects();
          }}
          style={{padding: "15px 30px",backgroundColor: "#28A745",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",fontSize: "18px",
          }}
        >
          {loadingProjects ? "Loading Projects..." : `Fetch Projects ${showProjects ? "▲" : "▼"}`}
        </button>

        {/* Fetch Learning Materials Button */}
        <button
          onClick={() => {
            setShowLearningMaterials(!showLearningMaterials);
            if (!showLearningMaterials && learningMaterials.length === 0) fetchLearningMaterials();
          }}
          style={{padding: "15px 30px",backgroundColor: "#17A2B8",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",fontSize: "18px",
          }}
        >
          {showLearningMaterials ? "Hide Learning Materials ▲" : "Fetch Learning Materials ▼"}
        </button>
      </div>

      {/* Users Table */}
      {showUsers && users.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <h3 style={{ fontSize: "24px", marginBottom: "20px" }}>All Users</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10px" }}>
            <thead>
              <tr>
                <th style={{ borderBottom: "1px solid #ddd", padding: "10px", fontSize: "16px" }}>Name</th>
                <th style={{ borderBottom: "1px solid #ddd", padding: "10px", fontSize: "16px" }}>Email</th>
                <th style={{ borderBottom: "1px solid #ddd", padding: "10px", fontSize: "16px" }}>Role</th>
                <th style={{ borderBottom: "1px solid #ddd", padding: "10px", fontSize: "16px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr key={index}>
                  <td style={{ borderBottom: "1px solid #ddd", padding: "10px", fontSize: "14px" }}>{user.name}</td>
                  <td style={{ borderBottom: "1px solid #ddd", padding: "10px", fontSize: "14px" }}>{user.email}</td>
                  <td style={{ borderBottom: "1px solid #ddd", padding: "10px", fontSize: "14px" }}>{user.role}</td>
                  <td style={{ borderBottom: "1px solid #ddd", padding: "10px", fontSize: "14px" }}>
                    <button
                      onClick={() => handleDeleteUser(user._id)}
                      style={{padding: "5px 10px",backgroundColor: "#DC3545",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",fontSize: "14px",

                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Projects Table */}
      {showProjects && projects.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <h3 style={{ fontSize: "24px", marginBottom: "20px" }}>All Projects</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10px" }}>
            <thead>
              <tr>
                <th style={{ borderBottom: "1px solid #ddd", padding: "10px", fontSize: "16px" }}>Title</th>
                <th style={{ borderBottom: "1px solid #ddd", padding: "10px", fontSize: "16px" }}>Description</th>
                <th style={{ borderBottom: "1px solid #ddd", padding: "10px", fontSize: "16px" }}>Budget</th>
                <th style={{ borderBottom: "1px solid #ddd", padding: "10px", fontSize: "16px" }}>Deadline</th>
                <th style={{ borderBottom: "1px solid #ddd", padding: "10px", fontSize: "16px" }}>Client Email</th>
                <th style={{ borderBottom: "1px solid #ddd", padding: "10px", fontSize: "16px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project, index) => (
                <tr key={index}>
                  <td style={{ borderBottom: "1px solid #ddd", padding: "10px", fontSize: "14px" }}>{project.title}</td>
                  <td style={{ borderBottom: "1px solid #ddd", padding: "10px", fontSize: "14px" }}>{project.description}</td>
                  <td style={{ borderBottom: "1px solid #ddd", padding: "10px", fontSize: "14px" }}>${project.budget}</td>
                  <td style={{ borderBottom: "1px solid #ddd", padding: "10px", fontSize: "14px" }}>
                    {new Date(project.deadline).toLocaleDateString()}
                  </td>
                  <td style={{ borderBottom: "1px solid #ddd", padding: "10px", fontSize: "14px" }}>{project.clientEmail}</td>
                  <td style={{ borderBottom: "1px solid #ddd", padding: "10px", fontSize: "14px" }}>
                    <button
                      onClick={() => handleDeleteProject(project._id)}
                      style={{padding: "5px 10px",backgroundColor: "#DC3545",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",fontSize: "14px",
                        

                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Learning Materials Table */}
      {showLearningMaterials && learningMaterials.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <h3 style={{ fontSize: "24px", marginBottom: "20px" }}>Learning Materials</h3>
          <ul style={{ listStyleType: "none", padding: 0 }}>
            {learningMaterials.map((material) => (
              <li
                key={material._id}
                style={{marginBottom: "20px",padding: "15px",backgroundColor: "#f9f9f9",borderRadius: "5px",boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",}}

              >
                <h4>{material.title}</h4>
                <p>{material.description}</p>
                <a href={material.link} target="_blank" rel="noopener noreferrer">
                  Visit
                </a>
                <div style={{ marginTop: "10px" }}>
                  <button
                    onClick={() => handleDeleteMaterial(material._id)}
                    style={{padding: "10px 20px",backgroundColor: "#DC3545",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",fontSize: "14px",

                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
export default AdminDashboard;
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const HomePage = () => {
  const navigate = useNavigate();
  const [featuredProjects, setFeaturedProjects] = useState([]);
  const [showProjects, setShowProjects] = useState(false); 

  useEffect(() => {
    document.title = "Freelance Forge";

    
    const fetchFeaturedProjects = async () => {
      try {
        const response = await fetch("http://localhost:5000/projects/featured");
        if (response.ok) {
          const data = await response.json();
          setFeaturedProjects(data);
        } else {
          console.error("Failed to fetch featured projects");
        }
      } catch (error) {
        console.error("Error fetching featured projects:", error);
      }
    };

    fetchFeaturedProjects();
  }, []);

  return (
    <div
      style={{
        display: "flex", 
        flexDirection: "column", 
        justifyContent: "center", 
        alignItems: "center", 
        textAlign: "center",
        padding: "20px",
        backgroundImage:
          'url("https://img.freepik.com/free-vector/call-center-agent-concept_23-2147939653.jpg?t=st=1743675998~exp=1743679598~hmac=eb1814a83ed06fd9232524a84dc64e8859824c2fe47ee7dffe7adf2d77b7b59a&w=826")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        minHeight: "100vh", 
      }}
    >
      <h1 style={{ color: "#000000", fontSize: "3rem", fontWeight: "bold" }}>
        Welcome to the Freelance Forge
      </h1>
      <p style={{ color: "#000000", fontSize: "1.5rem", marginTop: "10px" }}>
        Learn more, develop more!
      </p>
      <div style={{ marginTop: "30px" }}>
        <button
          style={{
            padding: "15px 30px",
            margin: "15px",
            backgroundColor: "#ADFF2F",
            color: "#000",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            fontSize: "1.2rem",
            fontWeight: "bold",
            transition: "background-color 0.3s",
          }}
          onClick={() => navigate("/register")}
        >
          Register
        </button>
        <button
          style={{
            padding: "15px 30px",
            margin: "15px",
            backgroundColor: "#ADFF2F",
            color: "#000",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            fontSize: "1.2rem",
            fontWeight: "bold",
            transition: "background-color 0.3s",
          }}
          onClick={() => navigate("/login")}
        >
          Login
        </button>
      </div>

      <div style={{ marginTop: "50px" }}>
        <button
          style={{
            padding: "15px 30px",
            backgroundColor: "#007BFF",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            fontSize: "1.2rem",
            fontWeight: "bold",
            transition: "background-color 0.3s",
          }}
          onClick={() => setShowProjects(!showProjects)} 
        >
          {showProjects ? "Hide Featured Projects" : "See Our Featured Projects Here"}
        </button>

        {showProjects && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "20px",
              marginTop: "30px",
            }}
          >
            {featuredProjects.length > 0 ? (
              featuredProjects.map((project) => (
                <div
                  key={project._id}
                  style={{
                    width: "350px",
                    padding: "20px",
                    backgroundColor: "#FFFFFF",
                    borderRadius: "10px",
                    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
                    textAlign: "center", 
                    margin: "0 auto", 
                  }}
                >
                  <h3 style={{ color: "#000000", fontSize: "1.5rem", fontWeight: "bold" }}>
                    {project.title}
                  </h3>
                  <p style={{ color: "#555555", fontSize: "1.2rem" }}>{project.description}</p>
                  <p style={{ color: "#000000", fontWeight: "bold", fontSize: "1.2rem" }}>
                    Budget: ${project.budget}
                  </p>
                  <p style={{ color: "#000000", fontSize: "1.2rem" }}>
                    Deadline: {new Date(project.deadline).toLocaleDateString()}
                  </p>
                </div>
              ))
            ) : (
              <p style={{ color: "#000000", fontSize: "1.5rem" }}>
                No featured projects available.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
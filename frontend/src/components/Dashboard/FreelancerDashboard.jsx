import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { handleGlobalLogout } from "../../utils/logout";

const styles = {
  container: { backgroundColor: "#593D3D", color: "#FFFFFF", minHeight: "100vh", padding: "20px", fontFamily: "Arial, sans-serif" },
  header: { textAlign: "center", marginBottom: "20px" },
  dropdownButton: { backgroundColor: "#007BFF", color: "#FFFFFF", border: "none", padding: "10px 20px", borderRadius: "5px", cursor: "pointer", fontSize: "18px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "5px", transition: "background-color 0.3s ease" },
  dropdownMenu: { position: "absolute", top: "100%", right: "0", backgroundColor: "#444444", color: "#FFFFFF", borderRadius: "10px", boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)", padding: "15px", minWidth: "250px" },
  dropdownItem: { backgroundColor: "transparent", border: "none", color: "#FFD700", textDecoration: "underline", cursor: "pointer", fontSize: "18px", fontWeight: "bold", padding: 0, display: "block", textAlign: "left", width: "100%" },
  notificationButton: { backgroundColor: "#007BFF", color: "#FFFFFF", border: "none", padding: "10px 20px", borderRadius: "5px", cursor: "pointer", fontSize: "18px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "5px", transition: "background-color 0.3s ease" },
  notificationDropdown: { position: "absolute", top: "50px", right: "0", backgroundColor: "#FFFFFF", border: "1px solid #ddd", borderRadius: "5px", padding: "10px", width: "300px", zIndex: 1000 },
  learningMaterialsContainer: { marginBottom: "20px", padding: "20px", backgroundColor: "#444444", borderRadius: "10px", boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)" },
  learningMaterialsButton: { display: "block", margin: "0 auto", padding: "10px 20px", backgroundColor: "#007BFF", color: "#FFFFFF", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "16px", fontWeight: "bold", transition: "background-color 0.3s" },
  inputField: { padding: "10px", width: "100%", borderRadius: "5px", border: "1px solid #ccc", boxSizing: "border-box" },
  projectContainer: { marginTop: "40px", padding: "20px", backgroundColor: "#444444", borderRadius: "10px", color: "#FFFFFF", boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)" },
  projectItem: { marginBottom: "20px", padding: "15px", backgroundColor: "#333333", borderRadius: "10px", boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)" },
  bidButton: { padding: "10px 20px", backgroundColor: "#007BFF", color: "#FFFFFF", border: "none", borderRadius: "5px", cursor: "pointer" },
  rejectButton: { padding: "10px 20px", backgroundColor: "#DC3545", color: "#FFFFFF", border: "none", borderRadius: "5px", cursor: "pointer" },
  acceptButton: { padding: "10px 20px", backgroundColor: "#28A745", color: "#FFFFFF", border: "none", borderRadius: "5px", cursor: "pointer" },
};

const FreelancerDashboard = () => {
  const [showBidModal, setShowBidModal] = useState(false); 
  const [selectedProject, setSelectedProject] = useState(null); 
  const [bidAmount, setBidAmount] = useState(""); 
  const [showLearningMaterials, setShowLearningMaterials] = useState(false); 
  const [projects, setProjects] = useState([]); 
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState(null); 
  const [freelancerData, setFreelancerData] = useState({
    earnings: 0,
    reviews: 0,
    projectsCompleted: 0,
  }); 
  const [userName, setUserName] = useState("Loading..."); 
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileExists, setProfileExists] = useState(false); 
  const [loadingProfile, setLoadingProfile] = useState(true); 
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHireOffers, setShowHireOffers] = useState(false);
  const [hireOffers, setHireOffers] = useState([]);
  const [myBids, setMyBids] = useState({}); // Store bids for all projects
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [showSelectedBids, setShowSelectedBids] = useState(false);
  const [selectedBids, setSelectedBids] = useState([]); // Add state for selected bids
  const [showActivityHistory, setShowActivityHistory] = useState(false); // Add state for activity history
  const [activityLogs, setActivityLogs] = useState([]); // Add state for activity logs
  const [learningSearchQuery, setLearningSearchQuery] = useState("");
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [learningMaterials, setLearningMaterials] = useState([]); // State for learning materials
  const [filteredLearningMaterials, setFilteredLearningMaterials] = useState([]); // State for filtered materials
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedProjectForReview, setSelectedProjectForReview] = useState(null);
  const [reviewData, setReviewData] = useState({ rating: 5, comment: "" });
  const [hasReviewed, setHasReviewed] = useState({});
  const [projectReviews, setProjectReviews] = useState({});
  const [showMyReviews, setShowMyReviews] = useState(false);
  const [myReviews, setMyReviews] = useState([]);
  const [clientReviews, setClientReviews] = useState({});
  const [clientAvgRatings, setClientAvgRatings] = useState({});
  const [clientReviewCounts, setClientReviewCounts] = useState({});
  const [showClientReviews, setShowClientReviews] = useState(false);
  const [selectedClientReviews, setSelectedClientReviews] = useState([]);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [selectedClientAvgRating, setSelectedClientAvgRating] = useState(0);
  const navigate = useNavigate(); 
 
  const token = localStorage.getItem("freelancerToken");
  const userId = token ? JSON.parse(atob(token.split(".")[1])).id : null; 

  // Then initialize the state

  useEffect(() => {
    document.title = "Freelance Forge - Freelancer Dashboard";

    if (!token) {
      console.error("No token found");
      setUserName("Error fetching name");
      navigate("/login"); 
      return;
    }

    const fetchUserInfo = async () => {
      try {
        const response = await fetch("http://localhost:5000/users/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUserName(data.name); 
        } else {
          console.error("Failed to fetch user info");
          setUserName("Error fetching name");
        }
      } catch (err) {
        console.error("Error fetching user info:", err);
        setUserName("Error fetching name");
      }
    };

    fetchUserInfo(); 
  }, [navigate, userId, token]);

  useEffect(() => {
    const fetchProfileExistence = async () => {
      setLoadingProfile(true); 
      try {
        const userId = JSON.parse(atob(token.split(".")[1])).id; 
        
        const response = await fetch(`http://localhost:5000/freelancers/check/${userId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setProfileExists(data.exists); 
        } else {
          setProfileExists(false); 
        }
      } catch (err) {
        console.error("Error checking profile existence:", err);
        setProfileExists(false); 
      } finally {
        setLoadingProfile(false); 
      }
    };

    fetchProfileExistence();
  }, [token]);

  const fetchFreelancerStats = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:5000/freelancers/stats/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setFreelancerData({
          earnings: data.earnings || 0,
          reviews: data.reviews || 0,
          projectsCompleted: data.projectsCompleted || 0,
        });
      } else {
        console.error("Failed to fetch freelancer stats");
        setFreelancerData({
          earnings: 0,
          reviews: 0,
          projectsCompleted: 0,
        });
      }
    } catch (err) {
      console.error("Error fetching freelancer stats:", err);
      setFreelancerData({
        earnings: 0,
        reviews: 0,
        projectsCompleted: 0,
      });
    }
  }, [userId, token]); // Include dependencies: userId and token

  useEffect(() => {
    if (profileExists && userId) {
      fetchFreelancerStats();
    }
  }, [profileExists, userId, fetchFreelancerStats]); // Include fetchFreelancerStats here

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:5000/notifications", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      } else {
        console.error("Failed to fetch notifications.");
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }, [token]);

  const fetchHireOffers = async () => {
    try {
      const response = await fetch("http://localhost:5000/direct-hire/freelancer", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHireOffers(data);
      } else {
        console.error("Failed to fetch hire offers.");
      }
    } catch (error) {
      console.error("Error fetching hire offers:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const checkUserExists = useCallback(async () => {
    try {
      console.log("Checking if user exists..."); 
      const response = await fetch(`http://localhost:5000/users/check/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("Response status:", response.status); 
      if (!response.ok) {
        console.log("User does not exist. Triggering logout."); 
        setTimeout(() => {
          handleGlobalLogout(navigate); 
        }, 0);
      } else {
        console.log("User exists. No action needed."); 
      }
    } catch (err) {
      console.error("Error checking user existence:", err);
      
      setTimeout(() => {
        handleGlobalLogout(navigate); 
      }, 0);
    }
  }, [userId, token, navigate]);

  useEffect(() => {
    console.log("useEffect triggered"); 

    if (!token) {
      navigate("/login"); 
      return;
    }

    const interval = setInterval(checkUserExists, 1000);

    return () => clearInterval(interval); 
  }, [token, navigate, checkUserExists]);

  const handleLogout = () => {
    localStorage.removeItem("token"); 
    navigate("/login"); 
  };

  const handleBidSubmit = async (e) => {
    e.preventDefault();
  
    if (!token) {
      setPopupMessage("No token found. Please log in again.");
      setShowPopup(true);
      return;
    }
  
    if (!profileExists) {
      setPopupMessage("You have to create your freelancer profile to submit the bid.");
      setShowPopup(true);
      return;
    }
  
    // Check if bid amount exceeds project budget
    if (parseFloat(bidAmount) > selectedProject.budget) {
      setPopupMessage(`Your bid amount (${bidAmount}) exceeds the project budget ($${selectedProject.budget}). Please enter a lower bid.`);
      setShowPopup(true);
      return;
    }
  
    try {
      const url = myBids[selectedProject._id]
        ? `http://localhost:5000/bids/${myBids[selectedProject._id]._id}` // Update existing bid
        : `http://localhost:5000/bids/${selectedProject._id}/bid`; // Create new bid
  
      const method = myBids[selectedProject._id] ? "PUT" : "POST"; // Determine method
  
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bidAmount }),
      });
  
      if (response.ok) {
        const data = await response.json();
        alert(
          myBids[selectedProject._id]
            ? `Your bid has been updated to $${bidAmount} for "${selectedProject.title}"`
            : `Your bid of $${bidAmount} has been submitted for "${selectedProject.title}"`
        );
  
        // Update the myBids state
        setMyBids((prevBids) => ({
          ...prevBids,
          [selectedProject._id]: data.bid,
        }));
  
        setShowBidModal(false); // Close the modal
        setBidAmount(""); // Reset the bid amount
      } else {
        const data = await response.json();
        alert(data.error || "Failed to submit/update bid. Please try again.");
      }
    } catch (err) {
      console.error("Error submitting/updating bid:", err);
      alert("An error occurred while submitting/updating your bid.");
    }
  };
  

  const handleDeleteNotification = async (notificationId) => {
    try {
      const response = await fetch(`http://localhost:5000/notifications/${notificationId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setNotifications(notifications.filter((n) => n._id !== notificationId));
      } else {
        console.error("Failed to delete notification.");
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const handleAcceptOffer = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/direct-hire/accept/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert("Congratulations! Start working on this project and maintain the deadline!");
        fetchProjects(); // Refresh the projects list
        fetchHireOffers(); // Refresh the list of pending offers
      } else {
        const data = await response.json();
        alert(data.error || "Failed to accept the project.");
      }
    } catch (error) {
      console.error("Error accepting project:", error);
      alert("An error occurred while accepting the project.");
    }
  };

  const handleRejectOffer = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/direct-hire/reject/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert("Project rejected successfully.");
        window.location.reload(); // Reload the page
      } else {
        const data = await response.json();
        alert(data.error || "Failed to reject the project.");
      }
    } catch (error) {
      console.error("Error rejecting project:", error);
      alert("An error occurred while rejecting the project.");
    }
  };

  const fetchMyBid = useCallback(async (projectId) => {
    try {
      const response = await fetch(`http://localhost:5000/bids/${projectId}/my-bid`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data; // Return the bid data
      } else {
        return null; // No bid found
      }
    } catch (error) {
      console.error("Error fetching bid:", error);
      return null;
    }
  }, [token]); // Add 'token' as a dependency

  useEffect(() => {
    const fetchAllBids = async () => {
      const bids = {};
      for (const project of projects) {
        const bid = await fetchMyBid(project._id);
        bids[project._id] = bid;
      }
      setMyBids(bids);
    };

    if (projects.length > 0) {
      fetchAllBids();
    }
  }, [projects, fetchMyBid]); // Include 'fetchMyBid' in the dependency array

  const handleAcceptBid = async (bidId) => {
    try {
      const response = await fetch(`http://localhost:5000/bids/accept/${bidId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      if (response.ok) {
        alert("Bid accepted successfully! Now, work on this project maintaining the deadline.");
        window.location.reload(); // Reload the page
      } else {
        const data = await response.json();
        alert(data.error || "Failed to accept bid.");
      }
    } catch (error) {
      console.error("Error accepting bid:", error);
      alert("An error occurred while accepting the bid.");
    }
  };
  
  const handleRejectBid = async (bidId) => {
    try {
      const response = await fetch(`http://localhost:5000/bids/reject/${bidId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      if (response.ok) {
        alert("Bid rejected successfully.");
        window.location.reload(); // Reload the page
      } else {
        const data = await response.json();
        alert(data.error || "Failed to reject bid.");
      }
    } catch (error) {
      console.error("Error rejecting bid:", error);
      alert("An error occurred while rejecting the bid.");
    }
  };


  const fetchSelectedBids = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:5000/bids/selected", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedBids(data);
      } else {
        console.error("Failed to fetch selected bids.");
      }
    } catch (error) {
      console.error("Error fetching selected bids:", error);
    }
  }, [token]);

  useEffect(() => {
    fetchSelectedBids();
  }, [fetchSelectedBids]);

  const fetchActivityLogs = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:5000/activities", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setActivityLogs(data);
      } else {
        console.error("Failed to fetch activity logs.");
      }
    } catch (error) {
      console.error("Error fetching activity logs:", error);
    }
  }, [token]);

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:5000/projects", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch projects");
      }

      const data = await response.json();

      // Filter projects based on the freelancer's ID
      const acceptedProjects = data.filter(
        (project) => project.status === "accepted" && project.acceptedFreelancer === userId
      );
      const otherProjects = data.filter(
        (project) => project.status !== "accepted"
      );

      // Combine accepted projects on top and other projects below
      setProjects([...acceptedProjects, ...otherProjects]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, userId]); // Add token and userId as dependencies

  const fetchMyReviews = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:5000/reviews/received/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMyReviews(data);
      } else {
        console.error("Failed to fetch reviews");
      }
    } catch (error) {
      console.error("Error fetching reviews:", error);
    }
  }, [userId, token]);

  const fetchClientReviewData = useCallback(async (clientId) => {
    if (!clientId) return null;
    
    try {
      // Get reviews for this client
      const reviewsResponse = await fetch(`http://localhost:5000/reviews/received/${clientId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (reviewsResponse.ok) {
        const reviewsData = await reviewsResponse.json();
        
        // Calculate average rating
        let avgRating = 0;
        if (reviewsData.length > 0) {
          const totalRating = reviewsData.reduce((sum, review) => sum + review.rating, 0);
          avgRating = (totalRating / reviewsData.length).toFixed(1);
        }
        
        // Store the data
        setClientReviews(prev => ({ ...prev, [clientId]: reviewsData }));
        setClientAvgRatings(prev => ({ ...prev, [clientId]: avgRating }));
        setClientReviewCounts(prev => ({ ...prev, [clientId]: reviewsData.length }));
        
        return {
          reviews: reviewsData,
          avgRating,
          count: reviewsData.length
        };
      }
    } catch (error) {
      console.error("Error fetching client review data:", error);
    }
    
    return null;
  }, [token]);

  // Modify the projects useEffect to fetch client reviews
  useEffect(() => {
    const fetchAllData = async () => {
      await fetchProjects();
      
      // After projects are loaded, fetch client review data
      if (projects.length > 0) {
        for (const project of projects) {
          if (project.client && typeof project.client === 'object' && project.client._id) {
            await fetchClientReviewData(project.client._id);
          }
        }
      }
    };
    
    fetchAllData();
  }, [fetchProjects, fetchClientReviewData, projects]);

  const updateCompletionPercentage = async (projectId, percentage) => {
    try {
      const response = await fetch(`http://localhost:5000/projects/update-completion/${projectId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ completedpercentage: percentage }),
      });
  
      if (response.ok) {
        alert("Project completion percentage updated successfully.");
        
        // Update both the projects and filteredProjects arrays
        const updatedProjects = projects.map(project => 
          project._id === projectId ? { ...project, completedpercentage: parseInt(percentage) } : project
        );
        setProjects(updatedProjects);
        
        if (projectSearchQuery) {
          const updatedFilteredProjects = filteredProjects.map(project => 
            project._id === projectId ? { ...project, completedpercentage: parseInt(percentage) } : project
          );
          setFilteredProjects(updatedFilteredProjects);
        }
        
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update project completion percentage.");
      }
    } catch (error) {
      console.error("Error updating project completion percentage:", error);
      alert("An error occurred while updating the project completion percentage.");
    }
  };
  
  const handleSubmitCompletionUrl = async (projectId, url) => {
    try {
      const response = await fetch(`http://localhost:5000/projects/submit-completion/${projectId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("freelancerToken")}`,
        },
        body: JSON.stringify({ completionUrl: url }),
      });
  
      if (response.ok) {
        alert("Project completion URL submitted successfully!");
        
        // Update both the projects and filteredProjects arrays
        const updatedProjects = projects.map(project => 
          project._id === projectId ? { ...project, completionUrl: url } : project
        );
        setProjects(updatedProjects);
        
        if (projectSearchQuery) {
          const updatedFilteredProjects = filteredProjects.map(project => 
            project._id === projectId ? { ...project, completionUrl: url } : project
          );
          setFilteredProjects(updatedFilteredProjects);
        }
        
      } else {
        const data = await response.json();
        alert(data.error || "Failed to submit project completion URL.");
      }
    } catch (error) {
      console.error("Error submitting project completion URL:", error);
      alert("An error occurred while submitting the project completion URL.");
    }
  };

  const handleSearchLearningMaterials = (query) => {
    setLearningSearchQuery(query);
  
    const filtered = learningMaterials.filter(
      (material) =>
        material.title.toLowerCase().includes(query.toLowerCase()) ||
        material.description.toLowerCase().includes(query.toLowerCase())
    );
  
    setFilteredLearningMaterials(filtered);
  };

  const handleSearchProjects = (query) => {
    setProjectSearchQuery(query);
  
    if (!query.trim()) {
      setFilteredProjects(projects);
      return;
    }
  
    const queryLower = query.toLowerCase().trim();
  
    // Apply filtering to projects array directly
    const filtered = projects.filter((project) => {
      // Skip any null/undefined projects
      if (!project) return false;
      
      // Get client ID
      let clientId = null;
      if (project.client) {
        clientId = typeof project.client === 'object' ? project.client._id : project.client;
      }
      
      // Get client rating as string for text search
      let ratingString = "0";
      if (clientId && clientAvgRatings[clientId]) {
        ratingString = clientAvgRatings[clientId].toString();
      }
      
      // Get client email and name, with null checks
      const clientEmail = project.client?.email ? project.client.email.toLowerCase() : "";
      
      // Format deadline as string, with null check
      const deadlineString = project.deadline ? new Date(project.deadline).toLocaleDateString().toLowerCase() : "";
      
      // Add null checks for each property
      const titleMatch = project.title ? project.title.toLowerCase().includes(queryLower) : false;
      const descMatch = project.description ? project.description.toLowerCase().includes(queryLower) : false;
      const budgetMatch = project.budget ? project.budget.toString().includes(queryLower) : false;
      
      // Check if any field contains the search query
      return (
        titleMatch || 
        descMatch ||
        budgetMatch ||
        deadlineString.includes(queryLower) ||
        clientEmail.includes(queryLower) ||
        ratingString.includes(queryLower)
      );
    });
    
    // Update filtered projects state
    setFilteredProjects(filtered);
    console.log("Search results:", filtered.length, "projects found");
  };

  const fetchLearningMaterials = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:5000/learning-materials", {
        headers: {
          Authorization: `Bearer ${token}`, // Pass the token if required
        },
      });
  
      if (response.ok) {
        const data = await response.json();
        setLearningMaterials(data); // Update the state with fetched materials
        setFilteredLearningMaterials(data); // Initialize filtered materials
      } else {
        console.error("Failed to fetch learning materials.");
      }
    } catch (err) {
      console.error("Error fetching learning materials:", err);
    }
  }, [token]); // Add 'token' as a dependency
  
  // Fetch learning materials when the component loads
  useEffect(() => {
    fetchLearningMaterials();
  }, [fetchLearningMaterials]); // Add fetchLearningMaterials to the dependency array

  const checkReviewStatus = useCallback(async (projectId) => {
    try {
      const response = await fetch(`http://localhost:5000/reviews/check/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setHasReviewed(prev => ({ ...prev, [projectId]: data.hasReviewed }));
      
      // Fetch existing reviews for this project
      const reviewsResponse = await fetch(`http://localhost:5000/reviews/project/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const reviewsData = await reviewsResponse.json();
      setProjectReviews(prev => ({ ...prev, [projectId]: reviewsData }));
    } catch (error) {
      console.error("Error checking review status:", error);
    }
  }, [token]);

  useEffect(() => {
    const fetchReviewStatuses = async () => {
      const approvedProjects = projects.filter(p => p.approvalStatus === "Approved");
      for (const project of approvedProjects) {
        await checkReviewStatus(project._id);
      }
    };
    
    if (projects.length > 0) {
      fetchReviewStatuses();
    }
  }, [projects, checkReviewStatus]);

  const handleOpenReviewModal = (project) => {
    console.log("Project data for review:", project); // Debug log
    setSelectedProjectForReview(project);
    setShowReviewModal(true);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedProjectForReview) return;
    
    // Make sure client is a string ID
    const clientId = typeof selectedProjectForReview.client === 'object' 
      ? selectedProjectForReview.client._id 
      : selectedProjectForReview.client;

    console.log("Submitting review with: ", {
      projectId: selectedProjectForReview._id,
      receiverId: clientId,
      myId: userId
    });

    try {
      const response = await fetch("http://localhost:5000/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId: selectedProjectForReview._id,
          receiverId: clientId, // Use the properly formatted ID
          rating: parseInt(reviewData.rating),
          comment: reviewData.comment
        }),
      });
      
      if (response.ok) {
        setPopupMessage("Review submitted successfully");
        setShowPopup(true);
        setShowReviewModal(false);
        setSelectedProjectForReview(null);
        setReviewData({ rating: 5, comment: "" });
        
        // Update review status
        await checkReviewStatus(selectedProjectForReview._id);
      } else {
        const data = await response.json();
        setPopupMessage(data.error || "Failed to submit review");
        setShowPopup(true);
      }
    } catch (error) {
      console.error("Error submitting review:", error);
      setPopupMessage("Error submitting review");
      setShowPopup(true);
    }
  };

  const handleViewClientReviews = (clientId, clientName) => {
    if (!clientId) return;
    
    const clientReviewsData = clientReviews[clientId] || [];
    setSelectedClientReviews(clientReviewsData);
    setSelectedClientName(clientName || "Client");
    setSelectedClientAvgRating(clientAvgRatings[clientId] || 0);
    setShowClientReviews(true);
  };

  return (
    <div style={styles.container}>
      {/* Display the user's name */}
      
      <h1 style={styles.header}>Welcome, {userName}</h1>
      {loadingProfile ? (
        <p style={{ textAlign: "center", fontSize: "18px", color: "#FFD700" }}>
          Checking profile existence...
        </p>
      ) : !profileExists ? (
        <p style={{ textAlign: "center", color: "red", fontSize: "18px" }}>
          Please create your profile by clicking <strong>Profile Settings</strong> under <strong>My Account</strong> to work on projects.
        </p>
      ) : null}

      {/* My Account Dropdown */}
      <div
        style={{position: "absolute", top: "20px", right: "20px",
        }}
      >
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          style={styles.dropdownButton}
          onMouseEnter={(e) => (e.target.style.backgroundColor = "#0056b3")}
          onMouseLeave={(e) => (e.target.style.backgroundColor = "#007BFF")}
        >
          My Account {dropdownOpen ? "▲" : "▼"}
        </button>

        {dropdownOpen && (
          <div style={styles.dropdownMenu}>
            <ul style={{ listStyleType: "none", margin: 0, padding: 0 }}>
              <li style={{ marginBottom: "10px" }}>
                <span style={{ color: "#FFD700", fontWeight: "bold" }}>Earnings:</span> $
                {profileExists ? freelancerData.earnings : 0}
              </li>
              <li style={{ marginBottom: "10px" }}>
                <span style={{ color: "#FFD700", fontWeight: "bold" }}>Reviews:</span>{" "}
                {profileExists ? freelancerData.reviews : 0}/5
              </li>
              <li style={{ marginBottom: "10px" }}>
                <span style={{ color: "#FFD700", fontWeight: "bold" }}>Projects Completed:</span>{" "}
                {profileExists ? freelancerData.projectsCompleted : 0}
              </li>
              <li style={{ marginTop: "20px", borderTop: "1px solid #FFD700", paddingTop: "10px" }}>
                <button
                  onClick={() => navigate("/freelancer-dashboard/profile", { state: { token } })}
                  style={styles.dropdownItem}
                >
                  Profile Settings
                </button>
              </li>
              <li style={{ marginTop: "10px" }}>
                <button
                  onClick={() => {
                    setShowHireOffers(!showHireOffers);
                    if (!showHireOffers) fetchHireOffers();
                  }}
                  style={styles.dropdownItem}
                >
                  Hire Offers
                </button>
              </li>
              <li style={{ marginTop: "10px" }}>
                <button
                  onClick={() => {
                    setShowSelectedBids(!showSelectedBids);
                    if (!showSelectedBids) fetchSelectedBids(); // Fetch selected bids when toggling
                  }}
                  style={styles.dropdownItem}
                >
                  Bids Selected
                </button>
              </li>
              <li style={{ marginTop: "10px" }}>
                <button
                  onClick={() => {
                    setShowActivityHistory(!showActivityHistory);
                    if (!showActivityHistory) fetchActivityLogs(); // Fetch activity logs when toggling
                  }}
                  style={styles.dropdownItem}
                >
                  Activity History
                </button>
              </li>
              <li style={{ marginTop: "10px" }}>
                <button
                  onClick={() => {
                    setShowMyReviews(!showMyReviews);
                    if (!showMyReviews) fetchMyReviews();
                  }}
                  style={styles.dropdownItem}
                >
                  My Reviews
                </button>
              </li>
              <li style={{ marginTop: "10px" }}>
                <button
                  onClick={handleLogout}
                  style={{backgroundColor: "transparent", border: "none", color: "#FF0000", textDecoration: "underline", cursor: "pointer", fontSize: "18px", fontWeight: "bold", padding: 0, display: "block", textAlign: "left", width: "100%",
                  }}
                >
                  Logout
                </button>
              </li>
              
            </ul>
          </div>
        )}
      </div>

      {/* Notifications Section */}
      <div
        style={{position: "absolute", top: "20px", right: "200px", display: "flex", gap: "10px",
        }}
      >
        {/* Notification Button */}
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          style={styles.notificationButton}
          onMouseEnter={(e) => (e.target.style.backgroundColor = "#0056b3")}
          onMouseLeave={(e) => (e.target.style.backgroundColor = "#007BFF")}
        >
          Notifications {showNotifications ? "▲" : "▼"}
        </button>

        {/* Notifications Dropdown */}
        {showNotifications && (
          <div style={styles.notificationDropdown}>
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <div
                  key={notification._id}
                  style={{padding: "10px", borderBottom: "1px solid #ddd", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#000000",
                  }}
                >
                  <p style={{ margin: 0 }}>{notification.message}</p>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => handleDeleteNotification(notification._id)}
                      style={{backgroundColor: "#DC3545", color: "#FFFFFF", border: "none", borderRadius: "5px", cursor: "pointer", padding: "5px 10px", fontSize: "12px",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ textAlign: "center", color: "#555" }}>
                No notifications available.
              </p>
            )}
          </div>
        )}
      </div>
      
      {/* The rest of the code remains unchanged */}
      {/* Learning Materials Section */}
      {/* Projects Section */}
      {/* Bid Modal */}

      {/* Learning Materials Section */}
      <div style={styles.learningMaterialsContainer}>
        <h2 style={{ textAlign: "center", marginBottom: "10px" }}>Want to Learn Something New?</h2>
        <button
          onClick={() => setShowLearningMaterials(!showLearningMaterials)}
          style={styles.learningMaterialsButton}
          onMouseEnter={(e) => (e.target.style.backgroundColor = "#0056b3")}
          onMouseLeave={(e) => (e.target.style.backgroundColor = "#007BFF")}
        >
          {showLearningMaterials ? (
            <>
              Close Learning Materials <span style={{ fontSize: "1.2rem" }}>↑</span>
            </>
          ) : (
            <>
              Click Here to Learn <span style={{ fontSize: "1.2rem" }}>↓</span>
            </>
          )}
        </button>
        {showLearningMaterials && (
          <ul
            style={{marginTop: "20px", listStyleType: "none", padding: 0, fontSize: "16px", color: "#FFFFFF",
            }}
          >
            <div style={{ marginBottom: "20px" }}>
              <input
                type="text"
                placeholder="Search learning materials"
                value={learningSearchQuery}
                onChange={(e) => handleSearchLearningMaterials(e.target.value)}
                style={styles.inputField}
              />
            </div>
            {filteredLearningMaterials.length > 0 ? (
    filteredLearningMaterials.map((material) => (
      <li
        key={material._id}
        style={{marginBottom: "20px", padding: "15px", backgroundColor: "#333333", borderRadius: "10px", boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
        }}
      >
        <h3 style={{ marginBottom: "10px", color: "#FFD700" }}>{material.title}</h3>
        <p style={{ marginBottom: "10px" }}>{material.description}</p>
        <a
          href={material.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#007BFF", textDecoration: "none" }}
        >
          Visit
        </a>
      </li>
    ))
  ) : (
    <p style={{ textAlign: "center", color: "#FFD700" }}>No learning materials found.</p>
  )}
          </ul>
        )}
      </div>
      {/* Projects Section */}
      <div style={styles.projectContainer}>
        <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Available Projects</h2>
        
        <div style={{ marginBottom: "20px" }}>
          <input
            type="text"
            placeholder="Search projects using title, budget, deadline, client's email or client's average rating"
            value={projectSearchQuery}
            onChange={(e) => handleSearchProjects(e.target.value)}
            style={styles.inputField}
          />
        </div>
      
        {loading ? (
          <p style={{ textAlign: "center" }}>Loading projects...</p>
        ) : error ? (
          <p style={{ textAlign: "center", color: "red" }}>{error}</p>
         ) : (projectSearchQuery ? filteredProjects : projects).length === 0 ? (
          <p style={{ textAlign: "center" }}>No projects available.</p>
        ) : (
          <ul style={{ listStyleType: "none", padding: 0, fontSize: "18px" }}>
            {(projectSearchQuery ? filteredProjects : projects).map((project) => {
      const myBid = myBids[project._id]; // Get the bid for this project
      

  return (
    <li
      key={project._id}
      style={styles.projectItem}
    >
      <h3 style={{ marginBottom: "10px", color: "#FFD700" }}>Title: {project.title}</h3>
      <p style={{ marginBottom: "10px" }}>Description: {project.description}</p>
      <p style={{ marginBottom: "10px", fontWeight: "bold" }}>Budget: ${project.budget}</p>
      <p style={{ marginBottom: "10px" }}>
        Deadline: {new Date(project.deadline).toLocaleDateString()}
      </p>
      <p style={{ marginBottom: "10px" }}>
        Client Email: {project.client?.email || "N/A"}
      </p>
      {/* Add client rating display */}
      <p style={{ marginBottom: "10px" }}>
        Client's Average Rating: {
          project.client && clientAvgRatings[project.client._id] > 0 ? (
            <span>
              <span style={{ color: "#FFD700" }}>{"★".repeat(Math.round(clientAvgRatings[project.client._id]))}</span>
              <span style={{ color: "#C0C0C0" }}>{"☆".repeat(5 - Math.round(clientAvgRatings[project.client._id]))}</span>
              <span style={{ marginLeft: "5px" }}>{clientAvgRatings[project.client._id]}/5</span>
            </span>
          ) : "No ratings yet"
        }
      </p>

      {/* Add View Reviews button */}
      <button
        onClick={() => handleViewClientReviews(
          project.client?._id, 
          project.client?.name || project.client?.email || "Client"
        )}
        style={{
          padding: "10px 15px",
          backgroundColor: "#007BFF",
          color: "#FFFFFF",
          border: "none", 
          borderRadius: "5px",
          cursor: "pointer",
          fontWeight: "bold",
          marginBottom: "10px",
          display: "block",
          margin: "0 auto 10px"
        }}
      >
        View Reviews {project.client && clientReviewCounts[project.client._id] > 0 ? 
          `(${clientReviewCounts[project.client._id]})` : ""}
      </button>
      {project.approvalStatus === "Rejected" ? (
  <div>
    <p style={{ color: "#DC3545", fontWeight: "bold" }}>Approval Rejected</p>
    <p style={{ color: "#FFD700" }}>
      <strong>Rejection Comment:</strong> {project.rejectionComment || "No comment provided"}
    </p>
    <p style={{ fontWeight: "bold", color: "#FFD700" }}>
      Current Completion: {project.completedpercentage || 0}%
    </p>

    {/* Button to update completion percentage */}
    <button
      onClick={() => {
        const percentage = prompt(
          `Enter the updated project completion percentage (0-100):`,
          project.completedpercentage || 0
        );
        if (percentage !== null) {
          updateCompletionPercentage(project._id, percentage);
        }
      }}
      style={{
        padding: "10px",
        backgroundColor: "#007BFF",
        color: "#FFFFFF",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer",
        marginTop: "10px",
        marginRight: "10px", // Add spacing below this button
      }}
    >
      Update Completion Percentage
    </button>

    {/* Show URL update button if completion percentage is 100% */}
    {project.completedpercentage === 100 && (
      <button
        onClick={() => {
          const url = prompt("Enter the URL of the completed project:");
          if (url) {
            handleSubmitCompletionUrl(project._id, url);
          }
        }}
        style={{
          padding: "10px",
          backgroundColor: "#28A745",
          color: "#FFFFFF",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          marginTop: "10px", // Add spacing above this button
        }}
      >
        Share the URL of the Completed Project
      </button>
    )}
  </div>
) : project.status === "accepted" ? (
        project.acceptedFreelancer === userId ? (
          <>
            <span
              style={{
                padding: "10px 20px",
                backgroundColor: "#28A745",
                color: "#FFFFFF",
                borderRadius: "5px",
                fontWeight: "bold",
                display: "inline-block",
                textAlign: "center",
                marginRight: "10px",
              }}
            >
              Accepted
            </span>
            <p style={{ marginBottom: "10px", fontWeight: "bold", color: "#FFD700" }}>
              Current Completion: {project.completedpercentage || 0}%
            </p>
            {project.completedpercentage === 100 && !project.completionUrl && (
              <button
                onClick={() => {
                  const url = prompt("Enter the URL of the completed project:");
                  if (url) {
                    handleSubmitCompletionUrl(project._id, url);
                  }
                }}
                style={{
                  padding: "10px",
                  backgroundColor: "#28A745",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                  marginRight: "10px",
                }}
              >
                Share the URL of the Completed Project
              </button>
            )}

            {project.completionUrl && project.approvalStatus === "Pending" && (
              <p style={{ color: "#FFC107", fontWeight: "bold" }}>Waiting for Client's Approval</p>
            )}

            {project.approvalStatus === "Approved" ? (
              <div>
                <p style={{ color: "#28A745", fontWeight: "bold" }}>Project Approved</p>
                <p
                  style={{
                    marginTop: "10px",
                    marginBottom: "10px",
                    color: "#007BFF",
                    fontWeight: "bold",
                  }}
                >
                  Project URL:{" "}
                  <a
                    href={project.completionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#007BFF", textDecoration: "underline" }}
                  >
                    {project.completionUrl}
                  </a>
                </p>
                <p style={{ fontWeight: "bold", color: "#FFD700" }}>
                  Accepted Money: ${project.acceptedmoney || 0}
                </p>
                {project.escrowStatus === "Released" ? (
                  <span
                    style={{
                      padding: "10px",
                      backgroundColor: "#28A745",
                      color: "#FFFFFF",
                      borderRadius: "5px",
                      fontWeight: "bold",
                      display: "inline-block",
                      marginTop: "10px",
                    }}
                  >
                    Claimed
                  </span>
                ) : (
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(
                          `http://localhost:5000/payments/claim-money/${project._id}`,
                          {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${localStorage.getItem(
                                "freelancerToken"
                              )}`,
                            },
                          }
                        );

                        const data = await response.json();

                        if (response.ok) {
                          // Redirect to Stripe Checkout
                          window.location.href = data.url;
                        } else {
                          alert(data.error || "Failed to claim money.");
                        }
                      } catch (error) {
                        console.error("Error claiming money:", error);
                        alert("An error occurred while claiming money.");
                      }
                    }}
                    style={{
                      padding: "10px",
                      backgroundColor: "#28A745",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: "5px",
                      cursor: "pointer",
                      marginTop: "10px",
                    }}
                  >
                    Claim Money
                  </button>
                )}
                <div style={{ marginTop: "10px" }}>
                  {projectReviews[project._id]?.filter(review => 
                    review.receiverId?._id === userId
                  ).map(review => (
                    <div key={review._id} style={{
                      padding: "10px",
                      backgroundColor: "#333",
                      borderRadius: "5px",
                      marginBottom: "5px"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <p><strong>Client's review:</strong> {review.comment}</p>
                        <p>Rating: {review.rating}/5 ⭐</p>
                      </div>
                    </div>
                  ))}
                </div>
                {!hasReviewed[project._id] ? (
                  <button
                    onClick={() => handleOpenReviewModal(project)}
                    style={{
                      padding: "10px",
                      backgroundColor: "#FFC107",
                      color: "#000000",
                      border: "none",
                      borderRadius: "5px",
                      cursor: "pointer",
                      marginTop: "10px",
                      marginRight: "10px"
                    }}
                  >
                    Review Client
                  </button>
                ) : (
                  <span style={{ 
                    display: "inline-block",
                    padding: "10px", 
                    backgroundColor: "#444", 
                    color: "#aaa",
                    borderRadius: "5px",
                    marginTop: "10px",
                    marginRight: "10px"
                  }}>
                    Review Submitted
                  </span>
                )}
              </div>
            ) : (
              <button
                style={styles.bidButton}
                onClick={() => {
                  const percentage = prompt(
                    `Enter the project completion percentage (0-100):`,
                    project.completedpercentage || 0
                  );
                  if (percentage !== null) {
                    updateCompletionPercentage(project._id, percentage);
                  }
                }}
              >
                Update Completion
              </button>
            )}
          </>
        ) : null
      ) : myBid ? (
        <>
          <button
            style={{ ...styles.bidButton, marginRight: "10px" }}
            onClick={() => {
              setSelectedProject(project);
              setBidAmount(myBid.amount); // Pre-fill the bid amount
              setShowBidModal(true);
            }}
          >
            Update Bid
          </button>
          <button
            style={styles.rejectButton}
            onClick={async () => {
              try {
                const response = await fetch(`http://localhost:5000/bids/${myBid._id}`, {
                  method: "DELETE",
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                });

                if (response.ok) {
                  alert("Bid deleted successfully.");
                  setMyBids((prevBids) => {
                    const updatedBids = { ...prevBids };
                    delete updatedBids[project._id];
                    return updatedBids;
                  });
                } else {
                  alert("Failed to delete bid.");
                }
              } catch (error) {
                console.error("Error deleting bid:", error);
                alert("An error occurred while deleting the bid.");
              }
            }}
          >
            Delete Bid
          </button>
        </>
      ) : (
        <button
          style={styles.bidButton}
          onClick={() => {
            setSelectedProject(project);
            setShowBidModal(true);
          }}
        >
          Bid
        </button>
      )}
    </li>
  );
})}
</ul>
        )}
      </div>

      {showBidModal && (
        <div
          style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "#FFFFFF", padding: "20px", borderRadius: "10px", boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)", zIndex: 1000, textAlign: "center", width: "400px", 
          }}
        >
          {/* Display the project name */}
          <h3 style={{ marginBottom: "20px", color: "#333333" }}>
            Place Your Bid for: <span style={{ color: "#007BFF" }}>{selectedProject?.title}</span>
          </h3>
          <form onSubmit={handleBidSubmit}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
              <input
                type="number"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder="Enter your bid amount"
                style={{padding: "10px", width: "100%", borderRadius: "5px", border: "1px solid #ccc",
                }}
                required
              />
            </div>
            <div>
  <button
    type="submit"
    style={{ ...styles.bidButton, marginRight: "10px" }} // Add marginRight for spacing
  >
    Submit Bid
  </button>
  <button
    type="button"
    onClick={() => setShowBidModal(false)}
    style={styles.rejectButton}
  >
    Cancel
  </button>
</div>

          </form>
        </div>
      )}

      {/* Hire Offers Section */}
      {showHireOffers && (
        <div
          style={{
            position: "absolute", top: "100px", left: "50%", transform: "translateX(-50%)", padding: "20px", backgroundColor: "#444444", borderRadius: "10px", color: "#FFFFFF", boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)", zIndex: 1000, width: "80%",
          }}
        >
          {/* Close Button */}
          <button
            onClick={() => setShowHireOffers(false)}
            style={{position: "absolute", top: "10px", right: "10px", backgroundColor: "#FF0000", borderRadius: "50%", border: "none", color: "#FFFFFF", fontSize: "20px", fontWeight: "bold", cursor: "pointer",
            }}
          >
            ✖
          </button>

          <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Hire Offers</h2>
          {Array.isArray(hireOffers) && hireOffers.length > 0 ? (
            hireOffers.map((offer) => {
              // Ensure the project exists before accessing its properties
              if (!offer.projectId) {
                return null; // Skip this entry if projectId is null or undefined
              }

              return (
                <div
                  key={offer._id}
                  style={{marginBottom: "20px", padding: "15px", backgroundColor: "#333333", borderRadius: "10px", boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                  }}
                >
                  <h3 style={{ marginBottom: "10px", color: "#FFD700" }}>
                    Project: {offer.projectId.title}
                  </h3>
                  <p style={{ marginBottom: "10px" }}>
                    <strong>Description:</strong> {offer.projectId.description}
                  </p>
                  <p style={{ marginBottom: "10px" }}>
                    <strong>Budget:</strong> ${offer.projectId.budget}
                  </p>
                  <p style={{ marginBottom: "10px" }}>
                    <strong>Deadline:</strong>{" "}
                    {new Date(offer.projectId.deadline).toLocaleDateString()}
                  </p>
                  <p style={{ marginBottom: "10px" }}>
                    <strong>Client Name:</strong> {offer.clientId?.name || "N/A"}
                  </p>
                  <p style={{ marginBottom: "10px" }}>
                    <strong>Client Email:</strong> {offer.clientId?.email || "N/A"}
                  </p>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => handleAcceptOffer(offer._id)}
                      style={styles.acceptButton}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleRejectOffer(offer._id)}
                      style={styles.rejectButton}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <p style={{ textAlign: "center", color: "#FFD700", fontSize: "18px" }}>
              No hire offers available now!
            </p>
          )}
        </div>
      )}
      {showPopup && <Popup message={popupMessage} onClose={() => setShowPopup(false)} />}
       
      {showSelectedBids && (
        <div
          style={{
            position: "absolute", top: "100px", left: "50%", transform: "translateX(-50%)", padding: "20px", backgroundColor: "#444444", borderRadius: "10px", color: "#FFFFFF", boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)", zIndex: 1000, width: "80%",
          }}
        >
          <button
            onClick={() => setShowSelectedBids(false)}
            style={{position: "absolute", top: "10px", right: "10px", backgroundColor: "#FF0000", borderRadius: "50%", border: "none", color: "#FFFFFF", fontSize: "20px", fontWeight: "bold", cursor: "pointer",
            }}
          >
            ✖
          </button>

          <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Bids Selected</h2>
          {selectedBids.length > 0 ? (
            selectedBids.map((bid) => (
              <div
                key={bid.bidId}
                style={{marginBottom: "20px", padding: "15px", backgroundColor: "#333333", borderRadius: "10px", boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                }}
              >
                <h3 style={{ marginBottom: "10px", color: "#FFD700" }}>
                  Project: {bid.project?.title || "N/A"}
                </h3>
                <p style={{ marginBottom: "10px" }}>
                  <strong>Description:</strong> {bid.project?.description || "N/A"}
                </p>
                <p style={{ marginBottom: "10px" }}>
                  <strong>Budget:</strong> ${bid.project?.budget || 0}
                </p>
                <p style={{ marginBottom: "10px" }}>
                  <strong>Deadline:</strong>{" "}
                  {bid.project?.deadline
                    ? new Date(bid.project.deadline).toLocaleDateString()
                    : "N/A"}
                </p>
                <p style={{ marginBottom: "10px" }}>
                  <strong>Client Email:</strong> {bid.client?.email || "N/A"}
                </p>
                <p style={{ marginBottom: "10px" }}>
                  <strong>Bid Amount:</strong> ${bid.bidAmount}
                </p>
                <div style={{ display: "flex", gap: "10px" }}>
                  {bid.status === "accepted" ? (
                    <span
                      style={{padding: "10px 20px", backgroundColor: "#28A745", color: "#FFFFFF", borderRadius: "5px", fontWeight: "bold",
                      }}
                    >
                      Accepted
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => handleAcceptBid(bid.bidId)}
                        style={styles.bidButton}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRejectBid(bid.bidId)}
                        style={styles.rejectButton}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p style={{ textAlign: "center", color: "#FFD700", fontSize: "18px" }}>
              No selected bids available.
            </p>
          )}
        </div>
      )}
      {showActivityHistory && (
  <div
    style={{
      position: "absolute", top: "100px", left: "50%", transform: "translateX(-50%)", padding: "20px", backgroundColor: "#444444", borderRadius: "10px", color: "#FFFFFF", boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)", zIndex: 1000, width: "80%",
    }}
  >
    <button
      onClick={() => setShowActivityHistory(false)}
      style={{position: "absolute", top: "10px", right: "10px", backgroundColor: "#FF0000", borderRadius: "50%", border: "none", color: "#FFFFFF", fontSize: "20px", fontWeight: "bold", cursor: "pointer",
      }}
    >
      ✖
    </button>

    <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Activity History</h2>
    {activityLogs.length > 0 ? (
      activityLogs.map((log, index) => (
        <div
          key={index}
          style={{marginBottom: "10px", padding: "10px", backgroundColor: "#333333", borderRadius: "5px",
          }}
        >
          <p>{log.action}</p>
          <p style={{ fontSize: "12px", color: "#AAAAAA" }}>
            {new Date(log.timestamp).toLocaleString()}
          </p>
        </div>
      ))
    ) : (
      <p style={{ textAlign: "center", color: "#FFD700" }}>No activity found.</p>
    )}
  </div>
)}
      {showReviewModal && selectedProjectForReview && (
  <div
    style={{
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      backgroundColor: "#FFFFFF",
      padding: "20px",
      borderRadius: "10px",
      boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
      zIndex: 1000,
      width: "500px",
      color: "#000000",
    }}
  >
    <h3 style={{ textAlign: "center", marginBottom: "20px" }}>
      Review Client for "{selectedProjectForReview.title}"
    </h3>
    <form onSubmit={handleReviewSubmit}>
      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Rating (1-5):
        </label>
        <select
          value={reviewData.rating}
          onChange={(e) => setReviewData({ ...reviewData, rating: e.target.value })}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "5px",
            border: "1px solid #ddd",
          }}
          required
        >
          <option value="5">5 - Excellent</option>
          <option value="4">4 - Very Good</option>
          <option value="3">3 - Good</option>
          <option value="2">2 - Fair</option>
          <option value="1">1 - Poor</option>
        </select>
      </div>
      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Review Comment:
        </label>
        <textarea
          value={reviewData.comment}
          onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })}
          placeholder="Share your experience working with this client..."
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "5px",
            border: "1px solid #ddd",
            minHeight: "100px",
            resize: "vertical",
          }}
          required
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button
          type="submit"
          style={{
            padding: "10px 20px",
            backgroundColor: "#28A745",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Submit Review
        </button>
        <button
          type="button"
          onClick={() => {
            setShowReviewModal(false);
            setSelectedProjectForReview(null);
          }}
          style={{
            padding: "10px 20px",
            backgroundColor: "#DC3545",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  </div>
)}
{showMyReviews && (
  <div
    style={{
      position: "absolute",
      top: "100px",
      left: "50%",
      transform: "translateX(-50%)",
      padding: "20px",
      backgroundColor: "#444444",
      borderRadius: "10px",
      color: "#FFFFFF",
      boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
      zIndex: 1000,
      width: "80%",
    }}
  >
    <button
      onClick={() => setShowMyReviews(false)}
      style={{
        position: "absolute",
        top: "10px",
        right: "10px",
        backgroundColor: "#FF0000",
        borderRadius: "50%",
        border: "none",
        color: "#FFFFFF",
        fontSize: "20px",
        fontWeight: "bold",
        cursor: "pointer",
      }}
    >
      ✖
    </button>

    <h2 style={{ textAlign: "center", marginBottom: "20px" }}>My Reviews</h2>
    {myReviews.length > 0 ? (
      myReviews.map((review) => (
        <div
          key={review._id}
          style={{
            marginBottom: "20px",
            padding: "15px",
            backgroundColor: "#333333",
            borderRadius: "10px",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            <h3 style={{ color: "#FFD700" }}>
              Project: {review.projectId?.title || "Unknown Project"}
            </h3>
            <div>
              <span style={{ fontSize: "20px", color: "#FFD700" }}>
                {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
              </span>
              <span style={{ marginLeft: "5px", color: "#FFD700" }}>{review.rating}/5</span>
            </div>
          </div>
          <p style={{ marginBottom: "10px", fontSize: "16px" }}>"{review.comment}"</p>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#AAAAAA", fontSize: "14px" }}>
            <p>From: {review.reviewerId?.email || "Unknown"}</p>
            <p>{new Date(review.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      ))
    ) : (
      <p style={{ textAlign: "center", color: "#FFD700", fontSize: "18px" }}>
        You don't have any reviews yet.
      </p>
    )}
  </div>
)}
{/* Client Reviews Modal */}
{showClientReviews && (
  <div
    style={{
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      padding: "20px",
      backgroundColor: "#444444",
      borderRadius: "10px",
      color: "#FFFFFF",
      boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
      zIndex: 1000,
      width: "80%",
      maxHeight: "80vh",
      overflowY: "auto",
    }}
  >
    <button
      onClick={() => setShowClientReviews(false)}
      style={{position: "absolute",top: "10px",right: "10px",backgroundColor: "#FF0000",borderRadius: "50%",border: "none",color: "#FFFFFF",fontSize: "20px",fontWeight: "bold",cursor: "pointer",

      }}
    >
      ✖
    </button>

    <h2 style={{ textAlign: "center", marginBottom: "10px" }}>Reviews for {selectedClientName}</h2>
    
    {selectedClientReviews.length > 0 ? (
      <>
        <div style={{ 
          textAlign: "center", 
          marginBottom: "20px", 
          backgroundColor: "#333", 
          padding: "15px", 
          borderRadius: "8px"
        }}>
          <h3 style={{ color: "#FFD700", marginBottom: "5px" }}>Average Rating</h3>
          <div>
            <span style={{ fontSize: "28px", color: "#FFD700" }}>
              {"★".repeat(Math.round(selectedClientAvgRating))}
              {"☆".repeat(5 - Math.round(selectedClientAvgRating))}
            </span>
            <span style={{ marginLeft: "10px", color: "#FFD700", fontSize: "24px" }}>
              {selectedClientAvgRating}/5
            </span>
            <p style={{ marginTop: "5px" }}>
              Based on {selectedClientReviews.length} review{selectedClientReviews.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        
        {selectedClientReviews.map((review) => (
          <div
            key={review._id}
            style={{marginBottom: "20px",padding: "15px",backgroundColor: "#333333",borderRadius: "10px",boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",

            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
              <h3 style={{ color: "#FFD700" }}>
                Project: {review.projectId?.title || "Unknown Project"}
              </h3>
              <div>
                <span style={{ fontSize: "20px", color: "#FFD700" }}>
                  {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                </span>
                <span style={{ marginLeft: "5px", color: "#FFD700" }}>{review.rating}/5</span>
              </div>
            </div>
            <p style={{ marginBottom: "10px", fontSize: "16px" }}>"{review.comment}"</p>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#AAAAAA", fontSize: "14px" }}>
              <p>From: {review.reviewerId?.name || review.reviewerId?.email || "Unknown"}</p>
              <p>{new Date(review.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
      </>
    ) : (
      <p style={{ textAlign: "center", color: "#FFD700", fontSize: "18px", marginTop: "30px" }}>
        No reviews available for this client.
      </p>
    )}
  </div>
)}
    </div>
  );
};

const Popup = ({ message, onClose }) => {
  return (
    <div
      style={{position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "#FFFFFF", padding: "20px", borderRadius: "10px", boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)", zIndex: 1000, textAlign: "center",
      }}
    >
      <p style={{ marginBottom: "20px", color: "#333333" }}>{message}</p>
      <button
        onClick={onClose}
        style={{padding: "10px 20px", backgroundColor: "#007BFF", color: "#FFFFFF", border: "none", borderRadius: "5px", cursor: "pointer",
        }}
      >
        OK
      </button>
    </div>
  );
};

export default FreelancerDashboard;
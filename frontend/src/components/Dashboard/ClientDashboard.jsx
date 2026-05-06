import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

const ClientDashboard = () => {
  const [projects, setProjects] = useState([]);
  const [freelancers, setFreelancers] = useState([]);
  const [newProject, setNewProject] = useState({
    title: "",
    description: "",
    budget: "",
    deadline: "",
  });
  const [accountInfo, setAccountInfo] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
    name: "",
  });
  const [originalAccountInfo, setOriginalAccountInfo] = useState({});
  const [username, setUsername] = useState("Loading...");
  const [showProjects, setShowProjects] = useState(false);
  const [showPostProject, setShowPostProject] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingFreelancers, setLoadingFreelancers] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState("");
  const [deleteAccountInfo, setDeleteAccountInfo] = useState({
    email: "",
    currentPassword: "",
  });
  const [editProject, setEditProject] = useState({
    id: null,
    budget: "",
    deadline: "",
  });
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDirectHireModal, setShowDirectHireModal] = useState(false);
  const [selectedFreelancerId, setSelectedFreelancerId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [bids, setBids] = useState([]);
  const [showBidsModal, setShowBidsModal] = useState(false);
  const [selectedProjectTitle, setSelectedProjectTitle] = useState("");
  const [activityLogs, setActivityLogs] = useState([]);
  const [showActivityHistory, setShowActivityHistory] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [freelancerSearchQuery, setFreelancerSearchQuery] = useState("");
  const [filteredFreelancers, setFilteredFreelancers] = useState([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [amount, setAmount] = useState(0);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedProjectForReview, setSelectedProjectForReview] = useState(null);
  const [reviewData, setReviewData] = useState({ rating: 5, comment: "" });
  const [hasReviewed, setHasReviewed] = useState({});
  const [projectReviews, setProjectReviews] = useState({});
  const [showMyReviews, setShowMyReviews] = useState(false);
  const [myReviews, setMyReviews] = useState([]);
  const [showFreelancerReviews, setShowFreelancerReviews] = useState(false);
  const [selectedFreelancerReviews, setSelectedFreelancerReviews] = useState([]);
  const [selectedFreelancerName, setSelectedFreelancerName] = useState("");
  const [selectedFreelancerAvgRating, setSelectedFreelancerAvgRating] = useState(0);

  const token = localStorage.getItem("clientToken");
  const loggedInClientId = token ? JSON.parse(atob(token.split(".")[1])).id : null;
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      const decodedToken = JSON.parse(atob(token.split(".")[1]));
      setUsername(decodedToken.name || "Client");
    }
  }, [token]);

  const checkUserExists = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:5000/users/check/${loggedInClientId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        localStorage.removeItem("token");
        navigate("/login");
      }
    } catch (err) {
      console.error("Error checking user existence:", err);
      localStorage.removeItem("token");
      navigate("/login");
    }
  }, [loggedInClientId, token, navigate]);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    const interval = setInterval(checkUserExists, 1000);
    return () => clearInterval(interval);
  }, [checkUserExists, token, navigate]);

  useEffect(() => {
    const fetchAccountInfo = async () => {
      try {
        const response = await fetch("http://localhost:5000/users/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setAccountInfo((prev) => ({
            ...prev,
            name: data.name || "",
          }));
          setOriginalAccountInfo({ name: data.name || "" });
          setUsername(data.name || "Client");
        } else {
          console.error("Failed to fetch account info.");
        }
      } catch (error) {
        console.error("Error fetching account info:", error);
      }
    };

    fetchAccountInfo();
  }, [token, navigate, loggedInClientId]);

  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const response = await fetch("http://localhost:5000/projects/client/projects", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();

        // Sort projects: Approved projects at the top
        const sortedProjects = data.sort((a, b) => {
          if (a.approvalStatus === "Approved" && b.approvalStatus !== "Approved") {
            return -1; // a comes before b
          }
          if (a.approvalStatus !== "Approved" && b.approvalStatus === "Approved") {
            return 1; // b comes before a
          }
          return 0; // no change in order
        });

        setProjects(sortedProjects);
      } else {
        console.error("Failed to fetch projects");
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoadingProjects(false);
    }
  }, [token]);

  const fetchProjectsForDirectHire = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:5000/projects/client/projects", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      } else {
        console.error("Failed to fetch projects for direct hire.");
      }
    } catch (error) {
      console.error("Error fetching projects for direct hire:", error);
    }
  }, [token]);

  const fetchFreelancers = useCallback(async () => {
    setLoadingFreelancers(true);
    try {
      const response = await fetch("http://localhost:5000/users/allfreelancers");
      const data = await response.json();
      
      // For each freelancer, fetch their reviews to get count and average
      const freelancersWithReviewInfo = await Promise.all(
        Array.isArray(data) ? data.map(async (freelancer) => {
          try {
            // Get reviews for this freelancer
            const reviewsResponse = await fetch(`http://localhost:5000/reviews/received/${freelancer._id}`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            
            if (reviewsResponse.ok) {
              const reviewsData = await reviewsResponse.json();
              // Calculate average if there are reviews
              let avgRating = 0;
              if (reviewsData.length > 0) {
                const totalRating = reviewsData.reduce((sum, review) => sum + review.rating, 0);
                avgRating = totalRating / reviewsData.length;
              }
              
              return {
                ...freelancer,
                reviewCount: reviewsData.length,
                avgRating: avgRating ? avgRating.toFixed(1) : 0
              };
            }
            return freelancer;
          } catch (error) {
            console.error("Error fetching freelancer review info:", error);
            return freelancer;
          }
        }) : []
      );
      
      setFreelancers(freelancersWithReviewInfo);
    } catch (error) {
      console.error("Error fetching freelancers:", error);
      setFreelancers([]);
    } finally {
      setLoadingFreelancers(false);
    }
  }, [token]);

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

  const fetchMyReviews = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:5000/reviews/received/${loggedInClientId}`, {
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
  }, [loggedInClientId, token]);

  const fetchFreelancerReviews = useCallback(async (freelancerId, freelancerName) => {
    try {
      const response = await fetch(`http://localhost:5000/reviews/received/${freelancerId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setSelectedFreelancerReviews(data);
        setSelectedFreelancerName(freelancerName);
        
        // Calculate average rating
        if (data.length > 0) {
          const totalRating = data.reduce((sum, review) => sum + review.rating, 0);
          const avgRating = totalRating / data.length;
          setSelectedFreelancerAvgRating(parseFloat(avgRating.toFixed(1)));
        } else {
          setSelectedFreelancerAvgRating(0);
        }
        
        setShowFreelancerReviews(true);
      } else {
        console.error("Failed to fetch freelancer reviews");
      }
    } catch (error) {
      console.error("Error fetching freelancer reviews:", error);
    }
  }, [token]);

  const markNotificationsAsRead = async () => {
    try {
      const response = await fetch("http://localhost:5000/notifications/mark-as-read", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        fetchNotifications();
      } else {
        console.error("Failed to mark notifications as read.");
      }
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  };

  useEffect(() => {
    fetchFreelancers();
  }, [fetchFreelancers]);

  useEffect(() => {
    if (showProjects) {
      fetchProjects();
    }
  }, [showProjects, fetchProjects, fetchFreelancers]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleProjectSubmit = async (e) => {
    e.preventDefault();

    const today = new Date().toISOString().split("T")[0];
    if (newProject.deadline < today) {
      alert("The deadline cannot be a date in the past. Please select a valid date.");
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/projects/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newProject.title,
          description: newProject.description,
          budget: newProject.budget,
          deadline: newProject.deadline,
          client: loggedInClientId,
        }),
      });

      if (response.ok) {
        const createdProject = await response.json();
        setProjects([...projects, createdProject]);
        setNewProject({
          title: "",
          description: "",
          budget: "",
          deadline: "",
        });
        alert("Project created successfully!");
      } else {
        const data = await response.json();
        alert(data.error || "Failed to create project.");
      }
    } catch (error) {
      console.error("Error creating project:", error);
      alert("An error occurred while creating the project.");
    }
  };

  const handleAccountInfoChange = (e) => {
    setAccountInfo({ ...accountInfo, [e.target.name]: e.target.value });
  };

  const handleAccountUpdate = async (e) => {
    e.preventDefault();

    if (
      accountInfo.name === originalAccountInfo.name &&
      !accountInfo.newPassword &&
      !accountInfo.confirmNewPassword
    ) {
      setPopupMessage("No changes have been made.");
      setPopupType("error");
      return;
    }

    if (!accountInfo.currentPassword) {
      setPopupMessage("Please provide your current password.");
      setPopupType("error");
      return;
    }

    if (accountInfo.newPassword !== accountInfo.confirmNewPassword) {
      setPopupMessage("New password and confirm password do not match.");
      setPopupType("error");
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/users/client/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: accountInfo.name,
          currentPassword: accountInfo.currentPassword,
          newPassword: accountInfo.newPassword,
          confirmPassword: accountInfo.confirmNewPassword,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setPopupMessage("Account updated successfully!");
        setPopupType("success");
        setOriginalAccountInfo({ name: data.name });
        setAccountInfo((prev) => ({
          ...prev,
          currentPassword: "",
          newPassword: "",
          confirmNewPassword: "",
        }));

        const userResponse = await fetch(`http://localhost:5000/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (userResponse.ok) {
          const updatedUser = await userResponse.json();
          setUsername(updatedUser.name);
        }
      } else {
        const data = await response.json();
        setPopupMessage(data.error || "Failed to update account.");
        setPopupType("error");
      }
    } catch (error) {
      console.error("Error updating account:", error);
      setPopupMessage("An error occurred while updating the account.");
      setPopupType("error");
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();

    if (!deleteAccountInfo.email || !deleteAccountInfo.currentPassword) {
      alert("Please provide your email and current password.");
      return;
    }

    const confirmDelete = window.confirm(
      "Are you sure you want to delete your account? This action cannot be undone."
    );

    if (!confirmDelete) {
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/users/client/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: deleteAccountInfo.email,
          currentPassword: deleteAccountInfo.currentPassword,
        }),
      });

      if (response.ok) {
        alert("Account deleted successfully. Taking you to the login page.");
        localStorage.removeItem("token");
        setDeleteAccountInfo({ email: "", currentPassword: "" });
        window.location.href = "/login";
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete account.");
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("An error occurred while deleting the account.");
    }
  };

  const handleDeleteProject = async (projectId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this project? This action cannot be undone."
    );

    if (!confirmDelete) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/projects/client/delete/${projectId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert("Project deleted successfully.");
        fetchProjects();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete the project.");
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("An error occurred while deleting the project.");
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

  const handleRefundEscrow = async (projectId) => {
    try {
      const response = await fetch(`http://localhost:5000/payments/refund-escrow/${projectId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("clientToken")}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        // Redirect to Stripe Checkout session URL
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to process refund.");
      }
    } catch (error) {
      console.error("Error processing refund:", error);
      alert("An error occurred while processing the refund.");
    }
  };

  const isUpdateDisabled =
    !accountInfo.currentPassword ||
    !accountInfo.name ||
    (accountInfo.name === originalAccountInfo.name &&
      !accountInfo.newPassword &&
      !accountInfo.confirmNewPassword) ||
    accountInfo.newPassword !== accountInfo.confirmNewPassword;

  const closePopup = () => {
    setPopupMessage("");
    setPopupType("");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setDeleteAccountInfo({ email: "", currentPassword: "" });
    window.location.href = "/login";
  };

  const handleDirectHireClick = async (freelancerId) => {
    await fetchProjectsForDirectHire();
    setSelectedFreelancerId(freelancerId);
    setShowDirectHireModal(true);
  };

  const handleDirectHire = async (projectId) => {
    try {
      const response = await fetch("http://localhost:5000/direct-hire", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          freelancerId: selectedFreelancerId,
          projectId,
        }),
      });

      if (response.ok) {
        alert("Freelancer has been offered to hire successfully!");
        setShowDirectHireModal(false);
        setSelectedProjectId(null);
      } else {
        const data = await response.json();
        alert(data.error || "Failed to hire freelancer.");
      }
    } catch (error) {
      console.error("Error hiring freelancer:", error);
      alert("An error occurred while hiring the freelancer.");
    }
  };

  const fetchBidsForProject = async (projectId, projectTitle) => {
    try {
      const response = await fetch(`http://localhost:5000/bids/${projectId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBids(data);
        setSelectedProjectTitle(projectTitle);
        setShowBidsModal(true);
      } else {
        console.error("Failed to fetch bids for the project.");
      }
    } catch (error) {
      console.error("Error fetching bids for the project:", error);
    }
  };

  const handleSelectBid = async (bidId) => {
    const confirmSelect = window.confirm(
      "Once you select, you cannot cancel it. Are you sure you want to proceed?"
    );

    if (!confirmSelect) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/bids/select/${bidId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert("Bid selected successfully!");
        fetchProjects(); // Refresh the project list
      } else {
        const data = await response.json();
        alert(data.error || "Failed to select bid.");
      }
    } catch (error) {
      console.error("Error selecting bid:", error);
    }
  };

  const closeBidsModal = () => {
    setShowBidsModal(false);
    setBids([]);
    setSelectedProjectTitle("");
  };

  const fetchActivityLogs = async () => {
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
  };

  const handleViewCompletion = (percentage, title) => {
    setCompletionPercentage(percentage || 0);
    setSelectedProjectTitle(title);
    setShowCompletionModal(true);
  };

  const handleSearch = useCallback(
    (query) => {
      setSearchQuery(query);

      const filtered = projects.filter((project) => {
        const queryLower = query.toLowerCase();
        return (
          project.title.toLowerCase().includes(queryLower) ||
          project.description.toLowerCase().includes(queryLower) ||
          project.budget.toString().includes(queryLower) ||
          new Date(project.deadline).toLocaleDateString().includes(queryLower)
        );
      });

      setFilteredProjects(filtered);
    },
    [projects]
  );

  useEffect(() => {
    if (showProjects) {
      fetchProjects();
    }
  }, [showProjects, fetchProjects]);

  useEffect(() => {
    handleSearch(searchQuery);
  }, [projects, handleSearch, searchQuery]);

  useEffect(() => {
    document.title = "Freelance Forge - Client Dashboard";
  }, []);

  const handleFreelancerSearch = useCallback(
    (query) => {
      setFreelancerSearchQuery(query);

      if (!query.trim()) {
        setFilteredFreelancers(freelancers);
        return;
      }

      const queryLower = query.toLowerCase().trim();
      
      const filtered = freelancers.filter((freelancer) => {
        // Convert rating to string for text-based comparison
        const ratingString = freelancer.avgRating ? freelancer.avgRating.toString() : "0";
        
        // Search across all fields including rating as a string
        return (
          (freelancer.name && freelancer.name.toLowerCase().includes(queryLower)) ||
          (freelancer.email && freelancer.email.toLowerCase().includes(queryLower)) ||
          (freelancer.profile?.[0]?.skills &&
            freelancer.profile[0].skills.join(", ").toLowerCase().includes(queryLower)) ||
          (freelancer.profile?.[0]?.experience &&
            freelancer.profile[0].experience.toLowerCase().includes(queryLower)) ||
          ratingString.includes(queryLower) // Search in rating as string
        );
      });

      setFilteredFreelancers(filtered);
    },
    [freelancers]
  );

  useEffect(() => {
    handleFreelancerSearch(freelancerSearchQuery);
  }, [freelancers, freelancerSearchQuery, handleFreelancerSearch]);

  const handleFundEscrow = (projectId, projectAmount) => {
    setSelectedProjectId(projectId);
    setAmount(projectAmount);
    setShowPaymentForm(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    try {
      const stripe = await stripePromise;

      // Call backend to create a payment intent
      const response = await fetch(`http://localhost:5000/payments/create-payment-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("clientToken")}`,
        },
        body: JSON.stringify({ projectId: selectedProjectId, amount }),
      });

      const data = await response.json();
      console.log("Backend response:", data);

      if (response.ok) {
        // Redirect to Stripe Checkout
        const result = await stripe.redirectToCheckout({ sessionId: data.sessionId });
        console.log("Stripe redirect result:", result);

        if (result.error) {
          alert(result.error.message);
        }
      } else {
        alert(data.error || "Failed to initiate payment.");
      }
    } catch (error) {
      console.error("Error processing payment:", error);
    }
  };

  const handleApproveProject = async (projectId) => {
    try {
      const response = await fetch(`http://localhost:5000/projects/approve-completion/${projectId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("clientToken")}`,
        },
      });

      if (response.ok) {
        alert("Project approved successfully!");
        fetchProjects(); // Refresh the project list
      } else {
        const data = await response.json();
        alert(data.error || "Failed to approve project.");
      }
    } catch (error) {
      console.error("Error approving project:", error);
      alert("An error occurred while approving the project.");
    }
  };

  const handleRejectApproval = async (projectId, comments) => {
    try {
      const response = await fetch(`http://localhost:5000/projects/reject-approval/${projectId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("clientToken")}`,
        },
        body: JSON.stringify({ comments, completedpercentage: 0, completionUrl: null }),
      });

      if (response.ok) {
        alert("Project approval rejected successfully!");
        fetchProjects(); // Refresh the project list
      } else {
        const data = await response.json();
        alert(data.error || "Failed to reject project approval.");
      }
    } catch (error) {
      console.error("Error rejecting project approval:", error);
      alert("An error occurred while rejecting the project approval.");
    }
  };

  const handleEditProjectSubmit = async (updatedProject) => {
    try {
      const response = await fetch(`http://localhost:5000/projects/client/update/${updatedProject.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          budget: updatedProject.budget,
          deadline: updatedProject.deadline,
        }),
      });

      if (response.ok) {
        alert("Project updated successfully!");
        setEditProject({ id: null, budget: "", deadline: "" });
        fetchProjects(); // Refresh the project list
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update project.");
      }
    } catch (error) {
      console.error("Error updating project:", error);
      alert("An error occurred while updating the project.");
    }
  };

  const checkReviewStatus = useCallback(async (projectId) => {
    try {
      const response = await fetch(`http://localhost:5000/reviews/check/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setHasReviewed((prev) => ({ ...prev, [projectId]: data.hasReviewed }));

      // Fetch existing reviews for this project
      const reviewsResponse = await fetch(`http://localhost:5000/reviews/project/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const reviewsData = await reviewsResponse.json();
      setProjectReviews((prev) => ({ ...prev, [projectId]: reviewsData }));
    } catch (error) {
      console.error("Error checking review status:", error);
    }
  }, [token]);

  useEffect(() => {
    const fetchReviewStatuses = async () => {
      const approvedProjects = projects.filter((p) => p.approvalStatus === "Approved");
      for (const project of approvedProjects) {
        await checkReviewStatus(project._id);
      }
    };

    if (projects.length > 0) {
      fetchReviewStatuses();
    }
  }, [projects, checkReviewStatus]);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();

    if (!selectedProjectForReview) return;

    try {
      const response = await fetch("http://localhost:5000/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId: selectedProjectForReview._id,
          receiverId: selectedProjectForReview.acceptedFreelancer,
          rating: parseInt(reviewData.rating),
          comment: reviewData.comment,
        }),
      });

      if (response.ok) {
        setPopupMessage("Review submitted successfully");
        setPopupType("success");
        setShowReviewModal(false);
        setSelectedProjectForReview(null);
        setReviewData({ rating: 5, comment: "" });

        // Update review status
        await checkReviewStatus(selectedProjectForReview._id);
      } else {
        const data = await response.json();
        setPopupMessage(data.error || "Failed to submit review");
        setPopupType("error");
      }
    } catch (error) {
      console.error("Error submitting review:", error);
      setPopupMessage("Error submitting review");
      setPopupType("error");
    }
  };

  return (
    <div
      style={{padding: "20px",textAlign: "center",backgroundColor: "#723456",color: "#FFFFFF",minHeight: "100vh",
      }}
    >
      <h1>Welcome, {username}</h1>

      {popupMessage && (
        <div
          style={{position: "fixed",top: "20px",right: "20px",backgroundColor: popupType === "success" ? "#4CAF50" : "#f44336",color: "white",padding: "10px 20px",borderRadius: "5px",zIndex: 1000,
          }}
        >
          {popupMessage}
          <button
            onClick={closePopup}
            style={{ marginLeft: "10px",backgroundColor: "transparent",border: "none",color: "white",cursor: "pointer",fontSize: "16px",
            }}
          >
            ✖
          </button>
        </div>
      )}

      <div style={{ position: "absolute", top: "20px", right: "40px", display: "flex", gap: "20px" }}>
        <div>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications) {
                markNotificationsAsRead();
              }
            }}
            style={{padding: "10px",backgroundColor: "#007BFF",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",fontWeight: "bold",
            }}
          >
            Notifications
          </button>
          {showNotifications && (
            <div
              style={{position: "absolute",top: "50px",right: "0",backgroundColor: "#FFFFFF",border: "1px solid #ddd",borderRadius: "5px",padding: "10px",width: "300px",zIndex: 1000,
              }}
            >
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <div
                    key={notification._id}
                    style={{padding: "10px",borderBottom: "1px solid #ddd",display: "flex",justifyContent: "space-between",alignItems: "center",
                    }}
                  >
                    <p
                      style={{margin: 0, color: "#000000",
                      }}
                    >
                      {notification.message}
                    </p>
                    <button
                      onClick={() => handleDeleteNotification(notification._id)}
                      style={{backgroundColor: "#DC3545",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",padding: "5px 10px",fontSize: "12px",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))
              ) : (
                <p style={{ textAlign: "center", color: "#555555" }}>
                  You do not have any notifications.
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => setShowAccountDropdown(!showAccountDropdown)}
            style={{  padding: "10px", backgroundColor: "#28A745", color: "#FFFFFF", border: "none", borderRadius: "5px",cursor: "pointer",fontWeight: "bold",
            }}
          >
            My Account
          </button>
          {showAccountDropdown && (
            <div
              style={{position: "absolute",top: "50px",right: "20px",backgroundColor: "#f9f9f9",border: "1px solid #ddd", padding: "20px",zIndex: 1000,width: "300px",
              }}
            >
              <form onSubmit={handleAccountUpdate}>
                <input
                  type="text"
                  name="name"
                  placeholder="Name"
                  value={accountInfo.name}
                  onChange={handleAccountInfoChange}
                  style={{padding: "10px", marginBottom: "10px",width: "100%",boxSizing: "border-box",
                  }}
                />
                <input
                  type="password"
                  name="currentPassword"
                  placeholder="Current Password"
                  value={accountInfo.currentPassword}
                  onChange={handleAccountInfoChange}
                  style={{padding: "10px",marginBottom: "10px",width: "100%", boxSizing: "border-box",
                  }}
                />
                <input
                  type="password"
                  name="newPassword"
                  placeholder="New Password"
                  value={accountInfo.newPassword}
                  onChange={handleAccountInfoChange}
                  style={{ padding: "10px", marginBottom: "10px", width: "100%", boxSizing: "border-box",
                  }}
                />
                <input
                  type="password"
                  name="confirmNewPassword"
                  placeholder="Confirm New Password"
                  value={accountInfo.confirmNewPassword}
                  onChange={handleAccountInfoChange}
                  style={{padding: "10px",marginBottom: "10px", width: "100%",boxSizing: "border-box",
                  }}
                />
                <button
                  type="submit"
                  disabled={isUpdateDisabled}
                  style={{padding: "10px",backgroundColor: isUpdateDisabled ? "#ccc" : "#007BFF",color: "white",border: "none",cursor: isUpdateDisabled ? "not-allowed" : "pointer", width: "100%",
                  }}
                >
                  Update Information
                </button>
              </form>
              <form onSubmit={handleDeleteAccount} style={{ marginTop: "20px" }}>
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={deleteAccountInfo.email}
                  onChange={(e) =>
                    setDeleteAccountInfo({ ...deleteAccountInfo, email: e.target.value })
                  }
                  required
                  style={{padding: "10px",marginBottom: "10px",width: "100%",boxSizing: "border-box",
                  }}
                />
                <input
                  type="password"
                  name="currentPassword"
                  placeholder="Current Password"
                  value={deleteAccountInfo.currentPassword}
                  onChange={(e) =>
                    setDeleteAccountInfo({ ...deleteAccountInfo, currentPassword: e.target.value })
                  }
                  required
                  style={{padding: "10px",marginBottom: "10px",width: "100%",boxSizing: "border-box",
                  }}
                />
                <button
                  type="submit"
                  style={{padding: "10px",backgroundColor: "#F44336",color: "white",border: "none",cursor: "pointer",width: "100%",
                  }}
                >
                  Delete Account
                </button>
              </form>

              <div style={{ marginTop: "20px", textAlign: "center" }}>
                <button
                  onClick={() => {
                    setShowActivityHistory(!showActivityHistory);
                    if (!showActivityHistory) fetchActivityLogs();
                  }}
                  style={{padding: "10px",backgroundColor: "#FFC107",color: "#000000",border: "none",borderRadius: "5px",cursor: "pointer", width: "100%",fontWeight: "bold",
                  }}
                >
                  Activity History
                </button>
              </div>
              <ul style={{ listStyleType: "none", padding: 0, marginTop: "20px" }}>
                <li style={{ marginTop: "10px" }}>
                  <button
                    onClick={() => {
                      setShowMyReviews(!showMyReviews);
                      if (!showMyReviews) fetchMyReviews();
                    }}
                    style={{padding: "10px",backgroundColor: "#007BFF",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",width: "100%",fontWeight: "bold",
                    }}
                  >
                    My Reviews
                  </button>
                </li>
              </ul>
              <div style={{ marginTop: "20px", textAlign: "center" }}>
                <button
                  onClick={handleLogout}
                  style={{ padding: "10px", backgroundColor: "#F44336", color: "white", border: "none", cursor: "pointer", width: "100%",
                  }}
                >
                  Logout
                </button>
              </div>

              
            </div>
          )}
        </div>
      </div>

      <div>
        <button
          onClick={() => setShowPostProject(!showPostProject)}
          style={{padding: "10px",marginBottom: "20px",backgroundColor: "#28A745",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer", fontWeight: "bold",
          }}
        >
          {showPostProject ? "Hide Post Project" : "Post a Project"}
        </button>
        {showPostProject && (
          <form onSubmit={handleProjectSubmit} style={{ marginBottom: "20px" }}>
            <input
              type="text"
              placeholder="Project Title"
              value={newProject.title}
              onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
              required
              style={{ padding: "10px", marginRight: "10px" }}
            />
            <input
              type="text"
              placeholder="Project Description"
              value={newProject.description}
              onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              required
              style={{ padding: "10px", marginRight: "10px" }}
            />
            <input
              type="number"
              placeholder="Budget"
              value={newProject.budget}
              onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })}
              required
              style={{ padding: "10px", marginRight: "10px" }}
            />
            <input
              type="date"
              placeholder="Deadline"
              value={newProject.deadline}
              onChange={(e) => setNewProject({ ...newProject, deadline: e.target.value })}
              required
              style={{ padding: "10px", marginRight: "10px" }}
            />
            <button
              type="submit"
              style={{padding: "10px",backgroundColor: "#007BFF",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",fontWeight: "bold",
              }}
            >
              Post Project
            </button>
          </form>
        )}
      </div>

      <div>
        <button
          onClick={() => setShowProjects(!showProjects)}
          style={{padding: "10px",marginBottom: "20px",backgroundColor: "#FFC107",color: "#000000",border: "none",borderRadius: "5px",cursor: "pointer", fontWeight: "bold",
          }}
        >
          {showProjects ? "Hide My Projects" : "See My Projects"}
        </button>
        {showProjects && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <input
                type="text"
                placeholder="Search projects by title, budget, deadline, or description"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                style={{padding: "10px",width: "100%",borderRadius: "5px",border: "1px solid #ddd",boxSizing: "border-box",
                }}
              />
            </div>

            {loadingProjects ? (
              <p>Loading projects...</p>
            ) : filteredProjects.length > 0 ? (
              filteredProjects.map((project) => {
                let actionContent;

                if (project.status === "accepted") {
                  // Claim Remaining Budget
                  const remainingBudget = project.budget - project.acceptedmoney;
                  const claimButton =
                    remainingBudget > 0 ? (
                      project.claimStatus === "Claimed" ? (
                        <div
                          style={{ padding: "10px 20px", color: "#FFFFFF",borderRadius: "5px",fontWeight: "bold",display: "inline-block",marginRight: "10px", height: "20px", // Match button height
                          }}
                        >
                          Claimed
                        </div>
                      ) : (
                        <button
                          onClick={async () => {
                            try {
                              const response = await fetch(
                                `http://localhost:5000/payments/claim-remaining/${project._id}`,
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${localStorage.getItem("clientToken")}`,
                                  },
                                }
                              );

                              const data = await response.json();

                              if (response.ok) {
                                // Redirect to Stripe Checkout
                                window.location.href = data.url;
                              } else {
                                alert(data.error || "Failed to claim the remaining budget.");
                              }
                            } catch (error) {
                              console.error("Error claiming remaining budget:", error);
                              alert("An error occurred while claiming the remaining budget.");
                            }
                          }}
                          style={{ padding: "10px", backgroundColor: "#007BFF", color: "#FFFFFF", border: "none", borderRadius: "5px",cursor: "pointer",marginTop: "10px",marginRight: "10px", // Added spacing
                          }}
                        >
                          Claim Remaining Budget (${remainingBudget})
                        </button>
                      )
                    ) : null;

                  // Completion Percentage and URL Conditions
                  if (project.completedpercentage !== 100 || !project.completionUrl) {
                    actionContent = (
                      <div>
                        <button
                          onClick={() => handleViewCompletion(project.completedpercentage, project.title)}
                          style={{padding: "10px",backgroundColor: "#007BFF",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",fontWeight: "bold",marginTop: "10px",marginRight: "10px", // Added spacing
                          }}
                        >
                          View Completion Percentage
                        </button>
                        {claimButton}
                      </div>
                    );
                  } else if (project.approvalStatus === "Approved") {
                    const remainingBudget = project.budget - project.acceptedmoney;

                    const claimButton =
                      remainingBudget > 0 && project.claimStatus !== "Claimed" ? (
                        <button
                          onClick={async () => {
                            try {
                              const response = await fetch(
                                `http://localhost:5000/payments/claim-remaining/${project._id}`,
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${localStorage.getItem("clientToken")}`,
                                  },
                                }
                              );

                              const data = await response.json();

                              if (response.ok) {
                                // Redirect to Stripe Checkout
                                window.location.href = data.url;
                              } else {
                                alert(data.error || "Failed to claim the remaining budget.");
                              }
                            } catch (error) {
                              console.error("Error claiming remaining budget:", error);
                              alert("An error occurred while claiming the remaining budget.");
                            }
                          }}
                          style={{padding: "10px",backgroundColor: "#007BFF",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",marginTop: "10px",marginRight: "10px", // Added spacing
                          }}
                        >
                          Claim Remaining Budget (${remainingBudget})
                        </button>
                      ) : null;

                    actionContent = (
                      <div>
                        <p
                          style={{ marginTop: "10px", marginBottom: "10px",color: "#007BFF", fontWeight: "bold",
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
                        <div
                          style={{ padding: "10px", backgroundColor: "#28A745", color: "#FFFFFF",borderRadius: "5px",fontWeight: "bold",display: "inline-block",marginTop: "10px",marginRight: "10px", // Added spacing
                          }}
                        >
                          Approved
                        </div>
                        {claimButton}
                        <div style={{ marginTop: "10px" }}>
                          {projectReviews[project._id]?.filter((review) =>
                            review.receiverId?._id === loggedInClientId
                          ).map((review) => (
                            <div
                              key={review._id}
                              style={{padding: "10px",backgroundColor: "#f5f5f5",borderRadius: "5px",marginBottom: "5px",color: "#000000",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <p>
                                  <strong>Freelancer's review:</strong> {review.comment}
                                </p>
                                <p>Rating: {review.rating}/5 ⭐</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {!hasReviewed[project._id] ? (
                          <button
                            onClick={() => {
                              setSelectedProjectForReview(project);
                              setShowReviewModal(true);
                            }}
                            style={{padding: "10px",backgroundColor: "#FFC107",color: "#000000",border: "none",borderRadius: "5px",cursor: "pointer",marginTop: "10px",
                            }}
                          >
                            Review Freelancer
                          </button>
                        ) : (
                          <span
                            style={{display: "inline-block",padding: "10px",backgroundColor: "#E6E6E6",color: "#666666",borderRadius: "5px",marginTop: "10px",
                            }}
                          >
                            Review Submitted
                          </span>
                        )}
                      </div>
                    );
                  } else if (project.completedpercentage === 100 && project.completionUrl) {
                    actionContent = (
                      <div>
                        <p
                          style={{marginTop: "10px", marginBottom: "10px", color: "#007BFF",fontWeight: "bold",
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
                        <button
                          onClick={() => handleApproveProject(project._id)}
                          style={{  padding: "10px", backgroundColor: "#28A745",color: "#FFFFFF", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold", marginRight: "10px", // Added spacing
                          }}
                        >
                          Approve Project
                        </button>
                        <button
                          onClick={() => {
                            const comments = prompt("Enter your comments for rejection:");
                            if (comments) {
                              handleRejectApproval(project._id, comments);
                            }
                          }}
                          style={{padding: "10px",backgroundColor: "#DC3545",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",fontWeight: "bold",marginRight: "10px", // Added spacing
                          }}
                        >
                          Reject Approval
                        </button>
                        {claimButton}
                      </div>
                    );
                  } else {
                    actionContent = (
                      <div>
                        <button
                          onClick={() => handleApproveProject(project._id)}
                          style={{padding: "10px",backgroundColor: "#28A745",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",fontWeight: "bold",marginRight: "10px", // Added spacing
                          }}
                        >
                          Approve Project
                        </button>
                        <button
                          onClick={() => {
                            const comments = prompt("Enter your comments for rejection:");
                            if (comments) {
                              handleRejectApproval(project._id, comments);
                            }
                          }}
                          style={{padding: "10px",backgroundColor: "#DC3545",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",fontWeight: "bold", marginRight: "10px", // Added spacing
                          }}
                        >
                          Reject Approval
                        </button>
                        {claimButton}
                      </div>
                    );
                  }
                } else {
                  // Default Actions for Other Statuses
                  actionContent = (
                    <div>
                      <button
                        onClick={() =>
                          setEditProject({
                            id: project._id,
                            budget: project.budget,
                            deadline: project.deadline.split("T")[0],
                          })
                        }
                        style={{padding: "5px 10px",backgroundColor: "#FFC107",color: "#000000",border: "none", borderRadius: "5px",cursor: "pointer",fontWeight: "bold",marginRight: "10px", // Added spacing
                        }}
                      >
                        Edit Project
                      </button>
                      <button
                        onClick={async () => {
                          handleDeleteProject(project._id);
                        }}
                        style={{padding: "5px 10px",backgroundColor: "#DC3545",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointe",frontWeight: "bold", marginRight: "10px", // Added spacing
}}
                      >
                        Delete Project
                      </button>
                      <button
                        onClick={() => fetchBidsForProject(project._id, project.title)}
                        style={{ padding: "5px 10px",backgroundColor: "#007BFF",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",fontWeight: "bold",marginRight: "10px", // Added spacing
                        }}
                      >
                        View Bids
                      </button>
                      {project.escrowStatus === "Not Funded" ? (
                        <button
                          onClick={() => handleFundEscrow(project._id, project.budget)}
                          style={{padding: "5px 10px", backgroundColor: "#E82FFF",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",fontWeight: "bold",
                          }}
                        >
                          Fund Escrow
                        </button>
                      ) : project.escrowStatus === "Funded" && project.status === "pending" ? (
                        <button
                          onClick={() => handleRefundEscrow(project._id)}
                          style={{ padding: "5px 10px",backgroundColor: "#FFC107", color: "#000000", border: "none", borderRadius: "5px",cursor: "pointer",fontWeight: "bold",
                          }}
                        >
                          Refund Escrow
                        </button>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <div
                    key={project._id}
                    style={{ border: "1px solid #ddd",padding: "10px",margin: "10px",backgroundColor: "#FFFFFF",color: "#000000",position: "relative",
                    }}
                  >
                    <div>
                      <h3>{project.title}</h3>
                      <p>{project.description}</p>
                      <p>Budget: ${project.budget}</p>
                      <p>Deadline: {new Date(project.deadline).toLocaleDateString()}</p>
                      <p>Escrow Status: {project.escrowStatus || "Not Funded"}</p>
                    </div>
                    {actionContent}
                  </div>
                );
              })
            ) : (
              <p>No projects found.</p>
            )}
          </div>
        )}
      </div>

      {editProject.id && (
        <div
          style={{position: "fixed",top: "50%",left: "50%",transform: "translate(-50%, -50%)",backgroundColor: "#FFFFFF",padding: "20px",borderRadius: "10px",boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",zIndex: 1000,width: "400px",
          }}
        >
          <h3 style={{ marginBottom: "20px", textAlign: "center" }}>Edit Project</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleEditProjectSubmit(editProject);
            }}
          >
            <div style={{ marginBottom: "10px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}>Budget:</label>
              <input
                type="number"
                value={editProject.budget}
                onChange={(e) =>
                  setEditProject((prev) => ({ ...prev, budget: e.target.value }))
                }
                placeholder="Budget"
                style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ddd",
                }}
              />
            </div>
            <div style={{ marginBottom: "10px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}>Deadline:</label>
              <input
                type="date"
                value={editProject.deadline}
                onChange={(e) =>
                  setEditProject((prev) => ({ ...prev, deadline: e.target.value }))
                }
                placeholder="Deadline"
                style={{width: "100%",padding: "10px",borderRadius: "5px",border: "1px solid #ddd",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button
                type="submit"
                style={{padding: "10px 20px",backgroundColor: "#007BFF",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",fontWeight: "bold",
                }}
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setEditProject({ id: null, budget: "", deadline: "" })}
                style={{ padding: "10px 20px", backgroundColor: "#DC3545", color: "#FFFFFF", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div>
        <h2 style={{ color: "#000000" }}>Freelancers</h2>

        <div style={{ marginBottom: "20px" }}>
          <input
            type="text"
            placeholder="Search freelancers by name, email, skills, experience, or rating"
            value={freelancerSearchQuery}
            onChange={(e) => handleFreelancerSearch(e.target.value)}
            style={{ padding: "10px", width: "100%", borderRadius: "5px", border: "1px solid #ddd", boxSizing: "border-box",
            }}
          />
        </div>

        {loadingFreelancers ? (
          <p>Loading freelancers...</p>
        ) : filteredFreelancers.length > 0 ? (
          filteredFreelancers.map((freelancer) => (
            <div
              key={freelancer._id}
              style={{border: "1px solid #ddd",padding: "10px",margin: "10px",backgroundColor: "#f9f9f9",
              }}
            >
              <h3 style={{ color: "#000000" }}>{freelancer.name || "Not Given"}</h3>
              <p style={{ color: "#000000" }}>Email: {freelancer.email || "Not Given"}</p>
              <p style={{ color: "#000000" }}>
                Skills: {freelancer.profile?.[0]?.skills?.join(", ") || "Not Provided"}
              </p>
              <p style={{ color: "#000000" }}>
                Portfolio:{" "}
                {freelancer.profile?.[0]?.portfolio ? (
                  <a
                    href={freelancer.profile[0].portfolio}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#007BFF" }}
                  >
                    View Portfolio
                  </a>
                ) : (
                  "Not Provided"
                )}
              </p>
              <p style={{ color: "#000000" }}>
                Experience: {freelancer.profile?.[0]?.experience || "Not Provided"}
              </p>
              <p style={{ color: "#000000" }}>
                Average Rating: {
                  freelancer.avgRating > 0 ? (
                    <span>
                      <span style={{ color: "#FFD700" }}>{"★".repeat(Math.round(freelancer.avgRating))}</span>
                      <span style={{ color: "#C0C0C0" }}>{"☆".repeat(5 - Math.round(freelancer.avgRating))}</span>
                      <span style={{ marginLeft: "5px" }}>{freelancer.avgRating}/5</span>
                    </span>
                  ) : "No ratings yet"
                }
              </p>
              <div style={{ 
                display: "flex", 
                justifyContent: "center",
                gap: "15px",
                marginTop: "15px" 
              }}>
                <button
                  onClick={() => handleDirectHireClick(freelancer._id)}
                  style={{padding: "10px 15px",backgroundColor: "#28A745",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",fontWeight: "bold",
                  }}
                >
                  Direct Hire
                </button>
                <button
                  onClick={() => fetchFreelancerReviews(freelancer._id, freelancer.name || "Freelancer")}
                  style={{ padding: "10px 15px", backgroundColor: "#007BFF", color: "#FFFFFF", border: "none",  borderRadius: "5px", cursor: "pointer",fontWeight: "bold",
                  }}
                >
                  View Reviews {freelancer.reviewCount > 0 ? `(${freelancer.reviewCount})` : ""}
                </button>
              </div>
            </div>
          ))
        ) : (
          <p>No freelancers found.</p>
        )}
      </div>

      {showDirectHireModal && (
        <div
          style={{position: "fixed",top: "50%",left: "50%",transform: "translate(-50%, -50%)",backgroundColor: "#FFFFFF",padding: "20px",borderRadius: "10px",  boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",  zIndex: 1000, width: "400px",color: "#000000",
          }}
        >
          <h3>Select a Project to Hire</h3>
          <div style={{ marginBottom: "20px", position: "relative" }}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{padding: "10px",backgroundColor: "#007BFF",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",width: "100%",textAlign: "left",
              }}
            >
              {selectedProjectId
                ? projects.find((project) => project._id === selectedProjectId)?.title
                : "Select a Project"}
            </button>
            {isDropdownOpen && (
              <ul
                style={{ position: "absolute", top: "100%", left: "0",width: "100%", backgroundColor: "#FFFFFF",border: "1px solid #ddd",borderRadius: "5px",listStyleType: "none",padding: "10px",margin: "0",zIndex: 1000,maxHeight: "200px",overflowY: "auto",
                }}
              >
                {projects.map((project) => (
                  <li
                    key={project._id}
                    onClick={() => {
                      setSelectedProjectId(project._id);
                      setIsDropdownOpen(false);
                    }}
                    style={{padding: "10px",cursor: "pointer",backgroundColor:selectedProjectId === project._id ? "#007BFF" : "#FFFFFF",color: selectedProjectId === project._id ? "#FFFFFF" : "#000000",borderRadius: "5px",
                    }}
                    onMouseEnter={(e) =>
                      (e.target.style.backgroundColor = "#007BFF")
                    }
                    onMouseLeave={(e) =>
                      (e.target.style.backgroundColor =
                        selectedProjectId === project._id ? "#007BFF" : "#FFFFFF")
                    }
                  >
                    {project.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={() => {
              if (selectedProjectId) {
                handleDirectHire(selectedProjectId);
              } else {
                alert("Please select a project before confirming.");
              }
            }}
            style={{marginTop: "10px", padding: "10px",backgroundColor: "#28A745",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer", width: "100%",
            }}
          >
            Confirm
          </button>
          <button
            onClick={() => setShowDirectHireModal(false)}
            style={{ marginTop: "10px",  padding: "10px", backgroundColor: "#DC3545", color: "#FFFFFF",border: "none", borderRadius: "5px",cursor: "pointer",width: "100%",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {showBidsModal && (
        <div
          style={{position: "fixed", top: "50%", left: "50%",  transform: "translate(-50%, -50%)", backgroundColor: "#FFFFFF",padding: "20px", borderRadius: "10px",boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)", zIndex: 1000, width: "600px", maxHeight: "80vh", overflowY: "auto",color: "#000000",
          }}
        >
          <h3 style={{ textAlign: "center", marginBottom: "20px" }}>
            Bids for "{selectedProjectTitle}"
          </h3>
          {bids.length > 0 ? (
            bids.map((bid) => (
              <div
                key={bid._id}
                style={{
                  borderBottom: "1px solid #ddd",
                  padding: "10px 0",
                  marginBottom: "10px",
                }}
              >
                <p>
                  <strong>Freelancer:</strong> {bid.freelancerId.name || "N/A"}
                </p>
                <p>
                  <strong>Email:</strong> {bid.freelancerId.email || "N/A"}
                </p>
                <p>
                  <strong>Average Rating:</strong>{" "}
                  {bid.freelancerId.avgRating > 0
                    ? (
                        <>
                          <span style={{ color: "#FFD700" }}>
                            {"★".repeat(Math.round(bid.freelancerId.avgRating))}
                          </span>
                          <span style={{ color: "#C0C0C0" }}>
                            {"☆".repeat(5 - Math.round(bid.freelancerId.avgRating))}
                          </span>
                          <span style={{ marginLeft: "5px" }}>
                            {bid.freelancerId.avgRating}/5
                          </span>
                        </>
                      )
                    : "No ratings yet"}
                </p>
                <p>
                  <strong>Skills:</strong>{" "}
                  {bid.freelancerId.profile?.[0]?.skills?.join(", ") || "Not Provided"}
                </p>
                <p>
                  <strong>Portfolio:</strong>{" "}
                  {bid.freelancerId.profile?.[0]?.portfolio ? (
                    <a
                      href={bid.freelancerId.profile[0].portfolio}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#007BFF" }}
                    >
                      View Portfolio
                    </a>
                  ) : (
                    "Not Provided"
                  )}
                </p>
                <p>
                  <strong>Experience:</strong>{" "}
                  {bid.freelancerId.profile?.[0]?.experience || "Not Provided"}
                </p>
                <p>
                  <strong>Bid Amount:</strong> ${bid.amount}
                </p>
                <button
                  onClick={() => handleSelectBid(bid._id)}
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
                  Select Bid
                </button>
              </div>
            ))
          ) : (
            <p style={{ textAlign: "center", color: "#555" }}>
              No bids available for this project.
            </p>
        )}
          <button
            onClick={closeBidsModal}
            style={{marginTop: "20px",padding: "10px", backgroundColor: "#DC3545", color: "#FFFFFF", border: "none", borderRadius: "5px", cursor: "pointer",width: "100%",
            }}
          >
            Close
          </button>
        </div>
      )}

      <div style={{ marginTop: "20px", textAlign: "center" }}></div>
      {showActivityHistory && (
        <div
          style={{position: "absolute", top: "100px",left: "50%", transform: "translateX(-50%)",padding: "20px",backgroundColor: "#444444", borderRadius: "10px",color: "#FFFFFF", boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",zIndex: 1000, width: "80%",
          }}
        >
          <button
            onClick={() => setShowActivityHistory(false)}
            style={{position: "absolute",top: "10px", right: "10px",backgroundColor: "#FF0000", borderRadius: "50%", border: "none", color: "#FFFFFF", fontSize: "20px", fontWeight: "bold",cursor: "pointer",
            }}
          >
            ✖
          </button>

          <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Activity History</h2>
          {activityLogs.length > 0 ? (
            activityLogs.map((log, index) => (
              <div
                key={index}
                style={{ marginBottom: "10px", padding: "10px",backgroundColor: "#333333", borderRadius: "5px",
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

      {showMyReviews && (
        <div
          style={{ position: "absolute", top: "100px",left: "50%",transform: "translateX(-50%)",padding: "20px",backgroundColor: "#444444",borderRadius: "10px",color: "#FFFFFF", boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)", zIndex: 1000, width: "80%",
          }}
        >
          <button
            onClick={() => setShowMyReviews(false)}
            style={{position: "absolute", top: "10px", right: "10px", backgroundColor: "#FF0000", borderRadius: "50%", border: "none",color: "#FFFFFF", fontSize: "20px", fontWeight: "bold",cursor: "pointer",
            }}
          >
            ✖
          </button>

          <h2 style={{ textAlign: "center", marginBottom: "20px" }}>My Reviews</h2>
          {myReviews.length > 0 ? (
            myReviews.map((review) => (
              <div
                key={review._id}
                style={{marginBottom: "20px",padding: "15px",backgroundColor: "#333333", borderRadius: "10px",boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
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

      {showFreelancerReviews && (
        <div
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", padding: "20px", backgroundColor: "#444444", borderRadius: "10px",color: "#FFFFFF",  boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",zIndex: 1000,width: "80%", maxHeight: "80vh", overflowY: "auto",
          }}
        >
          <button
            onClick={() => setShowFreelancerReviews(false)}
            style={{position: "absolute", top: "10px", right: "10px", backgroundColor: "#FF0000",borderRadius: "50%",border: "none",color: "#FFFFFF",fontSize: "20px",fontWeight: "bold", cursor: "pointer",
            }}
          >
            ✖
          </button>

          <h2 style={{ textAlign: "center", marginBottom: "10px" }}>Reviews for {selectedFreelancerName}</h2>
          
          {selectedFreelancerReviews.length > 0 ? (
            <>
              <div style={{  textAlign: "center",  marginBottom: "20px",   backgroundColor: "#333",  padding: "15px", borderRadius: "8px"
              }}>
                <h3 style={{ color: "#FFD700", marginBottom: "5px" }}>Average Rating</h3>
                <div>
                  <span style={{ fontSize: "28px", color: "#FFD700" }}>
                    {"★".repeat(Math.round(selectedFreelancerAvgRating))}
                    {"☆".repeat(5 - Math.round(selectedFreelancerAvgRating))}
                  </span>
                  <span style={{ marginLeft: "10px", color: "#FFD700", fontSize: "24px" }}>
                    {selectedFreelancerAvgRating}/5
                  </span>
                  <p style={{ marginTop: "5px" }}>
                    Based on {selectedFreelancerReviews.length} review{selectedFreelancerReviews.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              
              {selectedFreelancerReviews.map((review) => (
                <div
                  key={review._id}
                  style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#333333", borderRadius: "10px",boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
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
              ))}
            </>
          ) : (
            <p style={{ textAlign: "center", color: "#FFD700", fontSize: "18px", marginTop: "30px" }}>
              No reviews available for this freelancer.
            </p>
          )}
        </div>
      )}

      {showCompletionModal && (
        <div
          style={{position: "fixed", top: "50%", left: "50%",transform: "translate(-50%, -50%)", backgroundColor: "#FFFFFF", padding: "20px",borderRadius: "10px", boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)", zIndex: 1000, textAlign: "center",
          }}
        >
          <h3 style={{ color: "#000000", marginBottom: "10px" }}>{selectedProjectTitle}</h3>
          <p style={{ color: "#000000" }}>{`Project Completion: ${completionPercentage}%`}</p>
          <button
            onClick={() => setShowCompletionModal(false)}
            style={{ padding: "10px 20px",backgroundColor: "#007BFF",color: "#FFFFFF", border: "none",borderRadius: "5px", cursor: "pointer",fontWeight: "bold", marginTop: "10px",
            }}
          >
            OK
          </button>
        </div>
      )}

      {showPaymentForm && (
        <div
          style={{ position: "fixed",top: "50%",left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "#FFFFFF", color: "#000000", padding: "20px",borderRadius: "10px", boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",zIndex: 1000,
          }}
        >
          <h3>Complete Payment</h3>
          <form onSubmit={handlePaymentSubmit}>
            <p>Amount: ${amount}</p>
            <button
              type="submit"
              style={{padding: "10px",backgroundColor: "#007BFF", color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",
              }}
            >
              Pay Now
            </button>
          </form>
          <button
            onClick={() => setShowPaymentForm(false)}
            style={{ marginTop: "10px", padding: "10px", backgroundColor: "#DC3545", color: "#FFFFFF", border: "none", borderRadius: "5px", cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {showReviewModal && selectedProjectForReview && (
        <div
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "#FFFFFF",padding: "20px", borderRadius: "10px", boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)", zIndex: 1000, width: "500px",color: "#000000", }}
        >
          <h3 style={{ textAlign: "center", marginBottom: "20px" }}>
            Review Freelancer for "{selectedProjectForReview.title}"
          </h3>
          <form onSubmit={handleReviewSubmit}>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Rating (1-5):
              </label>
              <select
                value={reviewData.rating}
                onChange={(e) => setReviewData({ ...reviewData, rating: e.target.value })}
                style={{width: "100%", padding: "10px",  borderRadius: "5px", border: "1px solid #ddd",}}
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
                placeholder="Share your experience working with this freelancer..."
                style={{ width: "100%",padding: "10px",borderRadius: "5px",border: "1px solid #ddd",minHeight: "100px",resize: "vertical", }}
                required
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button
                type="submit"
                style={{padding: "10px 20px",backgroundColor: "#28A745",color: "#FFFFFF", border: "none", borderRadius: "5px",cursor: "pointer",fontWeight: "bold",}}
              >
                Submit Review
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReviewModal(false);
                  setSelectedProjectForReview(null);
                }}
                style={{padding: "10px 20px",backgroundColor: "#DC3545",color: "#FFFFFF",border: "none",borderRadius: "5px",cursor: "pointer",fontWeight: "bold",}}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ClientDashboard;
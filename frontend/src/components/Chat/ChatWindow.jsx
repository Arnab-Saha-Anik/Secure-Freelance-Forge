import React, { useState, useEffect, useRef, useCallback } from "react";

const ChatWindow = ({ currentUserId, currentUserToken, otherUserId, otherUserName, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);
  const hasAlertedRef = useRef(false);

  const fetchMessages = useCallback(async () => {
    if (!otherUserId) return;
    try {
      const res = await fetch(
        `http://localhost:5000/messages/conversation/${otherUserId}`,
        { headers: { Authorization: `Bearer ${currentUserToken}` } }
      );
      console.log(`[DEBUG] fetchMessages status: ${res.status} for otherUserId: ${otherUserId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      } else if (res.status === 409) {
        if (!hasAlertedRef.current) {
          alert("Data integrity violation detected! Some messages in this conversation may have been tampered with.");
          hasAlertedRef.current = true;
        }
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    } finally {
      setLoading(false);
    }
  }, [otherUserId, currentUserToken]);

  useEffect(() => {
    hasAlertedRef.current = false;
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 3000);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = newMessage.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const res = await fetch("http://localhost:5000/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUserToken}`,
        },
        body: JSON.stringify({ receiverId: otherUserId, content: trimmed }),
      });
      if (res.ok) {
        setNewMessage("");
        await fetchMessages();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to send message.");
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString();
  };

  // Group messages by date
  const grouped = [];
  let lastDate = null;
  for (const msg of messages) {
    const dateLabel = formatDate(msg.createdAt);
    if (dateLabel !== lastDate) {
      grouped.push({ type: "date", label: dateLabel });
      lastDate = dateLabel;
    }
    grouped.push({ type: "msg", ...msg });
  }

  return (
    <div style={{
      position: "fixed", bottom: 0, right: "24px", width: "360px", height: "500px",
      backgroundColor: "#1a1a2e", borderRadius: "16px 16px 0 0",
      boxShadow: "0 -4px 30px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column",
      fontFamily: "'Segoe UI', sans-serif", zIndex: 9999, overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.1)",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #6c3483, #1a5276)",
        padding: "14px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "38px", height: "38px", borderRadius: "50%",
            background: "linear-gradient(135deg, #f39c12, #e74c3c)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: "bold", fontSize: "16px", color: "#fff",
          }}>
            {otherUserName?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "14px" }}>
              {otherUserName || "Unknown User"}
            </div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "11px" }}>Online</div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%",
            width: "28px", height: "28px", color: "#fff", cursor: "pointer",
            fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >✕</button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "12px 14px",
        display: "flex", flexDirection: "column", gap: "4px",
        scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.2) transparent",
      }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", marginTop: "40px" }}>
            Loading messages...
          </div>
        ) : grouped.length === 0 ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", marginTop: "60px", fontSize: "13px" }}>
            👋 Say hello to start the conversation!
          </div>
        ) : (
          grouped.map((item, idx) => {
            if (item.type === "date") {
              return (
                <div key={`date-${idx}`} style={{
                  textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: "11px",
                  margin: "8px 0", fontWeight: 600, letterSpacing: "0.5px",
                }}>
                  — {item.label} —
                </div>
              );
            }
            const isMine = item.senderId === currentUserId;
            return (
              <div key={item._id} style={{
                display: "flex", justifyContent: isMine ? "flex-end" : "flex-start",
                marginBottom: "2px",
              }}>
                <div style={{
                  maxWidth: "78%", padding: "8px 12px", borderRadius: isMine
                    ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: isMine
                    ? "linear-gradient(135deg, #8e44ad, #6c3483)"
                    : "rgba(255,255,255,0.1)",
                  color: "#fff", fontSize: "13px", lineHeight: "1.5",
                  wordBreak: "break-word",
                }}>
                  <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.7)", marginBottom: "4px" }}>
                    {item.senderName || (isMine ? "You" : otherUserName || "Unknown")} → {item.receiverName || (isMine ? otherUserName || "Unknown" : "You")}
                  </div>
                  <div>{item.content}</div>
                  <div style={{
                    fontSize: "10px", color: "rgba(255,255,255,0.5)",
                    textAlign: "right", marginTop: "4px",
                  }}>
                    {formatTime(item.createdAt)}{isMine && (item.read ? " ✓✓" : " ✓")}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.1)",
        display: "flex", gap: "8px", flexShrink: 0, backgroundColor: "#1a1a2e",
      }}>
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          style={{
            flex: 1, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "12px", color: "#fff", fontSize: "13px", padding: "8px 12px",
            resize: "none", outline: "none", fontFamily: "inherit", lineHeight: "1.5",
            scrollbarWidth: "none",
          }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !newMessage.trim()}
          style={{
            background: sending || !newMessage.trim()
              ? "rgba(142,68,173,0.3)"
              : "linear-gradient(135deg, #8e44ad, #6c3483)",
            border: "none", borderRadius: "12px", color: "#fff", cursor: sending || !newMessage.trim()
              ? "not-allowed" : "pointer",
            padding: "8px 14px", fontSize: "16px", flexShrink: 0, transition: "all 0.2s",
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
};

export default ChatWindow;

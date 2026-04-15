import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import io from 'socket.io-client';

const API_URL = 'http://localhost:5001/api';
const SOCKET_URL = 'http://localhost:5001';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [shifts, setShifts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [newShift, setNewShift] = useState({ date: '', start_time: '', end_time: '', required_skill: '', min_staff: 1, max_staff: 3, location: '' });
  const [availDate, setAvailDate] = useState('');
  const [availSlots, setAvailSlots] = useState({});
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  // Admin Availability View
  const [allAvailability, setAllAvailability] = useState([]);
  
  // Time Tracking
  const [timeEntries, setTimeEntries] = useState([]);
  const [selectedUserTime, setSelectedUserTime] = useState(null);
  
  // Chat states
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  
  // Document states
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileDescription, setFileDescription] = useState('');
  
  // Other states
  const [swapRequests, setSwapRequests] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [stats, setStats] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [swapTargetStaff, setSwapTargetStaff] = useState('');
  const [swapReason, setSwapReason] = useState('');
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [clockedIn, setClockedIn] = useState(false);
  const [currentTimeEntry, setCurrentTimeEntry] = useState(null);

  // Helper functions
  function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  }

  // Initialize socket
  useEffect(() => {
    if (token && user) {
      const newSocket = io(SOCKET_URL);
      setSocket(newSocket);
      
      newSocket.on('connect', () => {
        newSocket.emit('user-connected', user.id);
      });
      
      newSocket.on('online-users', (users) => {
        setOnlineUsers(users);
      });
      
      newSocket.on('new-message', (message) => {
        setMessages(prev => [...prev, message]);
      });
      
      newSocket.on('message-deleted', (messageId) => {
        setMessages(prev => prev.filter(m => m.id !== messageId));
      });
      
      newSocket.on('user-typing', (data) => {
        setTypingUser(data);
        setTimeout(() => setTypingUser(null), 1000);
      });
      
      newSocket.on('new-private-message', (message) => {
        if (activeChat === message.fromUserId) {
          setPrivateMessages(prev => [...prev, message]);
        }
        toast.info(`📩 New message from ${message.fromUserName}`);
      });
      
      return () => newSocket.close();
    }
  }, [token, user]);

  useEffect(() => {
    if (token) {
      const userData = JSON.parse(localStorage.getItem('user'));
      setUser(userData);
      fetchData();
    }
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, privateMessages]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserMenu && !event.target.closest('.user-menu')) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showUserMenu]);

  const fetchData = async () => {
    await fetchShifts();
    await fetchMessages();
    await fetchDocuments();
    await fetchUsers();
    if (user?.role === 'admin') {
      await fetchSwapRequests();
      await fetchLeaveRequests();
      await fetchStaffList();
      await fetchStats();
      await fetchAllAvailability();
      await fetchTimeEntries();
    }
    await checkClockStatus();
  };

  const fetchShifts = async () => {
    try {
      const res = await axios.get(`${API_URL}/shifts`, { headers: { Authorization: `Bearer ${token}` } });
      setShifts(res.data);
    } catch (error) { console.error('Failed to fetch shifts'); }
  };

  const fetchMessages = async () => {
    try {
      const res = await axios.get(`${API_URL}/messages`, { headers: { Authorization: `Bearer ${token}` } });
      setMessages(res.data);
    } catch (error) { console.error('Failed to fetch messages'); }
  };

  const fetchDocuments = async () => {
    try {
      const res = await axios.get(`${API_URL}/documents`, { headers: { Authorization: `Bearer ${token}` } });
      setDocuments(res.data);
    } catch (error) { console.error('Failed to fetch documents'); }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } });
      setUsersList(res.data);
      setAllUsers(res.data);
    } catch (error) { console.error('Failed to fetch users'); }
  };

  const fetchAllAvailability = async () => {
    try {
      const res = await axios.get(`${API_URL}/availability/all`, { headers: { Authorization: `Bearer ${token}` } });
      setAllAvailability(res.data);
    } catch (error) { console.error('Failed to fetch all availability'); }
  };

  const fetchTimeEntries = async () => {
    try {
      const res = await axios.get(`${API_URL}/time/entries`, { headers: { Authorization: `Bearer ${token}` } });
      setTimeEntries(res.data);
    } catch (error) { console.error('Failed to fetch time entries'); }
  };

  const fetchSwapRequests = async () => {
    try {
      const res = await axios.get(`${API_URL}/swap-requests/pending`, { headers: { Authorization: `Bearer ${token}` } });
      setSwapRequests(res.data);
    } catch (error) { console.error('Failed to fetch swap requests'); }
  };

  const fetchLeaveRequests = async () => {
    try {
      const res = await axios.get(`${API_URL}/leave-requests/pending`, { headers: { Authorization: `Bearer ${token}` } });
      setLeaveRequests(res.data);
    } catch (error) { console.error('Failed to fetch leave requests'); }
  };

  const fetchStaffList = async () => {
    try {
      const res = await axios.get(`${API_URL}/staff`, { headers: { Authorization: `Bearer ${token}` } });
      setStaffList(res.data);
    } catch (error) { console.error('Failed to fetch staff list'); }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_URL}/stats`, { headers: { Authorization: `Bearer ${token}` } });
      setStats(res.data);
    } catch (error) { console.error('Failed to fetch stats'); }
  };

  const checkClockStatus = async () => {
    try {
      const res = await axios.get(`${API_URL}/time/current`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data) {
        setClockedIn(true);
        setCurrentTimeEntry(res.data);
      } else {
        setClockedIn(false);
        setCurrentTimeEntry(null);
      }
    } catch (error) { console.error('Failed to check clock status'); }
  };

  const fetchPrivateMessages = async (otherUserId) => {
    try {
      const res = await axios.get(`${API_URL}/private-messages/${otherUserId}`, { headers: { Authorization: `Bearer ${token}` } });
      setPrivateMessages(res.data);
    } catch (error) { console.error('Failed to fetch private messages'); }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const payload = isLogin ? { email, password } : { name, email, password, phone };
      const res = await axios.post(`${API_URL}${endpoint}`, payload);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
      toast.success(isLogin ? 'Welcome back!' : 'Account created!');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setShowUserMenu(false);
    toast.success('Logged out successfully');
  };

  const createShift = async (e) => {
    e.preventDefault();
    try {
      if (editingShift) {
        await axios.put(`${API_URL}/shifts/${editingShift.id}`, newShift, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Shift updated!');
      } else {
        await axios.post(`${API_URL}/shifts`, newShift, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Shift created!');
      }
      setShowForm(false);
      setEditingShift(null);
      setNewShift({ date: '', start_time: '', end_time: '', required_skill: '', min_staff: 1, max_staff: 3, location: '' });
      fetchShifts();
      fetchStats();
    } catch (error) {
      toast.error('Failed to save shift');
    }
  };

  const deleteShift = async (shiftId) => {
    if (window.confirm('Delete this shift?')) {
      try {
        await axios.delete(`${API_URL}/shifts/${shiftId}`, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Shift deleted');
        fetchShifts();
        fetchStats();
      } catch (error) {
        toast.error('Failed to delete shift');
      }
    }
  };

  const editShift = (shift) => {
    setEditingShift(shift);
    setNewShift({
      date: shift.date,
      start_time: shift.start_time,
      end_time: shift.end_time,
      required_skill: shift.required_skill || '',
      min_staff: shift.min_staff,
      max_staff: shift.max_staff,
      location: shift.location || ''
    });
    setShowForm(true);
  };

  const submitAvailability = async (slot) => {
    if (!availDate) {
      toast.error('Select a date first');
      return;
    }
    const key = `${availDate}_${slot.start}`;
    const isAvailable = !availSlots[key];
    try {
      await axios.post(`${API_URL}/availability`, {
        date: availDate,
        start_time: slot.start,
        end_time: slot.end,
        is_available: isAvailable
      }, { headers: { Authorization: `Bearer ${token}` } });
      setAvailSlots({ ...availSlots, [key]: isAvailable });
      toast.success(isAvailable ? 'Available ✓' : 'Unavailable ✗');
    } catch (error) {
      toast.error('Error');
    }
  };

  const runAutoSchedule = async (shiftId = null) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auto-schedule`, shiftId ? { shiftId } : {}, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(response.data.message);
      fetchShifts();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Auto-schedule failed');
    } finally {
      setLoading(false);
    }
  };

  const manualAssignStaff = async (shiftId, staffId) => {
    try {
      await axios.post(`${API_URL}/shifts/${shiftId}/assign`, { staffId }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Staff assigned successfully!');
      fetchShifts();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Assignment failed');
    }
  };

  const exportToExcel = () => {
    import('xlsx').then((XLSX) => {
      const exportData = shifts.map(shift => ({
        'Date': shift.date,
        'Start Time': shift.start_time,
        'End Time': shift.end_time,
        'Location': shift.location || 'Main Store',
        'Required Skill': shift.required_skill || 'General',
        'Min Staff': shift.min_staff,
        'Max Staff': shift.max_staff,
        'Assigned Staff': shift.assigned_staff?.map(s => s.name).join(', ') || 'Not Assigned',
        'Status': (shift.assigned_staff?.length || 0) >= shift.min_staff ? '✓ Filled' : '⚠️ Needs Staff'
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [{wch:12}, {wch:10}, {wch:10}, {wch:15}, {wch:15}, {wch:8}, {wch:8}, {wch:30}, {wch:12}];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Shifts');
      XLSX.writeFile(wb, `shifts_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`Exported ${shifts.length} shifts!`);
    }).catch(() => toast.error('Export failed'));
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    if (socket) {
      if (activeChat) {
        socket.emit('send-private-message', {
          fromUserId: user.id,
          fromUserName: user.name,
          toUserId: activeChat,
          message: newMessage
        });
        setPrivateMessages(prev => [...prev, {
          id: Date.now(),
          fromUserId: user.id,
          fromUserName: user.name,
          toUserId: activeChat,
          message: newMessage,
          timestamp: new Date().toISOString()
        }]);
      } else {
        socket.emit('send-message', {
          userId: user.id,
          userName: user.name,
          message: newMessage
        });
      }
      setNewMessage('');
    }
  };

  const deleteMessage = (messageId) => {
    if (window.confirm('Delete this message?')) {
      if (socket) {
        socket.emit('delete-message', { messageId });
      }
    }
  };

  const handleTyping = () => {
    if (socket) {
      socket.emit('typing', { userId: user.id, userName: user.name });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {}, 1000);
    }
  };

  const startPrivateChat = (otherUser) => {
    setActiveChat(otherUser.id);
    fetchPrivateMessages(otherUser.id);
  };

  // Make a phone call using device's native dialer
  const makePhoneCall = (phoneNumber) => {
    if (!phoneNumber) {
      toast.error('No phone number available for this user');
      return;
    }
    window.location.href = `tel:${phoneNumber}`;
  };

  // Make a video call using device's native app
  const makeVideoCall = (phoneNumber) => {
    if (!phoneNumber) {
      toast.error('No phone number available for this user');
      return;
    }
    // Try WhatsApp video call first, fallback to FaceTime/Google Meet
    window.location.href = `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}`;
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Select a file');
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('description', fileDescription);
    try {
      const res = await axios.post(`${API_URL}/documents/upload`, formData, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
      toast.success('File uploaded!');
      setDocuments([...documents, res.data]);
      setSelectedFile(null);
      setFileDescription('');
      document.getElementById('fileInput').value = '';
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (docId) => {
    if (window.confirm('Delete this document?')) {
      try {
        await axios.delete(`${API_URL}/documents/${docId}`, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Document deleted');
        setDocuments(documents.filter(d => d.id !== docId));
      } catch (error) {
        toast.error('Delete failed');
      }
    }
  };

  const handleSwapRequest = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/swap-requests`, {
        shift_id: selectedShift.id,
        target_user_id: parseInt(swapTargetStaff),
        reason: swapReason
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Swap request sent!');
      setShowSwapModal(false);
      setSwapTargetStaff('');
      setSwapReason('');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send swap request');
    }
  };

  const handleLeaveRequest = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/leave-requests`, {
        start_date: leaveStart,
        end_date: leaveEnd,
        reason: leaveReason
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Leave request sent!');
      setShowLeaveModal(false);
      setLeaveStart('');
      setLeaveEnd('');
      setLeaveReason('');
    } catch (error) {
      toast.error('Failed to send leave request');
    }
  };

  const handleApproveSwap = async (id) => {
    try {
      await axios.put(`${API_URL}/swap-requests/${id}`, { status: 'approved' }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Swap approved!');
      fetchSwapRequests();
      fetchShifts();
    } catch (error) {
      toast.error('Failed to approve swap');
    }
  };

  const handleDenySwap = async (id) => {
    try {
      await axios.put(`${API_URL}/swap-requests/${id}`, { status: 'denied' }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Swap denied');
      fetchSwapRequests();
    } catch (error) {
      toast.error('Failed to deny swap');
    }
  };

  const handleApproveLeave = async (id) => {
    try {
      await axios.put(`${API_URL}/leave-requests/${id}`, { status: 'approved' }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Leave approved!');
      fetchLeaveRequests();
    } catch (error) {
      toast.error('Failed to approve leave');
    }
  };

  const handleDenyLeave = async (id) => {
    try {
      await axios.put(`${API_URL}/leave-requests/${id}`, { status: 'denied' }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Leave denied');
      fetchLeaveRequests();
    } catch (error) {
      toast.error('Failed to deny leave');
    }
  };

  const handleClockIn = async () => {
    try {
      const res = await axios.post(`${API_URL}/time/clock-in`, {}, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Clocked in!');
      setClockedIn(true);
      setCurrentTimeEntry(res.data);
      if (user?.role === 'admin') fetchTimeEntries();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to clock in');
    }
  };

  const handleClockOut = async () => {
    try {
      const res = await axios.post(`${API_URL}/time/clock-out`, {}, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`Clocked out! Duration: ${res.data.duration} hours`);
      setClockedIn(false);
      setCurrentTimeEntry(null);
      if (user?.role === 'admin') fetchTimeEntries();
      fetchStats();
    } catch (error) {
      toast.error('Failed to clock out');
    }
  };

  const updateUserRole = async (userId, role) => {
    try {
      await axios.put(`${API_URL}/users/${userId}/role`, { role }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('User role updated');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  const deleteUser = async (userId) => {
    if (window.confirm('Delete this user?')) {
      try {
        await axios.delete(`${API_URL}/users/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('User deleted');
        fetchUsers();
        fetchStats();
      } catch (error) {
        toast.error('Failed to delete user');
      }
    }
  };

  // Format duration
  const formatDuration = (hours) => {
    if (!hours) return '--';
    const hrs = Math.floor(hours);
    const mins = Math.round((hours - hrs) * 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🏢</div>
            <h1 className="text-3xl font-bold text-gray-800">ShiftFlow Pro</h1>
            <p className="text-gray-500 mt-2">Enterprise Staff Management Platform</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <>
                <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                <input type="tel" placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </>
            )}
            <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:opacity-90 transition">
              {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>
          <button onClick={() => setIsLogin(!isLogin)} className="w-full mt-4 text-sm text-blue-600 hover:text-blue-700">
            {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
          </button>
          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 text-center">Demo: admin@example.com / admin123</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      
      {/* Navigation */}
      <nav className="bg-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🏢</span>
                <span className="font-bold text-xl text-gray-800">ShiftFlow<span className="text-blue-600">Pro</span></span>
              </div>
              <div className="flex space-x-1">
                {['dashboard', 'availability', 'admin-availability', 'time-tracking', 'chat', 'documents', 'admin'].filter(v => {
                  if ((v === 'admin' || v === 'admin-availability' || v === 'time-tracking') && user?.role !== 'admin') return false;
                  return true;
                }).map(v => (
                  <button key={v} onClick={() => { setView(v); if (v !== 'chat') setActiveChat(null); }} className={`px-4 py-2 rounded-lg transition ${view === v ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}>
                    {v === 'dashboard' && '📊 Dashboard'}
                    {v === 'availability' && '✅ My Availability'}
                    {v === 'admin-availability' && '👥 Staff Availability'}
                    {v === 'time-tracking' && '⏰ Time Tracking'}
                    {v === 'chat' && '💬 Chat'}
                    {v === 'documents' && '📄 Documents'}
                    {v === 'admin' && '⚙️ Admin'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-sm text-gray-600">{onlineUsers.length} online</span>
              </div>
              {currentTimeEntry ? (
                <div className="flex items-center space-x-2 bg-yellow-100 px-3 py-1 rounded-full">
                  <span className="text-sm text-yellow-600">⏰ Clocked in at {new Date(currentTimeEntry.clock_in).toLocaleTimeString()}</span>
                </div>
              ) : null}
              <button onClick={clockedIn ? handleClockOut : handleClockIn} className={`px-3 py-1 rounded-full text-sm ${clockedIn ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                {clockedIn ? '⏰ Clock Out' : '⏰ Clock In'}
              </button>
              
              {/* Stable User Menu */}
              <div className="relative user-menu">
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded-full hover:bg-gray-200 transition"
                >
                  <span>👤</span>
                  <span>{user?.name}</span>
                  <span className="text-xs">▼</span>
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border z-50">
                    <div className="px-4 py-3 border-b bg-gray-50">
                      <p className="text-sm font-medium">{user?.name}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                      {user?.phone && <p className="text-xs text-gray-500 mt-1">📞 {user?.phone}</p>}
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100 rounded-lg flex items-center gap-2"
                    >
                      <span>🚪</span> Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Dashboard View */}
        {view === 'dashboard' && (
          <div>
            {user?.role === 'admin' && stats && (
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
                <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-blue-500"><p className="text-2xl font-bold text-blue-600">{stats.totalStaff}</p><p className="text-sm text-gray-500">Staff Members</p></div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-500"><p className="text-2xl font-bold text-green-600">{stats.totalShifts}</p><p className="text-sm text-gray-500">Total Shifts</p></div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-emerald-500"><p className="text-2xl font-bold text-emerald-600">{stats.filledShifts}</p><p className="text-sm text-gray-500">Filled Shifts</p></div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-orange-500"><p className="text-2xl font-bold text-orange-600">{stats.pendingSwaps}</p><p className="text-sm text-gray-500">Pending Swaps</p></div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-purple-500"><p className="text-2xl font-bold text-purple-600">{stats.pendingLeave}</p><p className="text-sm text-gray-500">Leave Requests</p></div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-indigo-500"><p className="text-2xl font-bold text-indigo-600">{stats.currentlyClockedIn || 0}</p><p className="text-sm text-gray-500">Currently Working</p></div>
              </div>
            )}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">📋 Upcoming Shifts</h2>
              <button onClick={exportToExcel} className="bg-emerald-500 text-white px-4 py-2 rounded-xl hover:bg-emerald-600 transition flex items-center gap-2">📊 Export to Excel</button>
            </div>
            <div className="space-y-3">
              {shifts.length > 0 ? shifts.map(shift => (
                <div key={shift.id} className="bg-white p-5 rounded-2xl shadow-sm hover:shadow-md transition border-l-4 border-blue-500">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg font-semibold">{shift.date}</span>
                        <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-lg text-sm">{shift.start_time} - {shift.end_time}</span>
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-sm">📍 {shift.location || 'Main Store'}</span>
                      </div>
                      <p className="text-gray-600 text-sm">Skill: {shift.required_skill || 'General'} | Need: {shift.min_staff}-{shift.max_staff} staff</p>
                      {shift.assigned_staff?.length > 0 && <div className="mt-2 text-sm text-green-600">✅ Assigned: {shift.assigned_staff.map(s => s.name).join(', ')}</div>}
                    </div>
                    <div className="flex gap-2">
                      {user?.role === 'admin' && (
                        <>
                          <button onClick={() => editShift(shift)} className="text-blue-500 hover:text-blue-600">✏️</button>
                          <button onClick={() => deleteShift(shift.id)} className="text-red-500 hover:text-red-600">🗑️</button>
                          <button onClick={() => runAutoSchedule(shift.id)} className="text-green-500 hover:text-green-600 text-sm">🤖 Auto-Assign</button>
                        </>
                      )}
                      {user?.role === 'staff' && shift.assigned_staff?.some(s => s.user_id === user.id) && (
                        <button onClick={() => { setSelectedShift(shift); setShowSwapModal(true); }} className="text-orange-500 text-sm hover:text-orange-600">🔄 Request Swap</button>
                      )}
                    </div>
                  </div>
                </div>
              )) : <div className="bg-white p-12 rounded-2xl text-center text-gray-400">No shifts available</div>}
            </div>
          </div>
        )}

        {/* My Availability View */}
        {view === 'availability' && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-2xl font-bold mb-6">✅ Set Your Availability</h2>
            {user?.role === 'staff' && (
              <button onClick={() => setShowLeaveModal(true)} className="mb-4 bg-purple-500 text-white px-4 py-2 rounded-xl hover:bg-purple-600 transition">📅 Request Time Off</button>
            )}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Select Date</label>
              <input type="date" value={availDate} onChange={(e) => setAvailDate(e.target.value)} className="px-4 py-2 border rounded-xl" />
            </div>
            {availDate && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[{ start: '09:00', end: '13:00', label: '🌅 Morning', time: '9AM - 1PM' }, { start: '13:00', end: '17:00', label: '☀️ Afternoon', time: '1PM - 5PM' }, { start: '17:00', end: '21:00', label: '🌙 Evening', time: '5PM - 9PM' }].map(slot => {
                  const key = `${availDate}_${slot.start}`;
                  const isAvailable = availSlots[key];
                  return (
                    <button key={slot.start} onClick={() => submitAvailability(slot)} className={`p-6 rounded-xl border-2 transition-all ${isAvailable ? 'bg-green-50 border-green-500' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                      <div className="text-center"><div className="text-2xl mb-2">{slot.label}</div><div className="text-sm text-gray-500">{slot.time}</div><div className="mt-2 font-medium">{isAvailable ? '✓ Available' : '✗ Unavailable'}</div></div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Admin Availability View */}
        {view === 'admin-availability' && user?.role === 'admin' && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-2xl font-bold mb-4">👥 Staff Availability Overview</h2>
            <p className="text-gray-500 mb-6">View when each staff member is available and assign them to shifts</p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">Staff Member</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Available Time</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allAvailability.length > 0 ? allAvailability.map(avail => (
                    <tr key={avail.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{avail.user_name}</td>
                      <td className="px-4 py-3">{avail.date}</td>
                      <td className="px-4 py-3">{avail.start_time} - {avail.end_time}</td>
                      <td className="px-4 py-3">
                        {avail.is_available ? <span className="bg-green-100 text-green-600 px-2 py-1 rounded-full text-sm">✅ Available</span> : <span className="bg-red-100 text-red-600 px-2 py-1 rounded-full text-sm">❌ Unavailable</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button 
                          onClick={() => {
                            const shift = shifts.find(s => s.date === avail.date);
                            if (shift) {
                              manualAssignStaff(shift.id, avail.user_id);
                            } else {
                              toast.error('No matching shift found for this date');
                            }
                          }}
                          className="bg-blue-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-600"
                        >
                          📌 Assign to Shift
                        </button>
                      </td>
                    </tr>
                  )) : <tr><td colSpan="5" className="text-center py-8 text-gray-400">No availability data yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Time Tracking View - Admin */}
        {view === 'time-tracking' && user?.role === 'admin' && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-2xl font-bold mb-4">⏰ Staff Time Tracking</h2>
            <p className="text-gray-500 mb-6">Monitor clock-in/out times and work hours</p>
            
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-xl">
                <p className="text-2xl font-bold text-blue-600">{timeEntries.filter(t => !t.clock_out).length}</p>
                <p className="text-sm text-gray-600">Currently Clocked In</p>
              </div>
              <div className="bg-green-50 p-4 rounded-xl">
                <p className="text-2xl font-bold text-green-600">{timeEntries.length}</p>
                <p className="text-sm text-gray-600">Total Clock-ins Today</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-xl">
                <p className="text-2xl font-bold text-purple-600">{stats?.todayHours || 0}</p>
                <p className="text-sm text-gray-600">Total Hours Today</p>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">Staff Member</th>
                    <th className="px-4 py-3 text-left">Clock In</th>
                    <th className="px-4 py-3 text-left">Clock Out</th>
                    <th className="px-4 py-3 text-left">Duration</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {timeEntries.length > 0 ? timeEntries.map(entry => (
                    <tr key={entry.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{entry.user_name}</td>
                      <td className="px-4 py-3 text-sm">{new Date(entry.clock_in).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm">{entry.clock_out ? new Date(entry.clock_out).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 text-sm">{entry.duration ? formatDuration(entry.duration) : '—'}</td>
                      <td className="px-4 py-3">
                        {!entry.clock_out ? 
                          <span className="bg-green-100 text-green-600 px-2 py-1 rounded-full text-sm">🟢 Working</span> : 
                          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-sm">⚫ Completed</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => makePhoneCall(entry.user_phone)}
                            className="bg-green-500 text-white px-2 py-1 rounded text-sm hover:bg-green-600"
                            title="Call"
                          >
                            📞 Call
                          </button>
                          <button 
                            onClick={() => makeVideoCall(entry.user_phone)}
                            className="bg-blue-500 text-white px-2 py-1 rounded text-sm hover:bg-blue-600"
                            title="Video Call"
                          >
                            🎥 Video
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : <tr><td colSpan="6" className="text-center py-8 text-gray-400">No time entries yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Chat View */}
        {view === 'chat' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px]">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-gray-50"><h3 className="font-semibold">💬 Conversations</h3></div>
              <div className="overflow-y-auto h-[540px]">
                <button onClick={() => setActiveChat(null)} className={`w-full text-left p-3 hover:bg-gray-50 transition ${!activeChat ? 'bg-blue-50 border-r-4 border-blue-500' : ''}`}>
                  <div className="flex items-center gap-3"><span className="text-2xl">💬</span><div><p className="font-medium">General Channel</p><p className="text-xs text-gray-500">Team discussions</p></div></div>
                </button>
                {allUsers.filter(u => u.id !== user?.id).map(other => (
                  <button key={other.id} onClick={() => startPrivateChat(other)} className={`w-full text-left p-3 hover:bg-gray-50 transition ${activeChat === other.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">👤</span>
                        <div>
                          <p className="font-medium">{other.name}</p>
                          <p className="text-xs text-gray-500">{onlineUsers.includes(other.id) ? '🟢 Online' : '⚫ Offline'}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {other.phone && (
                          <>
                            <button 
                              onClick={(e) => { e.stopPropagation(); makePhoneCall(other.phone); }}
                              className="text-green-500 text-sm p-1 hover:bg-green-50 rounded"
                              title="Call"
                            >
                              📞
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); makeVideoCall(other.phone); }}
                              className="text-blue-500 text-sm p-1 hover:bg-blue-50 rounded"
                              title="Video Call"
                            >
                              🎥
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2 bg-white rounded-2xl shadow-sm flex flex-col">
              <div className="p-4 border-b bg-gray-50">
                <h3 className="font-semibold">{activeChat ? allUsers.find(u => u.id === activeChat)?.name || 'User' : 'General Channel'}</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(activeChat ? privateMessages : messages).map(msg => (
                  <div key={msg.id} className={`flex ${msg.fromUserId === user?.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl p-3 ${msg.fromUserId === user?.id ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'}`}>
                      {msg.fromUserId !== user?.id && <p className="text-xs font-bold mb-1">{msg.fromUserName}</p>}
                      <p>{msg.message}</p>
                      <p className="text-xs mt-1 opacity-70">{new Date(msg.timestamp).toLocaleTimeString()}</p>
                    </div>
                    {msg.fromUserId === user?.id && (
                      <button onClick={() => deleteMessage(msg.id)} className="ml-2 text-gray-400 hover:text-red-500">🗑️</button>
                    )}
                  </div>
                ))}
                {typingUser && !activeChat && <p className="text-sm text-gray-400 italic">{typingUser.userName} is typing...</p>}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={sendMessage} className="p-4 border-t flex gap-2">
                <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyUp={handleTyping} placeholder="Type a message..." className="flex-1 px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="submit" className="bg-blue-500 text-white px-6 py-2 rounded-xl hover:bg-blue-600 transition">Send</button>
              </form>
            </div>
          </div>
        )}

        {/* Documents View */}
        {view === 'documents' && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-2xl font-bold mb-6">📄 Document Sharing</h2>
            <form onSubmit={handleFileUpload} className="mb-8 p-4 bg-gray-50 rounded-xl">
              <h3 className="font-semibold mb-3">Upload New Document</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input type="file" id="fileInput" onChange={(e) => setSelectedFile(e.target.files[0])} className="p-2 border rounded" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png,.txt" />
                <input type="text" placeholder="Description" value={fileDescription} onChange={(e) => setFileDescription(e.target.value)} className="p-2 border rounded" />
                <button type="submit" disabled={uploading} className="bg-blue-500 text-white px-4 py-2 rounded-xl hover:bg-blue-600 disabled:opacity-50">📤 Upload</button>
              </div>
            </form>
            <div className="space-y-3">
              {documents.length === 0 ? <p className="text-gray-400 text-center py-8">No documents uploaded</p> : documents.map(doc => (
                <div key={doc.id} className="border rounded-xl p-4 flex justify-between items-center">
                  <div><p className="font-medium">{doc.originalName}</p><p className="text-sm text-gray-500">By {doc.userName} • {(doc.fileSize / 1024).toFixed(2)} KB</p>{doc.description && <p className="text-sm text-gray-600">{doc.description}</p>}</div>
                  <div className="flex gap-2"><a href={doc.downloadUrl} download className="bg-green-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-600">Download</a>{(user?.role === 'admin' || doc.userId === user?.id) && <button onClick={() => deleteDocument(doc.id)} className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-red-600">Delete</button>}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin View */}
        {view === 'admin' && user?.role === 'admin' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">⚙️ Admin Control Center</h2>
              <div className="flex gap-3">
                <button onClick={exportToExcel} className="bg-emerald-500 text-white px-4 py-2 rounded-xl hover:bg-emerald-600">📊 Export</button>
                <button onClick={() => runAutoSchedule()} disabled={loading} className="bg-green-500 text-white px-4 py-2 rounded-xl hover:bg-green-600 disabled:opacity-50">🤖 Auto-Schedule All</button>
                <button onClick={() => { setEditingShift(null); setNewShift({ date: '', start_time: '', end_time: '', required_skill: '', min_staff: 1, max_staff: 3, location: '' }); setShowForm(true); }} className="bg-blue-500 text-white px-4 py-2 rounded-xl hover:bg-blue-600">+ New Shift</button>
              </div>
            </div>

            {/* Pending Requests */}
            {(swapRequests.length > 0 || leaveRequests.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {swapRequests.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm p-4">
                    <h3 className="font-semibold mb-3">🔄 Swap Requests ({swapRequests.length})</h3>
                    {swapRequests.map(req => (
                      <div key={req.id} className="border-b py-2">
                        <p><strong>{req.from_user_name}</strong> → {req.to_user_name}</p>
                        <p className="text-sm text-gray-500">{req.from_shift?.date} {req.from_shift?.start_time}-{req.from_shift?.end_time}</p>
                        {req.reason && <p className="text-sm text-gray-400">Reason: {req.reason}</p>}
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => handleApproveSwap(req.id)} className="bg-green-500 text-white px-2 py-1 rounded text-sm">✓ Approve</button>
                          <button onClick={() => handleDenySwap(req.id)} className="bg-red-500 text-white px-2 py-1 rounded text-sm">✗ Deny</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {leaveRequests.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm p-4">
                    <h3 className="font-semibold mb-3">📅 Leave Requests ({leaveRequests.length})</h3>
                    {leaveRequests.map(req => (
                      <div key={req.id} className="border-b py-2">
                        <p><strong>{req.user_name}</strong> - {req.start_date} to {req.end_date}</p>
                        {req.reason && <p className="text-sm text-gray-400">Reason: {req.reason}</p>}
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => handleApproveLeave(req.id)} className="bg-green-500 text-white px-2 py-1 rounded text-sm">✓ Approve</button>
                          <button onClick={() => handleDenyLeave(req.id)} className="bg-red-500 text-white px-2 py-1 rounded text-sm">✗ Deny</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Users Table */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-8">
              <div className="p-4 border-b bg-gray-50"><h3 className="font-semibold">👥 User Management</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Email</th><th className="px-4 py-3 text-left">Phone</th><th className="px-4 py-3 text-left">Role</th><th className="px-4 py-3 text-left">Actions</th></tr>
                  </thead>
                  <tbody>
                    {usersList.map(u => (
                      <tr key={u.id} className="border-t">
                        <td className="px-4 py-3">{u.name}</td>
                        <td className="px-4 py-3">{u.email}</td>
                        <td className="px-4 py-3">{u.phone || '-'}</td>
                        <td className="px-4 py-3">
                          <select value={u.role} onChange={(e) => updateUserRole(u.id, e.target.value)} className="border rounded px-2 py-1">
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {u.phone && (
                              <>
                                <button onClick={() => makePhoneCall(u.phone)} className="text-green-500 hover:text-green-600" title="Call">📞</button>
                                <button onClick={() => makeVideoCall(u.phone)} className="text-blue-500 hover:text-blue-600" title="Video Call">🎥</button>
                              </>
                            )}
                            {u.id !== user?.id && <button onClick={() => deleteUser(u.id)} className="text-red-500 hover:text-red-600">Delete</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Shifts Table */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-gray-50"><h3 className="font-semibold">📋 All Shifts</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Time</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Assigned</th></tr></thead>
                  <tbody>{shifts.map(s => (<tr key={s.id} className="border-t"><td className="px-4 py-2">{s.date}</td><td className="px-4 py-2">{s.start_time}-{s.end_time}</td><td className="px-4 py-2">{s.location || '-'}</td><td className="px-4 py-2">{s.assigned_staff?.map(st => st.name).join(', ') || 'Not assigned'}</td></tr>))}</tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">{editingShift ? 'Edit Shift' : 'New Shift'}</h3>
            <form onSubmit={createShift} className="space-y-3">
              <input type="date" value={newShift.date} onChange={(e) => setNewShift({...newShift, date: e.target.value})} className="w-full p-2 border rounded" required />
              <div className="grid grid-cols-2 gap-2">
                <input type="time" value={newShift.start_time} onChange={(e) => setNewShift({...newShift, start_time: e.target.value})} className="p-2 border rounded" required />
                <input type="time" value={newShift.end_time} onChange={(e) => setNewShift({...newShift, end_time: e.target.value})} className="p-2 border rounded" required />
              </div>
              <input type="text" placeholder="Location" value={newShift.location} onChange={(e) => setNewShift({...newShift, location: e.target.value})} className="w-full p-2 border rounded" />
              <input type="text" placeholder="Required Skill" value={newShift.required_skill} onChange={(e) => setNewShift({...newShift, required_skill: e.target.value})} className="w-full p-2 border rounded" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder="Min Staff" value={newShift.min_staff} onChange={(e) => setNewShift({...newShift, min_staff: parseInt(e.target.value)})} className="p-2 border rounded" min="1" required />
                <input type="number" placeholder="Max Staff" value={newShift.max_staff} onChange={(e) => setNewShift({...newShift, max_staff: parseInt(e.target.value)})} className="p-2 border rounded" min="1" required />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowForm(false); setEditingShift(null); }} className="flex-1 bg-gray-300 py-2 rounded">Cancel</button>
                <button type="submit" className="flex-1 bg-blue-500 text-white py-2 rounded">{editingShift ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSwapModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Request Shift Swap</h3>
            <form onSubmit={handleSwapRequest}>
              <p className="text-sm text-gray-600 mb-3">Shift: {selectedShift?.date} {selectedShift?.start_time}-{selectedShift?.end_time}</p>
              <select value={swapTargetStaff} onChange={(e) => setSwapTargetStaff(e.target.value)} className="w-full p-2 border rounded mb-3" required>
                <option value="">Select staff</option>
                {staffList.filter(s => s.id !== user?.id).map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
              <textarea placeholder="Reason" value={swapReason} onChange={(e) => setSwapReason(e.target.value)} className="w-full p-2 border rounded mb-3" rows="2" />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowSwapModal(false)} className="flex-1 bg-gray-300 py-2 rounded">Cancel</button>
                <button type="submit" className="flex-1 bg-blue-500 text-white py-2 rounded">Send</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLeaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Request Time Off</h3>
            <form onSubmit={handleLeaveRequest}>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input type="date" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} className="w-full p-2 border rounded mb-3" required />
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input type="date" value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} className="w-full p-2 border rounded mb-3" required />
              <textarea placeholder="Reason" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} className="w-full p-2 border rounded mb-3" rows="2" />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowLeaveModal(false)} className="flex-1 bg-gray-300 py-2 rounded">Cancel</button>
                <button type="submit" className="flex-1 bg-blue-500 text-white py-2 rounded">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
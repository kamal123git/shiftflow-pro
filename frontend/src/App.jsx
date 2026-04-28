import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import io from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5001';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Chat states
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
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
  const [timeEntries, setTimeEntries] = useState([]);
  const [allAvailability, setAllAvailability] = useState([]);

  // Helper functions
  function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  }

  // Initialize socket connection
  useEffect(() => {
    if (token && user) {
      console.log('Connecting to socket...');
      const newSocket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
      });
      
      newSocket.on('connect', () => {
        console.log('Socket connected!');
        setSocketConnected(true);
        newSocket.emit('user-connected', user.id);
      });
      
      newSocket.on('disconnect', () => {
        console.log('Socket disconnected');
        setSocketConnected(false);
      });
      
      newSocket.on('online-users', (users) => {
        console.log('Online users:', users);
        setOnlineUsers(users || []);
      });
      
      newSocket.on('new-message', (message) => {
        console.log('New message:', message);
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
      
      setSocket(newSocket);
      
      return () => {
        newSocket.disconnect();
      };
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
      setMessages(res.data || []);
    } catch (error) { console.error('Failed to fetch messages'); }
  };

  const fetchDocuments = async () => {
    try {
      const res = await axios.get(`${API_URL}/documents`, { headers: { Authorization: `Bearer ${token}` } });
      setDocuments(res.data || []);
    } catch (error) { console.error('Failed to fetch documents'); }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } });
      setUsersList(res.data || []);
      setAllUsers(res.data || []);
    } catch (error) { console.error('Failed to fetch users'); }
  };

  const fetchAllAvailability = async () => {
    try {
      const res = await axios.get(`${API_URL}/availability/all`, { headers: { Authorization: `Bearer ${token}` } });
      setAllAvailability(res.data || []);
    } catch (error) { console.error('Failed to fetch all availability'); }
  };

  const fetchTimeEntries = async () => {
    try {
      const res = await axios.get(`${API_URL}/time/entries`, { headers: { Authorization: `Bearer ${token}` } });
      setTimeEntries(res.data || []);
    } catch (error) { console.error('Failed to fetch time entries'); }
  };

  const fetchSwapRequests = async () => {
    try {
      const res = await axios.get(`${API_URL}/swap-requests/pending`, { headers: { Authorization: `Bearer ${token}` } });
      setSwapRequests(res.data || []);
    } catch (error) { console.error('Failed to fetch swap requests'); }
  };

  const fetchLeaveRequests = async () => {
    try {
      const res = await axios.get(`${API_URL}/leave-requests/pending`, { headers: { Authorization: `Bearer ${token}` } });
      setLeaveRequests(res.data || []);
    } catch (error) { console.error('Failed to fetch leave requests'); }
  };

  const fetchStaffList = async () => {
    try {
      const res = await axios.get(`${API_URL}/staff`, { headers: { Authorization: `Bearer ${token}` } });
      setStaffList(res.data || []);
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
      setPrivateMessages(res.data || []);
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
    if (socket) {
      socket.disconnect();
    }
    setToken(null);
    setUser(null);
    toast.success('Logged out');
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
    if (socket && socketConnected) {
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
    } else {
      toast.error('Not connected to chat server');
    }
  };

  const deleteMessage = (messageId) => {
    if (window.confirm('Delete this message?')) {
      if (socket && socketConnected) {
        socket.emit('delete-message', { messageId });
      }
    }
  };

  const handleTyping = () => {
    if (socket && socketConnected) {
      socket.emit('typing', { userId: user.id, userName: user.name });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {}, 1000);
    }
  };

  const startPrivateChat = (otherUser) => {
    setActiveChat(otherUser.id);
    fetchPrivateMessages(otherUser.id);
    if (window.innerWidth < 768) setMobileMenuOpen(false);
  };

  const makePhoneCall = (phoneNumber) => {
    if (!phoneNumber) {
      toast.error('No phone number available');
      return;
    }
    window.location.href = `tel:${phoneNumber}`;
  };

  const makeVideoCall = (phoneNumber) => {
    if (!phoneNumber) {
      toast.error('No phone number available');
      return;
    }
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanNumber}`, '_blank');
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

  const formatDuration = (hours) => {
    if (!hours) return '--';
    const hrs = Math.floor(hours);
    const mins = Math.round((hours - hrs) * 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  // Navigation items
  const navItems = [
    { id: 'dashboard', label: '📊 Dashboard', adminOnly: false },
    { id: 'availability', label: '✅ Availability', adminOnly: false },
    { id: 'chat', label: '💬 Chat', adminOnly: false },
    { id: 'documents', label: '📄 Documents', adminOnly: false },
  ];

  if (user?.role === 'admin') {
    navItems.push({ id: 'admin-availability', label: '👥 Staff Availability', adminOnly: true });
    navItems.push({ id: 'time-tracking', label: '⏰ Time Tracking', adminOnly: true });
    navItems.push({ id: 'admin', label: '⚙️ Admin', adminOnly: true });
  }

  const visibleNavItems = navItems.filter(item => !item.adminOnly || user?.role === 'admin');

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md">
          <div className="text-center mb-6 sm:mb-8">
            <div className="text-4xl sm:text-5xl mb-3">🏢</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">ShiftFlow Pro</h1>
            <p className="text-gray-500 mt-2 text-sm sm:text-base">Staff Management Platform</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <>
                <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 border rounded-xl" required />
                <input type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-3 border rounded-xl" />
              </>
            )}
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 border rounded-xl" required />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border rounded-xl" required />
            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-semibold">
              {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>
          <button onClick={() => setIsLogin(!isLogin)} className="w-full mt-4 text-sm text-blue-600">
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
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      <Toaster position="top-right" />
      
      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50 md:hidden">
        <div className="flex justify-around items-center py-2">
          {visibleNavItems.slice(0, 4).map(item => (
            <button key={item.id} onClick={() => { setView(item.id); setActiveChat(null); }} className={`flex flex-col items-center p-2 rounded-lg ${view === item.id ? 'text-blue-600' : 'text-gray-500'}`}>
              <span className="text-xl">{item.label.split(' ')[0]}</span>
              <span className="text-xs mt-1">{item.label.split(' ')[1] || ''}</span>
            </button>
          ))}
          {visibleNavItems.length > 4 && (
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="flex flex-col items-center p-2 rounded-lg text-gray-500">
              <span className="text-xl">☰</span>
              <span className="text-xs mt-1">More</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile More Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute bottom-16 left-0 right-0 bg-white rounded-t-2xl p-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">More Options</h3>
              <button onClick={() => setMobileMenuOpen(false)} className="text-gray-500">✕</button>
            </div>
            <div className="space-y-2">
              {visibleNavItems.slice(4).map(item => (
                <button key={item.id} onClick={() => { setView(item.id); setActiveChat(null); setMobileMenuOpen(false); }} className="w-full text-left p-3 rounded-lg hover:bg-gray-100">
                  {item.label}
                </button>
              ))}
              <div className="border-t pt-2 mt-2">
                <button onClick={handleLogout} className="w-full text-left p-3 rounded-lg text-red-600">🚪 Sign Out</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Navigation */}
      <nav className="bg-white shadow-lg sticky top-0 z-40 hidden md:block">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🏢</span>
                <span className="font-bold text-xl">ShiftFlow<span className="text-blue-600">Pro</span></span>
              </div>
              <div className="flex space-x-1">
                {visibleNavItems.map(item => (
                  <button key={item.id} onClick={() => { setView(item.id); setActiveChat(null); }} className={`px-4 py-2 rounded-lg ${view === item.id ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Online Users Indicator */}
              <div className="flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded-full">
                <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                <span className="text-sm text-gray-600">{onlineUsers.length} online</span>
              </div>
              {currentTimeEntry && (
                <div className="bg-yellow-100 px-3 py-1 rounded-full text-sm text-yellow-600">
                  ⏰ Clocked in
                </div>
              )}
              <button onClick={clockedIn ? handleClockOut : handleClockIn} className={`px-3 py-1 rounded-full text-sm ${clockedIn ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                {clockedIn ? 'Clock Out' : 'Clock In'}
              </button>
              <div className="relative">
                <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded-full">
                  <span>👤</span>
                  <span className="hidden sm:inline">{user?.name}</span>
                  <span className="text-xs">▼</span>
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border z-50">
                    <div className="px-4 py-3 border-b bg-gray-50">
                      <p className="text-sm font-medium">{user?.name}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                    <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100">🚪 Sign Out</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-20 md:pb-8">
        {/* Dashboard View */}
        {view === 'dashboard' && (
          <div>
            {user?.role === 'admin' && stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-white p-4 rounded-xl shadow-sm"><p className="text-2xl font-bold text-blue-600">{stats.totalStaff}</p><p className="text-xs text-gray-500">Staff</p></div>
                <div className="bg-white p-4 rounded-xl shadow-sm"><p className="text-2xl font-bold text-green-600">{stats.totalShifts}</p><p className="text-xs text-gray-500">Shifts</p></div>
                <div className="bg-white p-4 rounded-xl shadow-sm"><p className="text-2xl font-bold text-emerald-600">{stats.filledShifts}</p><p className="text-xs text-gray-500">Filled</p></div>
                <div className="bg-white p-4 rounded-xl shadow-sm"><p className="text-2xl font-bold text-orange-600">{stats.pendingSwaps}</p><p className="text-xs text-gray-500">Swaps</p></div>
              </div>
            )}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">📋 Upcoming Shifts</h2>
              <button onClick={exportToExcel} className="bg-emerald-500 text-white px-3 py-1 rounded-lg text-sm">📊 Export</button>
            </div>
            {shifts.length > 0 ? shifts.map(shift => (
              <div key={shift.id} className="bg-white p-4 rounded-xl shadow-sm mb-3 border-l-4 border-blue-500">
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold">{shift.date} | {shift.start_time}-{shift.end_time}</p>
                    <p className="text-sm text-gray-600">{shift.location || 'Main'} | {shift.required_skill || 'General'}</p>
                    {shift.assigned_staff?.length > 0 && <p className="text-xs text-green-600 mt-1">✅ {shift.assigned_staff.map(s => s.name).join(', ')}</p>}
                  </div>
                  {user?.role === 'admin' && (
                    <div className="flex gap-2">
                      <button onClick={() => editShift(shift)} className="text-blue-500">✏️</button>
                      <button onClick={() => deleteShift(shift.id)} className="text-red-500">🗑️</button>
                    </div>
                  )}
                </div>
              </div>
            )) : <div className="bg-white p-8 text-center text-gray-400 rounded-xl">No shifts</div>}
          </div>
        )}

        {/* Availability View */}
        {view === 'availability' && (
          <div className="bg-white rounded-xl p-4">
            <h2 className="text-xl font-bold mb-4">✅ Set Your Availability</h2>
            <div className="mb-4">
              <label className="block text-sm mb-2">Select Date</label>
              <input type="date" value={availDate} onChange={(e) => setAvailDate(e.target.value)} className="px-3 py-2 border rounded-lg" />
            </div>
            {availDate && (
              <div className="grid grid-cols-1 gap-3">
                {[{ start: '09:00', end: '13:00', label: 'Morning', time: '9AM-1PM' }, { start: '13:00', end: '17:00', label: 'Afternoon', time: '1PM-5PM' }, { start: '17:00', end: '21:00', label: 'Evening', time: '5PM-9PM' }].map(slot => {
                  const isAvailable = availSlots[`${availDate}_${slot.start}`];
                  return (
                    <button key={slot.start} onClick={() => submitAvailability(slot)} className={`p-4 rounded-xl border-2 ${isAvailable ? 'bg-green-50 border-green-500' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="text-center">{slot.label}: {isAvailable ? '✓ Available' : '✗ Unavailable'}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Chat View - Fixed */}
        {view === 'chat' && (
          <div className="bg-white rounded-xl shadow-sm flex flex-col h-[70vh]">
            <div className="p-3 border-b bg-gray-50 rounded-t-xl flex justify-between items-center">
              <h3 className="font-semibold">💬 Team Chat</h3>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                <span className="text-sm text-gray-500">{onlineUsers.length} online</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.userId === user?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl p-2 px-3 ${msg.userId === user?.id ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>
                    {msg.userId !== user?.id && <p className="text-xs font-bold mb-1">{msg.userName}</p>}
                    <p className="text-sm break-words">{msg.message}</p>
                    <p className="text-xs mt-1 opacity-70">{new Date(msg.timestamp).toLocaleTimeString()}</p>
                  </div>
                  {msg.userId === user?.id && (
                    <button onClick={() => deleteMessage(msg.id)} className="ml-1 text-gray-400 text-xs">🗑️</button>
                  )}
                </div>
              ))}
              {typingUser && <p className="text-sm text-gray-400 italic">{typingUser.userName} is typing...</p>}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="p-3 border-t flex gap-2">
              <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyUp={handleTyping} placeholder="Type a message..." className="flex-1 px-3 py-2 border rounded-xl text-sm" />
              <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm" disabled={!socketConnected}>Send</button>
            </form>
          </div>
        )}

        {/* Documents View */}
        {view === 'documents' && (
          <div className="bg-white rounded-xl p-4">
            <h2 className="text-xl font-bold mb-4">📄 Documents</h2>
            <form onSubmit={handleFileUpload} className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex flex-col sm:flex-row gap-2">
                <input type="file" id="fileInput" onChange={(e) => setSelectedFile(e.target.files[0])} className="p-2 border rounded text-sm flex-1" />
                <input type="text" placeholder="Description" value={fileDescription} onChange={(e) => setFileDescription(e.target.value)} className="p-2 border rounded text-sm flex-1" />
                <button type="submit" disabled={uploading} className="bg-blue-500 text-white px-3 py-2 rounded-lg text-sm">Upload</button>
              </div>
            </form>
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="border rounded-lg p-3 flex justify-between items-center">
                  <div><p className="font-medium text-sm">{doc.originalName}</p><p className="text-xs text-gray-500">By {doc.userName}</p></div>
                  <div className="flex gap-2">
                    <a href={doc.downloadUrl} download className="bg-green-500 text-white px-2 py-1 rounded text-xs">Download</a>
                    {(user?.role === 'admin' || doc.userId === user?.id) && <button onClick={() => deleteDocument(doc.id)} className="bg-red-500 text-white px-2 py-1 rounded text-xs">Delete</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin Availability View */}
        {view === 'admin-availability' && user?.role === 'admin' && (
          <div className="bg-white rounded-xl p-4 overflow-x-auto">
            <h2 className="text-xl font-bold mb-4">👥 Staff Availability</h2>
            <table className="w-full min-w-[500px]">
              <thead className="bg-gray-50"><tr><th className="p-2 text-left">Staff</th><th className="p-2 text-left">Date</th><th className="p-2 text-left">Time</th><th className="p-2 text-left">Status</th></tr></thead>
              <tbody>
                {allAvailability.slice(0, 20).map(avail => (
                  <tr key={avail.id} className="border-t"><td className="p-2 text-sm">{avail.user_name}</td><td className="p-2 text-sm">{avail.date}</td><td className="p-2 text-sm">{avail.start_time}-{avail.end_time}</td><td className="p-2">{avail.is_available ? <span className="text-green-600">✅</span> : <span className="text-red-600">❌</span>}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Time Tracking View */}
        {view === 'time-tracking' && user?.role === 'admin' && (
          <div className="bg-white rounded-xl p-4 overflow-x-auto">
            <h2 className="text-xl font-bold mb-4">⏰ Time Tracking</h2>
            <table className="w-full min-w-[500px]">
              <thead className="bg-gray-50"><tr><th className="p-2 text-left">Staff</th><th className="p-2 text-left">Clock In</th><th className="p-2 text-left">Duration</th><th className="p-2 text-left">Status</th></tr></thead>
              <tbody>
                {timeEntries.map(entry => (
                  <tr key={entry.id} className="border-t"><td className="p-2 text-sm">{entry.user_name}</td><td className="p-2 text-sm">{new Date(entry.clock_in).toLocaleTimeString()}</td><td className="p-2 text-sm">{entry.duration ? formatDuration(entry.duration) : '—'}</td><td className="p-2">{!entry.clock_out ? <span className="text-green-600">🟢 Working</span> : <span className="text-gray-500">⚫ Completed</span>}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Admin Panel View */}
        {view === 'admin' && user?.role === 'admin' && (
          <div>
            <div className="flex flex-wrap justify-between gap-2 mb-4">
              <h2 className="text-xl font-bold">⚙️ Admin</h2>
              <div className="flex gap-2">
                <button onClick={exportToExcel} className="bg-emerald-500 text-white px-3 py-1 rounded-lg text-sm">📊 Export</button>
                <button onClick={() => runAutoSchedule()} disabled={loading} className="bg-green-500 text-white px-3 py-1 rounded-lg text-sm">🤖 Auto-Schedule</button>
                <button onClick={() => { setEditingShift(null); setNewShift({ date: '', start_time: '', end_time: '', required_skill: '', min_staff: 1, max_staff: 3, location: '' }); setShowForm(true); }} className="bg-blue-500 text-white px-3 py-1 rounded-lg text-sm">+ Shift</button>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl overflow-x-auto mb-4">
              <h3 className="font-semibold p-3 border-b">👥 Users</h3>
              <table className="w-full min-w-[500px]">
                <thead className="bg-gray-50"><tr><th className="p-2 text-left">Name</th><th className="p-2 text-left">Email</th><th className="p-2 text-left">Role</th><th className="p-2 text-left">Actions</th></tr></thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u.id} className="border-t"><td className="p-2 text-sm">{u.name}</td><td className="p-2 text-sm">{u.email}</td><td className="p-2"><select value={u.role} onChange={(e) => updateUserRole(u.id, e.target.value)} className="border rounded px-1 text-sm"><option value="staff">Staff</option><option value="admin">Admin</option></select></td><td className="p-2">{u.id !== user?.id && <button onClick={() => deleteUser(u.id)} className="text-red-500 text-sm">Delete</button>}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Shifts Table */}
            <div className="bg-white rounded-xl overflow-x-auto">
              <h3 className="font-semibold p-3 border-b">📋 Shifts</h3>
              <table className="w-full min-w-[500px]">
                <thead className="bg-gray-50"><tr><th className="p-2 text-left">Date</th><th className="p-2 text-left">Time</th><th className="p-2 text-left">Location</th><th className="p-2 text-left">Assigned</th></tr></thead>
                <tbody>
                  {shifts.map(s => (
                    <tr key={s.id} className="border-t"><td className="p-2 text-sm">{s.date}</td><td className="p-2 text-sm">{s.start_time}-{s.end_time}</td><td className="p-2 text-sm">{s.location || '-'}</td><td className="p-2 text-sm">{s.assigned_staff?.map(st => st.name).join(', ') || '-'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-md">
            <h3 className="text-lg font-bold mb-3">{editingShift ? 'Edit Shift' : 'New Shift'}</h3>
            <form onSubmit={createShift} className="space-y-2">
              <input type="date" value={newShift.date} onChange={(e) => setNewShift({...newShift, date: e.target.value})} className="w-full p-2 border rounded" required />
              <div className="grid grid-cols-2 gap-2">
                <input type="time" value={newShift.start_time} onChange={(e) => setNewShift({...newShift, start_time: e.target.value})} className="p-2 border rounded" required />
                <input type="time" value={newShift.end_time} onChange={(e) => setNewShift({...newShift, end_time: e.target.value})} className="p-2 border rounded" required />
              </div>
              <input type="text" placeholder="Location" value={newShift.location} onChange={(e) => setNewShift({...newShift, location: e.target.value})} className="w-full p-2 border rounded" />
              <input type="text" placeholder="Skill" value={newShift.required_skill} onChange={(e) => setNewShift({...newShift, required_skill: e.target.value})} className="w-full p-2 border rounded" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder="Min" value={newShift.min_staff} onChange={(e) => setNewShift({...newShift, min_staff: parseInt(e.target.value)})} className="p-2 border rounded" min="1" required />
                <input type="number" placeholder="Max" value={newShift.max_staff} onChange={(e) => setNewShift({...newShift, max_staff: parseInt(e.target.value)})} className="p-2 border rounded" min="1" required />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditingShift(null); }} className="flex-1 bg-gray-300 py-2 rounded">Cancel</button>
                <button type="submit" className="flex-1 bg-blue-500 text-white py-2 rounded">{editingShift ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSwapModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-md">
            <h3 className="text-lg font-bold mb-3">Request Shift Swap</h3>
            <form onSubmit={handleSwapRequest}>
              <p className="text-sm text-gray-600 mb-2">Shift: {selectedShift?.date} {selectedShift?.start_time}-{selectedShift?.end_time}</p>
              <select value={swapTargetStaff} onChange={(e) => setSwapTargetStaff(e.target.value)} className="w-full p-2 border rounded mb-2" required>
                <option value="">Select staff</option>
                {staffList.filter(s => s.id !== user?.id).map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
              <textarea placeholder="Reason" value={swapReason} onChange={(e) => setSwapReason(e.target.value)} className="w-full p-2 border rounded mb-2" rows="2" />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowSwapModal(false)} className="flex-1 bg-gray-300 py-2 rounded">Cancel</button>
                <button type="submit" className="flex-1 bg-blue-500 text-white py-2 rounded">Send</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLeaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-md">
            <h3 className="text-lg font-bold mb-3">Request Time Off</h3>
            <form onSubmit={handleLeaveRequest}>
              <label className="block text-sm mb-1">Start Date</label>
              <input type="date" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} className="w-full p-2 border rounded mb-2" required />
              <label className="block text-sm mb-1">End Date</label>
              <input type="date" value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} className="w-full p-2 border rounded mb-2" required />
              <textarea placeholder="Reason" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} className="w-full p-2 border rounded mb-2" rows="2" />
              <div className="flex gap-2">
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
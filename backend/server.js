const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Create uploads directory
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Configure multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ============ DATA STORAGE ============
const users = [];
let nextId = 1;
const shifts = [];
let nextShiftId = 1;
const availability = [];
let nextAvailId = 1;
const swapRequests = [];
let nextSwapId = 1;
const leaveRequests = [];
let nextLeaveId = 1;
const timeEntries = [];
let nextTimeEntryId = 1;
const messages = [];
let nextMessageId = 1;
const documents = [];
let nextDocId = 1;
const privateMessages = [];
let nextPrivateMsgId = 1;
const onlineUsers = new Map();

// ============ SOCKET.IO ============
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);
    
    socket.on('user-connected', (userId) => {
        onlineUsers.set(userId, socket.id);
        io.emit('online-users', Array.from(onlineUsers.keys()));
        console.log(`👤 User ${userId} online`);
    });
    
    socket.on('send-message', (data) => {
        const message = {
            id: nextMessageId++,
            userId: data.userId,
            userName: data.userName,
            message: data.message,
            timestamp: new Date().toISOString(),
            type: 'group'
        };
        messages.push(message);
        io.emit('new-message', message);
    });
    
    socket.on('send-private-message', (data) => {
        const message = {
            id: nextPrivateMsgId++,
            fromUserId: data.fromUserId,
            fromUserName: data.fromUserName,
            toUserId: data.toUserId,
            message: data.message,
            timestamp: new Date().toISOString(),
            read: false
        };
        privateMessages.push(message);
        const targetSocketId = onlineUsers.get(data.toUserId);
        if (targetSocketId) {
            io.to(targetSocketId).emit('new-private-message', message);
        }
        socket.emit('private-message-sent', message);
    });
    
    socket.on('delete-message', (data) => {
        const msgIndex = messages.findIndex(m => m.id === data.messageId);
        if (msgIndex !== -1) {
            messages.splice(msgIndex, 1);
            io.emit('message-deleted', data.messageId);
        }
    });
    
    socket.on('typing', (data) => {
        socket.broadcast.emit('user-typing', data);
    });
    
    socket.on('disconnect', () => {
        let disconnectedUser = null;
        for (let [userId, socketId] of onlineUsers.entries()) {
            if (socketId === socket.id) {
                disconnectedUser = userId;
                onlineUsers.delete(userId);
                break;
            }
        }
        if (disconnectedUser) {
            io.emit('online-users', Array.from(onlineUsers.keys()));
            console.log(`👤 User ${disconnectedUser} disconnected`);
        }
    });
});

// ============ AUTHENTICATION ============

app.get('/api/test', (req, res) => {
    res.json({ message: 'Backend is working!' });
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, role = 'staff', phone = '' } = req.body;
        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { 
            id: nextId++, 
            name, 
            email, 
            password: hashedPassword, 
            role, 
            phone,
            max_hours_per_week: 40,
            createdAt: new Date().toISOString()
        };
        users.push(newUser);
        const token = jwt.sign({ id: newUser.id, email: newUser.email, role: newUser.role }, 'my_secret_key', { expiresIn: '7d' });
        res.json({ user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, phone: newUser.phone }, token });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = users.find(u => u.email === email);
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, 'my_secret_key', { expiresIn: '7d' });
        res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone }, token });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied' });
    jwt.verify(token, 'my_secret_key', (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

// ============ USER MANAGEMENT ============

app.get('/api/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const allUsers = users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, createdAt: u.createdAt }));
    res.json(allUsers);
});

app.put('/api/users/:id/role', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const userId = parseInt(req.params.id);
    const { role } = req.body;
    const user = users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.role = role;
    res.json({ message: 'Role updated', user: { id: user.id, name: user.name, role: user.role } });
});

app.delete('/api/users/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const userId = parseInt(req.params.id);
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) return res.status(404).json({ error: 'User not found' });
    users.splice(index, 1);
    res.json({ message: 'User deleted' });
});

// ============ SHIFTS ============

app.get('/api/shifts', authenticateToken, (req, res) => {
    const shiftsWithAssignments = shifts.map(shift => {
        const assignedStaffDetails = (shift.assigned_staff || []).map(staffId => {
            const staff = users.find(u => u.id === staffId);
            return staff ? { user_id: staff.id, name: staff.name } : null;
        }).filter(s => s);
        return { ...shift, assigned_staff: assignedStaffDetails, assigned_count: shift.assigned_staff?.length || 0 };
    });
    res.json(shiftsWithAssignments);
});

app.post('/api/shifts', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const newShift = { id: nextShiftId++, ...req.body, assigned_staff: [], assigned_count: 0 };
    shifts.push(newShift);
    res.json(newShift);
});

app.put('/api/shifts/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const shiftId = parseInt(req.params.id);
    const shiftIndex = shifts.findIndex(s => s.id === shiftId);
    if (shiftIndex === -1) return res.status(404).json({ error: 'Shift not found' });
    shifts[shiftIndex] = { ...shifts[shiftIndex], ...req.body };
    res.json(shifts[shiftIndex]);
});

app.delete('/api/shifts/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const shiftId = parseInt(req.params.id);
    const shiftIndex = shifts.findIndex(s => s.id === shiftId);
    if (shiftIndex === -1) return res.status(404).json({ error: 'Shift not found' });
    shifts.splice(shiftIndex, 1);
    res.json({ message: 'Shift deleted' });
});

// ============ AVAILABILITY ============

app.post('/api/availability', authenticateToken, (req, res) => {
    const { date, start_time, end_time, is_available } = req.body;
    const existingIndex = availability.findIndex(a => a.user_id === req.user.id && a.date === date && a.start_time === start_time);
    if (existingIndex !== -1) {
        availability[existingIndex].is_available = is_available;
        res.json(availability[existingIndex]);
    } else {
        const newAvail = { id: nextAvailId++, user_id: req.user.id, date, start_time, end_time, is_available };
        availability.push(newAvail);
        res.json(newAvail);
    }
});

app.get('/api/availability', authenticateToken, (req, res) => {
    res.json(availability.filter(a => a.user_id === req.user.id));
});

app.get('/api/availability/all', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const allAvail = availability.map(a => {
        const user = users.find(u => u.id === a.user_id);
        return { ...a, user_name: user?.name, user_email: user?.email, user_phone: user?.phone };
    });
    res.json(allAvail);
});

// ============ TIME CLOCK & TRACKING ============

app.post('/api/time/clock-in', authenticateToken, (req, res) => {
    const active = timeEntries.find(te => te.user_id === req.user.id && !te.clock_out);
    if (active) return res.status(400).json({ error: 'Already clocked in' });
    const entry = { 
        id: nextTimeEntryId++, 
        user_id: req.user.id, 
        user_name: users.find(u => u.id === req.user.id)?.name,
        clock_in: new Date().toISOString(), 
        clock_out: null,
        date: new Date().toISOString().split('T')[0]
    };
    timeEntries.push(entry);
    res.json(entry);
});

app.post('/api/time/clock-out', authenticateToken, (req, res) => {
    const entry = timeEntries.find(te => te.user_id === req.user.id && !te.clock_out);
    if (!entry) return res.status(400).json({ error: 'Not clocked in' });
    entry.clock_out = new Date().toISOString();
    // Calculate duration in hours
    const start = new Date(entry.clock_in);
    const end = new Date(entry.clock_out);
    const hours = (end - start) / (1000 * 60 * 60);
    entry.duration = Math.round(hours * 10) / 10;
    res.json(entry);
});

app.get('/api/time/current', authenticateToken, (req, res) => {
    const active = timeEntries.find(te => te.user_id === req.user.id && !te.clock_out);
    res.json(active || null);
});

app.get('/api/time/entries', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const enriched = timeEntries.map(te => {
        const user = users.find(u => u.id === te.user_id);
        return { 
            ...te, 
            user_name: user?.name,
            user_email: user?.email,
            user_phone: user?.phone
        };
    });
    // Sort by most recent first
    enriched.sort((a, b) => new Date(b.clock_in) - new Date(a.clock_in));
    res.json(enriched);
});

app.get('/api/time/entries/user/:userId', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.userId)) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const userId = parseInt(req.params.userId);
    const userEntries = timeEntries.filter(te => te.user_id === userId);
    res.json(userEntries);
});

// ============ SMART AUTO-SCHEDULE ============

function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
}

function getAvailableStaffForShift(date, start, end) {
    const startMin = timeToMinutes(start);
    const endMin = timeToMinutes(end);
    const staffList = users.filter(u => u.role === 'staff');
    const availableStaff = [];
    
    for (const staff of staffList) {
        const userAvail = availability.filter(a => a.user_id === staff.id && a.date === date && a.is_available === true);
        for (const avail of userAvail) {
            const availStart = timeToMinutes(avail.start_time);
            const availEnd = timeToMinutes(avail.end_time);
            if (availStart <= startMin && availEnd >= endMin) {
                availableStaff.push({ ...staff, coverage: 'full', availStart, availEnd });
                break;
            } else if (availStart <= endMin && availEnd >= startMin) {
                const overlapStart = Math.max(availStart, startMin);
                const overlapEnd = Math.min(availEnd, endMin);
                const duration = overlapEnd - overlapStart;
                availableStaff.push({ ...staff, coverage: 'partial', availStart, availEnd, overlapStart, overlapEnd, duration });
            }
        }
    }
    return availableStaff;
}

app.post('/api/auto-schedule', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    
    const { shiftId } = req.body;
    let targetShifts = shiftId ? shifts.filter(s => s.id === shiftId) : shifts;
    let total = 0;
    const assignments = [];
    
    for (const shift of targetShifts) {
        const currentCount = shift.assigned_staff?.length || 0;
        const needed = shift.max_staff - currentCount;
        if (needed <= 0) continue;
        
        const availableStaff = getAvailableStaffForShift(shift.date, shift.start_time, shift.end_time);
        const eligible = availableStaff.filter(s => !shift.assigned_staff?.includes(s.id));
        eligible.sort((a, b) => {
            if (a.coverage === 'full' && b.coverage !== 'full') return -1;
            if (a.coverage !== 'full' && b.coverage === 'full') return 1;
            return (b.duration || 0) - (a.duration || 0);
        });
        
        const toAssign = eligible.slice(0, needed);
        for (const staff of toAssign) {
            if (!shift.assigned_staff) shift.assigned_staff = [];
            shift.assigned_staff.push(staff.id);
            total++;
            assignments.push({ shiftId: shift.id, staffId: staff.id, staffName: staff.name, coverage: staff.coverage });
        }
    }
    
    res.json({ message: `Auto-scheduled ${total} assignment${total !== 1 ? 's' : ''}`, assignments_made: total, assignments });
});

app.post('/api/shifts/:shiftId/assign', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const shiftId = parseInt(req.params.shiftId);
    const { staffId } = req.body;
    
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    
    if (!shift.assigned_staff) shift.assigned_staff = [];
    if (shift.assigned_staff.includes(staffId)) {
        return res.status(400).json({ error: 'Staff already assigned' });
    }
    
    shift.assigned_staff.push(staffId);
    res.json({ message: 'Staff assigned successfully', shift });
});

// ============ SWAP REQUESTS ============

app.post('/api/swap-requests', authenticateToken, (req, res) => {
    const { shift_id, target_user_id, reason } = req.body;
    const shift = shifts.find(s => s.id === shift_id);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    if (!shift.assigned_staff?.includes(req.user.id)) return res.status(403).json({ error: 'Not assigned to this shift' });
    
    const request = { id: nextSwapId++, from_user_id: req.user.id, to_user_id: target_user_id, from_shift_id: shift_id, reason: reason || '', status: 'pending', createdAt: new Date().toISOString() };
    swapRequests.push(request);
    res.json(request);
});

app.get('/api/swap-requests/pending', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const pending = swapRequests.filter(sr => sr.status === 'pending').map(sr => {
        const fromUser = users.find(u => u.id === sr.from_user_id);
        const toUser = users.find(u => u.id === sr.to_user_id);
        const fromShift = shifts.find(s => s.id === sr.from_shift_id);
        return { ...sr, from_user_name: fromUser?.name, to_user_name: toUser?.name, from_shift: fromShift };
    });
    res.json(pending);
});

app.put('/api/swap-requests/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { status } = req.body;
    const request = swapRequests.find(sr => sr.id === parseInt(req.params.id));
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (status === 'approved') {
        const shift = shifts.find(s => s.id === request.from_shift_id);
        if (shift) {
            const idx = shift.assigned_staff.indexOf(request.from_user_id);
            if (idx !== -1) shift.assigned_staff[idx] = request.to_user_id;
        }
    }
    request.status = status;
    res.json({ message: `Swap ${status}` });
});

// ============ LEAVE REQUESTS ============

app.post('/api/leave-requests', authenticateToken, (req, res) => {
    const { start_date, end_date, reason } = req.body;
    const request = { id: nextLeaveId++, user_id: req.user.id, start_date, end_date, reason: reason || '', status: 'pending', createdAt: new Date().toISOString() };
    leaveRequests.push(request);
    res.json(request);
});

app.get('/api/leave-requests/pending', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const pending = leaveRequests.filter(lr => lr.status === 'pending').map(lr => {
        const user = users.find(u => u.id === lr.user_id);
        return { ...lr, user_name: user?.name };
    });
    res.json(pending);
});

app.put('/api/leave-requests/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { status } = req.body;
    const request = leaveRequests.find(lr => lr.id === parseInt(req.params.id));
    if (!request) return res.status(404).json({ error: 'Request not found' });
    request.status = status;
    res.json({ message: `Leave ${status}` });
});

// ============ STATS ============

app.get('/api/stats', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    
    // Calculate total hours worked today
    const today = new Date().toISOString().split('T')[0];
    const todayEntries = timeEntries.filter(te => te.date === today && te.clock_out);
    let todayHours = 0;
    todayEntries.forEach(te => {
        todayHours += te.duration || 0;
    });
    
    res.json({
        totalStaff: users.filter(u => u.role === 'staff').length,
        totalShifts: shifts.length,
        filledShifts: shifts.filter(s => (s.assigned_staff?.length || 0) >= s.min_staff).length,
        pendingSwaps: swapRequests.filter(sr => sr.status === 'pending').length,
        pendingLeave: leaveRequests.filter(lr => lr.status === 'pending').length,
        currentlyClockedIn: timeEntries.filter(te => !te.clock_out).length,
        todayHours: Math.round(todayHours * 10) / 10
    });
});

app.get('/api/staff', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    res.json(users.filter(u => u.role === 'staff').map(u => ({ id: u.id, name: u.name, email: u.email, phone: u.phone })));
});

// ============ MESSAGES ============

app.get('/api/messages', authenticateToken, (req, res) => {
    const recent = messages.slice(-100).map(m => ({ ...m, userName: users.find(u => u.id === m.userId)?.name || m.userName }));
    res.json(recent);
});

app.get('/api/private-messages/:userId', authenticateToken, (req, res) => {
    const otherUserId = parseInt(req.params.userId);
    const myId = req.user.id;
    const conversation = privateMessages.filter(m => 
        (m.fromUserId === myId && m.toUserId === otherUserId) || 
        (m.fromUserId === otherUserId && m.toUserId === myId)
    );
    res.json(conversation);
});

// ============ DOCUMENTS ============

app.post('/api/documents/upload', authenticateToken, upload.single('file'), (req, res) => {
    const doc = {
        id: nextDocId++,
        userId: req.user.id,
        userName: users.find(u => u.id === req.user.id)?.name,
        filename: req.file.filename,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        description: req.body.description || '',
        uploadDate: new Date().toISOString()
    };
    documents.push(doc);
    res.json(doc);
});

app.get('/api/documents', authenticateToken, (req, res) => {
    const docs = documents.map(d => ({ ...d, downloadUrl: `http://localhost:5001/uploads/${d.filename}` }));
    res.json(docs);
});

app.delete('/api/documents/:id', authenticateToken, (req, res) => {
    const id = parseInt(req.params.id);
    const index = documents.findIndex(d => d.id === id);
    if (index === -1) return res.status(404).json({ error: 'Document not found' });
    const doc = documents[index];
    if (doc.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const filePath = path.join(__dirname, 'uploads', doc.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    documents.splice(index, 1);
    res.json({ message: 'Document deleted' });
});

// ============ CREATE ADMIN ============

const createAdmin = async () => {
    const exists = users.find(u => u.email === 'admin@example.com');
    if (!exists) {
        const hashed = await bcrypt.hash('admin123', 10);
        users.push({ id: nextId++, name: 'Admin User', email: 'admin@example.com', password: hashed, role: 'admin', phone: '', max_hours_per_week: 40, createdAt: new Date().toISOString() });
        console.log('✅ Admin created: admin@example.com / admin123');
    }
};
createAdmin();

// ============ START SERVER ============

const PORT = 5001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`💬 Chat Ready`);
    console.log(`📄 Document Sharing Ready`);
    console.log(`⏰ Time Tracking Ready`);
    console.log(`👥 ${users.length} users registered\n`);
});
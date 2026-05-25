const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: ["http://localhost:5173", "http://localhost:5174", "https://shiftflow-frontend.vercel.app", "https://*.vercel.app", "https://*.onrender.com"],
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
    }
});

app.use(cors({
    origin: ["http://localhost:5173", "http://localhost:5174", "https://shiftflow-frontend.vercel.app", "https://*.vercel.app", "https://*.onrender.com"],
    credentials: true
}));
app.use(express.json());

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
const onlineUsers = new Map();

// ============ HELPER FUNCTIONS ============
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
}

// ============ CREATE ADMIN USER ============
const createAdmin = async () => {
    const existingAdmin = users.find(u => u.email === 'admin@example.com');
    if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        users.push({ 
            id: nextId++, 
            name: 'Admin User', 
            email: 'admin@example.com', 
            password: hashedPassword, 
            role: 'admin', 
            phone: '', 
            max_hours_per_week: 40,
            createdAt: new Date().toISOString()
        });
        console.log('✅ Admin created: admin@example.com / admin123');
    }
};

// ============ SOCKET.IO ============
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);
    
    socket.on('user-connected', (userId) => {
        onlineUsers.set(userId, socket.id);
        io.emit('online-users', Array.from(onlineUsers.keys()));
        console.log(`✅ User ${userId} online. Total: ${onlineUsers.size}`);
    });
    
    socket.on('send-message', (data) => {
        const message = {
            id: nextMessageId++,
            userId: data.userId,
            userName: data.userName,
            message: data.message,
            timestamp: new Date().toISOString()
        };
        messages.push(message);
        io.emit('new-message', message);
    });
    
    socket.on('delete-message', (data) => {
        const index = messages.findIndex(m => m.id === data.messageId);
        if (index !== -1) {
            messages.splice(index, 1);
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
            console.log(`❌ User ${disconnectedUser} disconnected. Total: ${onlineUsers.size}`);
        }
    });
});

// ============ AUTHENTICATION ============

app.get('/api/test', (req, res) => {
    res.json({ message: 'ShiftFlow Pro API is running!', timestamp: new Date().toISOString() });
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
        
        const token = jwt.sign(
            { id: newUser.id, email: newUser.email, role: newUser.role }, 
            'shiftflow_secret_key_2024', 
            { expiresIn: '7d' }
        );
        
        res.json({ 
            user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, phone: newUser.phone }, 
            token 
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = users.find(u => u.email === email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role }, 
            'shiftflow_secret_key_2024', 
            { expiresIn: '7d' }
        );
        
        res.json({ 
            user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone }, 
            token 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access denied' });
    }
    
    jwt.verify(token, 'shiftflow_secret_key_2024', (err, user) => {
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

app.get('/api/staff', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    res.json(users.filter(u => u.role === 'staff').map(u => ({ id: u.id, name: u.name, email: u.email, phone: u.phone })));
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

// ============ SHIFT MANAGEMENT ============

app.get('/api/shifts', authenticateToken, (req, res) => {
    const shiftsWithAssignments = shifts.map(shift => {
        const assignedStaffDetails = (shift.assigned_staff || []).map(staffId => {
            const staff = users.find(u => u.id === staffId);
            return staff ? { user_id: staff.id, name: staff.name } : null;
        }).filter(s => s);
        return { 
            ...shift, 
            assigned_staff: assignedStaffDetails, 
            assigned_count: shift.assigned_staff?.length || 0 
        };
    });
    res.json(shiftsWithAssignments);
});

app.post('/api/shifts', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const newShift = { 
        id: nextShiftId++, 
        ...req.body, 
        assigned_staff: [], 
        assigned_count: 0,
        createdAt: new Date().toISOString()
    };
    shifts.push(newShift);
    res.json(newShift);
});

app.put('/api/shifts/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const shiftId = parseInt(req.params.id);
    const index = shifts.findIndex(s => s.id === shiftId);
    if (index === -1) return res.status(404).json({ error: 'Shift not found' });
    shifts[index] = { ...shifts[index], ...req.body };
    res.json(shifts[index]);
});

app.delete('/api/shifts/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const shiftId = parseInt(req.params.id);
    const index = shifts.findIndex(s => s.id === shiftId);
    if (index === -1) return res.status(404).json({ error: 'Shift not found' });
    shifts.splice(index, 1);
    res.json({ message: 'Shift deleted' });
});

app.post('/api/shifts/:shiftId/assign', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const shiftId = parseInt(req.params.shiftId);
    const { staffId } = req.body;
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    if (!shift.assigned_staff) shift.assigned_staff = [];
    if (!shift.assigned_staff.includes(staffId)) {
        shift.assigned_staff.push(staffId);
    }
    res.json({ message: 'Staff assigned successfully', shift });
});

// ============ AVAILABILITY MANAGEMENT (FULLY WORKING) ============

app.post('/api/availability', authenticateToken, async (req, res) => {
    try {
        const { date, start_time, end_time, is_available } = req.body;
        
        // Validate input
        if (!date || start_time === undefined || end_time === undefined) {
            return res.status(400).json({ error: 'Missing date, start_time, or end_time' });
        }
        
        // Ensure times are strings
        const startStr = String(start_time);
        const endStr = String(end_time);
        
        // Check if an identical slot already exists
        const existingIndex = availability.findIndex(a => 
            a.user_id === req.user.id && 
            a.date === date && 
            a.start_time === startStr && 
            a.end_time === endStr
        );
        
        if (existingIndex !== -1) {
            // Update existing
            availability[existingIndex].is_available = is_available === true;
            return res.json(availability[existingIndex]);
        }
        
        // Create new availability
        const newAvail = {
            id: nextAvailId++,
            user_id: req.user.id,
            date,
            start_time: startStr,
            end_time: endStr,
            is_available: is_available === true,
            createdAt: new Date().toISOString()
        };
        availability.push(newAvail);
        console.log(`✅ Availability added: ${date} ${startStr}-${endStr} for user ${req.user.id}`);
        res.status(201).json(newAvail);
    } catch (error) {
        console.error('POST /api/availability error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/availability/:id', authenticateToken, (req, res) => {
    const id = parseInt(req.params.id);
    const index = availability.findIndex(a => a.id === id && a.user_id === req.user.id);
    if (index === -1) return res.status(404).json({ error: 'Availability not found' });
    availability.splice(index, 1);
    res.json({ message: 'Availability removed' });
});

app.get('/api/availability', authenticateToken, (req, res) => {
    const myAvailability = availability.filter(a => a.user_id === req.user.id);
    res.json(myAvailability);
});

app.get('/api/availability/staff/all', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const allStaff = [];
    users.filter(u => u.role === 'staff').forEach(staff => {
        const staffAvail = availability.filter(a => a.user_id === staff.id);
        staffAvail.forEach(avail => {
            allStaff.push({
                ...avail,
                staff_name: staff.name,
                staff_id: staff.id,
                staff_email: staff.email,
                staff_phone: staff.phone
            });
        });
    });
    res.json(allStaff);
});

// ============ SMART AUTO-SCHEDULE ============

app.post('/api/auto-schedule', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
        
        const staffList = users.filter(u => u.role === 'staff');
        let totalAssignments = 0;
        const assignmentDetails = [];
        
        for (const shift of shifts) {
            const currentAssigned = shift.assigned_staff?.length || 0;
            const needed = shift.max_staff - currentAssigned;
            if (needed <= 0) continue;
            
            const shiftStart = timeToMinutes(shift.start_time);
            const shiftEnd = timeToMinutes(shift.end_time);
            const shiftDuration = shiftEnd - shiftStart;
            
            const eligibleStaff = [];
            for (const staff of staffList) {
                if (shift.assigned_staff?.includes(staff.id)) continue;
                const staffAvailability = availability.filter(a => a.user_id === staff.id && a.date === shift.date && a.is_available === true);
                let isAvailable = false;
                let availableHours = 0;
                for (const avail of staffAvailability) {
                    const availStart = timeToMinutes(avail.start_time);
                    const availEnd = timeToMinutes(avail.end_time);
                    if (availStart <= shiftStart && availEnd >= shiftEnd) {
                        isAvailable = true;
                        availableHours = shiftDuration;
                        break;
                    }
                    if (availStart <= shiftEnd && availEnd >= shiftStart) {
                        const overlapStart = Math.max(availStart, shiftStart);
                        const overlapEnd = Math.min(availEnd, shiftEnd);
                        const overlapDuration = overlapEnd - overlapStart;
                        if (overlapDuration > availableHours) {
                            availableHours = overlapDuration;
                            isAvailable = true;
                        }
                    }
                }
                if (isAvailable) {
                    eligibleStaff.push({ ...staff, availableHours, shiftDuration });
                }
            }
            
            eligibleStaff.sort((a, b) => b.availableHours - a.availableHours);
            const toAssign = eligibleStaff.slice(0, needed);
            for (const staff of toAssign) {
                if (!shift.assigned_staff) shift.assigned_staff = [];
                shift.assigned_staff.push(staff.id);
                totalAssignments++;
                assignmentDetails.push({
                    shift_id: shift.id,
                    shift_date: shift.date,
                    shift_time: `${shift.start_time}-${shift.end_time}`,
                    staff_id: staff.id,
                    staff_name: staff.name,
                    coverage: staff.availableHours === shiftDuration ? 'full' : 'partial'
                });
            }
        }
        
        res.json({ 
            message: `Auto-scheduled ${totalAssignments} assignment${totalAssignments !== 1 ? 's' : ''}`,
            assignments_made: totalAssignments,
            assignments: assignmentDetails
        });
    } catch (error) {
        console.error('Auto-schedule error:', error);
        res.status(500).json({ error: 'Auto-scheduling failed' });
    }
});

// ============ SWAP REQUESTS ============

app.post('/api/swap-requests', authenticateToken, (req, res) => {
    const { shift_id, target_user_id, reason } = req.body;
    const shift = shifts.find(s => s.id === shift_id);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    if (!shift.assigned_staff?.includes(req.user.id)) return res.status(403).json({ error: 'Not assigned to this shift' });
    const request = { 
        id: nextSwapId++, 
        from_user_id: req.user.id, 
        to_user_id: target_user_id, 
        from_shift_id: shift_id, 
        reason: reason || '', 
        status: 'pending', 
        createdAt: new Date().toISOString() 
    };
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
    const request = { 
        id: nextLeaveId++, 
        user_id: req.user.id, 
        start_date, 
        end_date, 
        reason: reason || '', 
        status: 'pending', 
        createdAt: new Date().toISOString() 
    };
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

// ============ TIME CLOCK ============

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
    const start = new Date(entry.clock_in);
    const end = new Date(entry.clock_out);
    entry.duration = Math.round((end - start) / (1000 * 60 * 60) * 10) / 10;
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
        return { ...te, user_name: user?.name, user_email: user?.email };
    });
    res.json(enriched);
});

// ============ STATISTICS ============

app.get('/api/stats', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const currentlyClockedIn = timeEntries.filter(te => !te.clock_out).length;
    res.json({
        totalStaff: users.filter(u => u.role === 'staff').length,
        totalShifts: shifts.length,
        filledShifts: shifts.filter(s => (s.assigned_staff?.length || 0) >= s.min_staff).length,
        pendingSwaps: swapRequests.filter(sr => sr.status === 'pending').length,
        pendingLeave: leaveRequests.filter(lr => lr.status === 'pending').length,
        currentlyClockedIn: currentlyClockedIn,
        totalAvailabilityRecords: availability.length
    });
});

// ============ MESSAGES ============

app.get('/api/messages', authenticateToken, (req, res) => {
    const recentMessages = messages.slice(-100).map(m => ({
        ...m,
        userName: users.find(u => u.id === m.userId)?.name || m.userName
    }));
    res.json(recentMessages);
});

// ============ DOCUMENTS ============

app.post('/api/documents/upload', authenticateToken, (req, res) => {
    const doc = {
        id: nextDocId++,
        userId: req.user.id,
        userName: users.find(u => u.id === req.user.id)?.name,
        originalName: req.body.name || `document_${nextDocId}`,
        description: req.body.description || '',
        uploadDate: new Date().toISOString(),
        downloadUrl: "#"
    };
    documents.push(doc);
    res.json(doc);
});

app.get('/api/documents', authenticateToken, (req, res) => {
    res.json(documents);
});

app.delete('/api/documents/:id', authenticateToken, (req, res) => {
    const id = parseInt(req.params.id);
    const index = documents.findIndex(d => d.id === id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    documents.splice(index, 1);
    res.json({ message: 'Deleted' });
});

// ============ AI ASSISTANT ============
// In-memory conversation history (per user)
const conversationMemory = new Map();

app.post('/api/ai/chat', authenticateToken, async (req, res) => {
    try {
        const { message } = req.body;
        const userId = req.user.id;
        const user = users.find(u => u.id === userId);

        // ----- User data -----
        const userShifts = shifts.filter(s => s.assigned_staff?.includes(userId));
        const userAvailability = availability.filter(a => a.user_id === userId && a.is_available);
        const userSwapRequests = swapRequests.filter(sr => sr.from_user_id === userId || sr.to_user_id === userId);
        const userLeaveRequests = leaveRequests.filter(lr => lr.user_id === userId);
        const isClockedIn = timeEntries.some(te => te.user_id === userId && !te.clock_out);

        // ----- Build context -----
        let context = `User: ${user.name} (${user.role})\n`;
        if (userShifts.length) {
            context += `Upcoming shifts:\n${userShifts.map(s => `- ${s.date} ${s.start_time}–${s.end_time} (${s.location || 'Main Store'})`).join('\n')}\n`;
        } else {
            context += `No upcoming shifts.\n`;
        }
        if (userAvailability.length) {
            context += `Availability:\n${userAvailability.map(a => `- ${a.date} ${a.start_time}–${a.end_time}`).join('\n')}\n`;
        } else {
            context += `No availability set.\n`;
        }
        if (userSwapRequests.length) {
            context += `Swap requests: ${userSwapRequests.map(sr => `${sr.from_user_id === userId ? 'You requested' : 'Requested to you'} (status: ${sr.status})`).join('; ')}\n`;
        }
        if (userLeaveRequests.length) {
            context += `Leave requests: ${userLeaveRequests.map(lr => `${lr.start_date} to ${lr.end_date} (${lr.status})`).join('; ')}\n`;
        }
        context += `Current clock status: ${isClockedIn ? 'Clocked in' : 'Not clocked in'}\n`;

        // ----- Conversation memory -----
        let conversation = conversationMemory.get(userId) || [];
        if (conversation.length > 20) conversation = conversation.slice(-20);
        conversation.push({ role: 'user', content: message });

        // ----- Generate reply (Gemini if key present, else smart fallback) -----
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        let reply;

        if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_key_here') {
            const prompt = `You are a helpful assistant for ShiftFlow Pro. Use this user data:\n${context}\nConversation:\n${conversation.map(m => `${m.role}: ${m.content}`).join('\n')}\nNow answer the user's last message directly.`;
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 300 }
                })
            });
            const data = await response.json();
            reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
        } else {
            // Smart fallback using real data
            const lowerMsg = message.toLowerCase();
            if (lowerMsg.includes('availability') || lowerMsg.includes('available')) {
                if (userAvailability.length === 0) {
                    reply = "You haven't set any availability yet. Go to the Calendar page, click on a date, and select your available time slots. You can also repeat for multiple weeks. Need help?";
                } else {
                    reply = `You are available on: ${userAvailability.map(a => `${a.date} ${a.start_time}–${a.end_time}`).join('; ')}. Want to add more?`;
                }
            } else if (lowerMsg.includes('shift')) {
                if (userShifts.length === 0) {
                    reply = "You have no upcoming shifts. If you're an admin, you can create shifts in the Admin Panel and use Auto-Schedule to assign staff.";
                } else {
                    reply = `Your upcoming shifts: ${userShifts.map(s => `${s.date} ${s.start_time}–${s.end_time}`).join('; ')}. Would you like to request a swap?`;
                }
            } else if (lowerMsg.includes('swap')) {
                reply = "To request a shift swap: go to the Dashboard, find your shift, click 'Request Swap', select another staff member, and submit. An admin will approve or deny it.";
            } else if (lowerMsg.includes('leave') || lowerMsg.includes('time off')) {
                reply = "To request time off: go to 'My Availability' and click 'Request Time Off'. Choose dates and submit. Admins will review your request.";
            } else if (lowerMsg.includes('clock')) {
                reply = isClockedIn ? "You are currently clocked in. To clock out, click the red 'Clock Out' button." : "You are not clocked in. Click the green 'Clock In' button to start tracking.";
            } else {
                reply = "I'm your ShiftFlow assistant. I can help with shifts, availability, swap requests, time off, clock in/out, auto-scheduling, and more. What would you like to know?";
            }
        }

        conversation.push({ role: 'assistant', content: reply });
        conversationMemory.set(userId, conversation);
        res.json({ reply });
    } catch (error) {
        console.error('AI endpoint error:', error);
        res.status(500).json({ error: 'AI service temporarily unavailable' });
    }
});
// ============ START SERVER ============

const PORT = process.env.PORT || 5001;

createAdmin().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
        console.log('\n' + '='.repeat(50));
        console.log('🚀 SHIFTFLOW PRO SERVER RUNNING');
        console.log('='.repeat(50));
        console.log(`📡 Server URL: http://localhost:${PORT}`);
        console.log(`🔧 API Test: http://localhost:${PORT}/api/test`);
        console.log(`💬 Socket.IO: ws://localhost:${PORT}`);
        console.log(`👥 Total Users: ${users.length}`);
        console.log(`✅ Admin Login: admin@example.com / admin123`);
        console.log('='.repeat(50) + '\n');
    });
});
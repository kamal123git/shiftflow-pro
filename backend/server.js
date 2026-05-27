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

// ============ ACADEMIC DATA ============
const units = [];
let nextUnitId = 1;
const courseSessions = [];
let nextSessionId = 1;
const staffExpertise = [];

// Predefined NAPS Units
const defaultUnits = [
    { code: "ITS306", name: "Penetration Testing", credits: 6, lecture_hours: 2, tutorial_hours: 2, tutorial_groups: 2 },
    { code: "ITS310", name: "Digital Forensics", credits: 6, lecture_hours: 2, tutorial_hours: 2, tutorial_groups: 2 },
    { code: "ITS320", name: "Capstone Experience", credits: 12, lecture_hours: 2, tutorial_hours: 3, tutorial_groups: 3 },
    { code: "ITS301", name: "Cyber Security Fundamentals", credits: 6, lecture_hours: 2, tutorial_hours: 2, tutorial_groups: 2 },
    { code: "ITS315", name: "Cloud Security", credits: 6, lecture_hours: 2, tutorial_hours: 2, tutorial_groups: 2 }
];

// Sample staff for NAPS
const sampleStaffData = [
    { name: "Dr. Smith", email: "smith@naps.edu.au", password: "smith123", expertise: ["ITS306", "ITS315"], experience_years: 10, qualification: "PhD", max_hours: 25, phone: "0412345678" },
    { name: "Prof. Johnson", email: "johnson@naps.edu.au", password: "johnson123", expertise: ["ITS310", "ITS320"], experience_years: 15, qualification: "PhD", max_hours: 20, phone: "0412345679" },
    { name: "Dr. Williams", email: "williams@naps.edu.au", password: "williams123", expertise: ["ITS306", "ITS310"], experience_years: 8, qualification: "PhD", max_hours: 30, phone: "0412345680" },
    { name: "Mr. Brown", email: "brown@naps.edu.au", password: "brown123", expertise: ["ITS301", "ITS315"], experience_years: 5, qualification: "Master", max_hours: 35, phone: "0412345681" },
    { name: "Ms. Davis", email: "davis@naps.edu.au", password: "davis123", expertise: ["ITS320", "ITS301"], experience_years: 6, qualification: "Master", max_hours: 35, phone: "0412345682" }
];

// ============ HELPER FUNCTIONS ============
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
}

function addHours(timeStr, hours) {
    const [h, m] = timeStr.split(':').map(Number);
    const newHour = h + hours;
    return `${String(newHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ============ INITIALIZE DATA ============
const initializeAcademicData = async () => {
    // Initialize units
    defaultUnits.forEach(unit => {
        const existing = units.find(u => u.code === unit.code);
        if (!existing) {
            units.push({
                id: nextUnitId++,
                ...unit,
                createdAt: new Date().toISOString()
            });
        }
    });
    console.log(`✅ Initialized ${units.length} academic units`);
    
    // Create sample staff if they don't exist
    for (const staffData of sampleStaffData) {
        const existingStaff = users.find(u => u.email === staffData.email);
        if (!existingStaff) {
            const hashedPassword = await bcrypt.hash(staffData.password, 10);
            const newStaff = {
                id: nextId++,
                name: staffData.name,
                email: staffData.email,
                password: hashedPassword,
                role: 'staff',
                phone: staffData.phone,
                max_hours_per_week: staffData.max_hours,
                experience_years: staffData.experience_years,
                qualification: staffData.qualification,
                createdAt: new Date().toISOString()
            };
            users.push(newStaff);
            
            // Add expertise
            staffData.expertise.forEach(unitCode => {
                staffExpertise.push({
                    staff_id: newStaff.id,
                    unit_code: unitCode,
                    expertise_level: 4,
                    experience_years: staffData.experience_years
                });
            });
        }
    }
    console.log(`✅ Staff users ready: ${users.filter(u => u.role === 'staff').length} staff members`);
};

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
        const { name, email, password, role = 'staff', phone = '', experience_years = 0, qualification = 'Bachelor' } = req.body;
        
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
            experience_years,
            qualification,
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
    const allUsers = users.map(u => ({ 
        id: u.id, 
        name: u.name, 
        email: u.email, 
        role: u.role, 
        phone: u.phone, 
        experience_years: u.experience_years || 0,
        qualification: u.qualification || 'N/A',
        createdAt: u.createdAt 
    }));
    res.json(allUsers);
});

app.get('/api/staff', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    res.json(users.filter(u => u.role === 'staff').map(u => ({ 
        id: u.id, 
        name: u.name, 
        email: u.email, 
        phone: u.phone,
        experience_years: u.experience_years || 0,
        qualification: u.qualification || 'N/A',
        max_hours_per_week: u.max_hours_per_week
    })));
});

app.get('/api/staff/expertise/:staffId', authenticateToken, (req, res) => {
    const staffId = parseInt(req.params.staffId);
    const expertise = staffExpertise.filter(e => e.staff_id === staffId);
    res.json(expertise);
});

app.post('/api/staff/expertise', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    
    const { staff_id, unit_code, expertise_level, experience_years } = req.body;
    
    const existing = staffExpertise.find(e => e.staff_id === staff_id && e.unit_code === unit_code);
    if (existing) {
        existing.expertise_level = expertise_level;
        existing.experience_years = experience_years;
    } else {
        staffExpertise.push({ staff_id, unit_code, expertise_level, experience_years });
    }
    
    res.json({ message: 'Expertise added' });
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

// ============ ACADEMIC UNITS & COURSES ============

app.get('/api/units', authenticateToken, (req, res) => {
    res.json(units);
});

app.post('/api/units/init', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    res.json({ message: 'Units ready', units });
});

// Create course sessions (lecture + tutorials)
app.post('/api/course-sessions', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    
    const { unit_code, lecture_day, lecture_time, tutorial_days, tutorial_times, tutorial_groups } = req.body;
    
    const unit = units.find(u => u.code === unit_code);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    
    const createdSessions = [];
    
    // Create lecture session
    const lectureSession = {
        id: nextSessionId++,
        unit_code,
        type: 'lecture',
        day: lecture_day,
        start_time: lecture_time,
        end_time: addHours(lecture_time, 2),
        staff_id: null,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    courseSessions.push(lectureSession);
    createdSessions.push(lectureSession);
    
    // Create tutorial sessions
    for (let i = 1; i <= tutorial_groups; i++) {
        const tutorialSession = {
            id: nextSessionId++,
            unit_code,
            type: 'tutorial',
            group_number: i,
            day: tutorial_days[i-1] || tutorial_days[0],
            start_time: tutorial_times[i-1] || tutorial_times[0],
            end_time: addHours(tutorial_times[i-1] || tutorial_times[0], 2),
            staff_id: null,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        courseSessions.push(tutorialSession);
        createdSessions.push(tutorialSession);
    }
    
    res.json({ message: `Created ${createdSessions.length} sessions`, sessions: createdSessions });
});

app.get('/api/course-sessions', authenticateToken, (req, res) => {
    const sessionsWithDetails = courseSessions.map(session => {
        const staff = users.find(u => u.id === session.staff_id);
        const unit = units.find(u => u.code === session.unit_code);
        return {
            ...session,
            staff_name: staff?.name || 'Unassigned',
            unit_name: unit?.name || session.unit_code
        };
    });
    res.json(sessionsWithDetails);
});

// ============ ACADEMIC AUTO-SCHEDULER ============

function checkAcademicAvailability(staffId, day, startTime, endTime, availabilityList) {
    const daysMap = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 0 };
    
    const today = new Date();
    const currentDay = today.getDay();
    const targetDay = daysMap[day];
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd < 0) daysToAdd += 7;
    
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysToAdd);
    const dateStr = targetDate.toISOString().split('T')[0];
    
    const staffAvail = availabilityList.filter(a => 
        a.user_id === staffId && a.date === dateStr && a.is_available === true
    );
    
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    
    return staffAvail.some(avail => {
        const availStart = timeToMinutes(avail.start_time);
        const availEnd = timeToMinutes(avail.end_time);
        return availStart <= startMin && availEnd >= endMin;
    });
}

app.post('/api/auto-schedule/academic', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
        
        const staffList = users.filter(u => u.role === 'staff');
        const unassignedSessions = courseSessions.filter(s => s.staff_id === null);
        const assignments = [];
        
        const staffHours = {};
        staffList.forEach(s => { staffHours[s.id] = 0; });
        
        const staffSchedule = {};
        staffList.forEach(s => { staffSchedule[s.id] = []; });
        
        for (const session of unassignedSessions) {
            const eligibleStaff = [];
            
            for (const staff of staffList) {
                const expertise = staffExpertise.find(e => 
                    e.staff_id === staff.id && e.unit_code === session.unit_code
                );
                
                if (!expertise && session.type === 'lecture') continue;
                
                const isAvailable = checkAcademicAvailability(staff.id, session.day, session.start_time, session.end_time, availability);
                
                const isBooked = staffSchedule[staff.id].some(s => 
                    s.day === session.day && 
                    ((s.start_time <= session.start_time && s.end_time >= session.start_time) ||
                     (s.start_time <= session.end_time && s.end_time >= session.end_time))
                );
                
                const sessionHours = 2;
                const wouldExceed = (staffHours[staff.id] + sessionHours) > (staff.max_hours_per_week || 40);
                
                if (isAvailable && !isBooked && !wouldExceed) {
                    eligibleStaff.push({
                        ...staff,
                        expertise_level: expertise?.expertise_level || 0,
                        experience_years: expertise?.experience_years || staff.experience_years || 0,
                        currentHours: staffHours[staff.id]
                    });
                }
            }
            
            eligibleStaff.sort((a, b) => {
                if (session.type === 'lecture') {
                    if (a.expertise_level !== b.expertise_level) return b.expertise_level - a.expertise_level;
                }
                if (a.experience_years !== b.experience_years) return b.experience_years - a.experience_years;
                return a.currentHours - b.currentHours;
            });
            
            if (eligibleStaff.length > 0) {
                const assignedStaff = eligibleStaff[0];
                session.staff_id = assignedStaff.id;
                session.status = 'assigned';
                staffHours[assignedStaff.id] += 2;
                staffSchedule[assignedStaff.id].push({
                    day: session.day,
                    start_time: session.start_time,
                    end_time: session.end_time,
                    unit: session.unit_code,
                    type: session.type,
                    group: session.group_number
                });
                
                assignments.push({
                    unit_code: session.unit_code,
                    type: session.type,
                    group: session.group_number || null,
                    day: session.day,
                    time: `${session.start_time}-${session.end_time}`,
                    staff_name: assignedStaff.name,
                    staff_id: assignedStaff.id,
                    expertise_level: eligibleStaff[0].expertise_level,
                    experience_years: eligibleStaff[0].experience_years
                });
            }
        }
        
        res.json({ 
            message: `Assigned ${assignments.length} of ${unassignedSessions.length} sessions`,
            assignments: assignments,
            staff_hours: staffHours,
            unassigned_remaining: unassignedSessions.length - assignments.length
        });
        
    } catch (error) {
        console.error('Academic auto-schedule error:', error);
        res.status(500).json({ error: 'Scheduling failed' });
    }
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

// ============ AVAILABILITY MANAGEMENT ============

app.post('/api/availability', authenticateToken, async (req, res) => {
    try {
        const { date, start_time, end_time, is_available } = req.body;
        
        if (!date || start_time === undefined || end_time === undefined) {
            return res.status(400).json({ error: 'Missing date, start_time, or end_time' });
        }
        
        const startStr = String(start_time);
        const endStr = String(end_time);
        
        const existingIndex = availability.findIndex(a => 
            a.user_id === req.user.id && 
            a.date === date && 
            a.start_time === startStr && 
            a.end_time === endStr
        );
        
        if (existingIndex !== -1) {
            availability[existingIndex].is_available = is_available === true;
            return res.json(availability[existingIndex]);
        }
        
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

// ============ REGULAR AUTO-SCHEDULE ============

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
        totalAvailabilityRecords: availability.length,
        academicUnits: units.length,
        academicSessions: courseSessions.length
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

app.post('/api/ai/chat', authenticateToken, async (req, res) => {
    try {
        const { message } = req.body;
        const userId = req.user.id;
        const user = users.find(u => u.id === userId);
        
        const userShifts = shifts.filter(s => s.assigned_staff?.includes(userId));
        const userAvailability = availability.filter(a => a.user_id === userId && a.is_available);
        
        let context = `User: ${user.name} (${user.role}). `;
        if (userShifts.length > 0) {
            context += `Upcoming shifts: ${userShifts.slice(0,5).map(s => `${s.date} ${s.start_time}-${s.end_time}`).join(', ')}. `;
        } else {
            context += `No upcoming shifts. `;
        }
        if (userAvailability.length > 0) {
            context += `Available times: ${userAvailability.slice(0,5).map(a => `${a.date} ${a.start_time}-${a.end_time}`).join(', ')}. `;
        }
        
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        let reply;
        
        if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_key_here') {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `You are a helpful assistant for a staff scheduling app. Here is the user's real data: ${context}. The user asks: "${message}". Answer concisely and helpfully.`
                        }]
                    }]
                })
            });
            const data = await response.json();
            reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";
        } else {
            const lowerMsg = message.toLowerCase();
            if (lowerMsg.includes('availability') || lowerMsg.includes('available')) {
                if (userAvailability.length === 0) {
                    reply = "You haven't set any availability yet. Go to the Calendar page, click on a date, and select your available time slots.";
                } else {
                    reply = `You are available on: ${userAvailability.map(a => `${a.date} ${a.start_time}-${a.end_time}`).join('; ')}. To add more, click on any date in the calendar.`;
                }
            } else if (lowerMsg.includes('shift')) {
                if (userShifts.length === 0) {
                    reply = "You have no upcoming shifts. If you're an admin, you can create shifts in the Admin Panel.";
                } else {
                    reply = `Your upcoming shifts: ${userShifts.map(s => `${s.date} ${s.start_time}-${s.end_time}`).join('; ')}.`;
                }
            } else {
                reply = "I'm your ShiftFlow assistant. You can ask me about your shifts, availability, or how to use the system.";
            }
        }
        
        res.json({ reply });
    } catch (error) {
        console.error('AI endpoint error:', error);
        res.status(500).json({ error: 'AI service temporarily unavailable' });
    }
});
// ============ STAFF PROFILE UPDATE ============

// Update staff profile
app.put('/api/staff/profile', authenticateToken, async (req, res) => {
    try {
        const { phone, experience_years, qualification, max_hours_per_week } = req.body;
        const userId = req.user.id;
        
        const user = users.find(u => u.id === userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (phone !== undefined) user.phone = phone;
        if (experience_years !== undefined) user.experience_years = experience_years;
        if (qualification !== undefined) user.qualification = qualification;
        if (max_hours_per_week !== undefined) user.max_hours_per_week = max_hours_per_week;
        
        res.json({ 
            message: 'Profile updated successfully',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                experience_years: user.experience_years,
                qualification: user.qualification,
                max_hours_per_week: user.max_hours_per_week
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Get staff profile
app.get('/api/staff/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            experience_years: user.experience_years || 0,
            qualification: user.qualification || 'Bachelor',
            max_hours_per_week: user.max_hours_per_week || 40,
            role: user.role
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});
// ============ ACADEMIC SHIFTS (LECTURES & TUTORIALS) ============

// Create academic shift (lecture or tutorial)
app.post('/api/academic-shifts', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    
    const { unit_code, type, date, start_time, end_time, group_number, required_expertise } = req.body;
    
    const unit = units.find(u => u.code === unit_code);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    
    const newShift = {
        id: nextShiftId++,
        shift_type: 'academic',
        unit_code,
        unit_name: unit.name,
        type, // 'lecture' or 'tutorial'
        group_number: group_number || null,
        date,
        start_time,
        end_time,
        required_expertise: required_expertise || (type === 'lecture' ? 4 : 2),
        assigned_staff: [],
        assigned_count: 0,
        status: 'pending',
        created_by: req.user.id,
        createdAt: new Date().toISOString()
    };
    shifts.push(newShift);
    res.json(newShift);
});

// Get all academic shifts grouped by unit
app.get('/api/academic-shifts', authenticateToken, (req, res) => {
    const academicShifts = shifts.filter(s => s.shift_type === 'academic');
    
    const grouped = {};
    academicShifts.forEach(shift => {
        if (!grouped[shift.unit_code]) {
            grouped[shift.unit_code] = {
                unit_code: shift.unit_code,
                unit_name: shift.unit_name,
                lectures: [],
                tutorials: []
            };
        }
        if (shift.type === 'lecture') {
            grouped[shift.unit_code].lectures.push({
                id: shift.id,
                date: shift.date,
                start_time: shift.start_time,
                end_time: shift.end_time,
                staff: shift.assigned_staff?.map(s => {
                    const staff = users.find(u => u.id === s);
                    return { id: staff?.id, name: staff?.name };
                }) || [],
                status: shift.status
            });
        } else {
            grouped[shift.unit_code].tutorials.push({
                id: shift.id,
                group_number: shift.group_number,
                date: shift.date,
                start_time: shift.start_time,
                end_time: shift.end_time,
                staff: shift.assigned_staff?.map(s => {
                    const staff = users.find(u => u.id === s);
                    return { id: staff?.id, name: staff?.name };
                }) || [],
                status: shift.status
            });
        }
    });
    
    res.json(Object.values(grouped));
});

// Get my teaching assignments (for staff dashboard)
app.get('/api/my-teaching', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const myShifts = shifts.filter(s => s.assigned_staff?.includes(userId));
    
    const teaching = {
        lectures: [],
        tutorials: []
    };
    
    myShifts.forEach(shift => {
        const item = {
            id: shift.id,
            unit_code: shift.unit_code,
            unit_name: shift.unit_name,
            date: shift.date,
            start_time: shift.start_time,
            end_time: shift.end_time,
            type: shift.type,
            group_number: shift.group_number,
            status: shift.status
        };
        
        if (shift.type === 'lecture') {
            teaching.lectures.push(item);
        } else {
            teaching.tutorials.push(item);
        }
    });
    
    res.json(teaching);
});

// Academic Auto-Scheduler (assigns staff based on expertise, experience, availability)
app.post('/api/academic-auto-schedule', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
        
        const academicShifts = shifts.filter(s => s.shift_type === 'academic' && s.assigned_staff?.length === 0);
        const staffList = users.filter(u => u.role === 'staff');
        const assignments = [];
        
        // Calculate current hours per staff
        const staffHours = {};
        staffList.forEach(s => { staffHours[s.id] = 0; });
        
        // Track staff schedule to avoid double-booking
        const staffSchedule = {};
        staffList.forEach(s => { staffSchedule[s.id] = []; });
        
        for (const shift of academicShifts) {
            const eligibleStaff = [];
            
            for (const staff of staffList) {
                // Check expertise
                const expertise = staffExpertise.find(e => 
                    e.staff_id === staff.id && e.unit_code === shift.unit_code
                );
                
                const expertiseLevel = expertise?.expertise_level || 0;
                if (expertiseLevel < shift.required_expertise) continue;
                
                // Check availability for this date/time
                const isAvailable = checkAvailabilityForDateTime(staff.id, shift.date, shift.start_time, shift.end_time, availability);
                if (!isAvailable) continue;
                
                // Check if already scheduled at same time
                const isBooked = staffSchedule[staff.id].some(s => 
                    s.date === shift.date && 
                    ((s.start_time <= shift.start_time && s.end_time >= shift.start_time) ||
                     (s.start_time <= shift.end_time && s.end_time >= shift.end_time))
                );
                if (isBooked) continue;
                
                // Check max hours
                const shiftHours = calculateHours(shift.start_time, shift.end_time);
                const wouldExceed = (staffHours[staff.id] + shiftHours) > (staff.max_hours_per_week || 40);
                if (wouldExceed) continue;
                
                eligibleStaff.push({
                    ...staff,
                    expertise_level: expertiseLevel,
                    experience_years: expertise?.experience_years || staff.experience_years || 0,
                    currentHours: staffHours[staff.id],
                    shiftHours
                });
            }
            
            // Sort: higher expertise first, then more experience, then fewer hours
            eligibleStaff.sort((a, b) => {
                if (a.expertise_level !== b.expertise_level) return b.expertise_level - a.expertise_level;
                if (a.experience_years !== b.experience_years) return b.experience_years - a.experience_years;
                return a.currentHours - b.currentHours;
            });
            
            if (eligibleStaff.length > 0) {
                const assigned = eligibleStaff[0];
                shift.assigned_staff = [assigned.id];
                shift.assigned_count = 1;
                shift.status = 'assigned';
                staffHours[assigned.id] += assigned.shiftHours;
                staffSchedule[assigned.id].push({
                    date: shift.date,
                    start_time: shift.start_time,
                    end_time: shift.end_time,
                    unit: shift.unit_code,
                    type: shift.type
                });
                
                assignments.push({
                    unit_code: shift.unit_code,
                    unit_name: shift.unit_name,
                    type: shift.type,
                    group_number: shift.group_number,
                    date: shift.date,
                    time: `${shift.start_time}-${shift.end_time}`,
                    staff_name: assigned.name,
                    staff_id: assigned.id,
                    expertise_level: assigned.expertise_level
                });
            }
        }
        
        res.json({ 
            message: `Assigned ${assignments.length} academic sessions`,
            assignments: assignments,
            unassigned: academicShifts.length - assignments.length
        });
        
    } catch (error) {
        console.error('Academic auto-schedule error:', error);
        res.status(500).json({ error: 'Scheduling failed' });
    }
});

// Helper: Check availability for a specific date and time
function checkAvailabilityForDateTime(staffId, date, startTime, endTime, availabilityList) {
    const staffAvail = availabilityList.filter(a => 
        a.user_id === staffId && a.date === date && a.is_available === true
    );
    
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    
    return staffAvail.some(avail => {
        const availStart = timeToMinutes(avail.start_time);
        const availEnd = timeToMinutes(avail.end_time);
        return availStart <= startMin && availEnd >= endMin;
    });
}

// Helper: Calculate hours between two times
function calculateHours(startTime, endTime) {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    return (end - start) / 60;
}

// ============ START SERVER ============

const PORT = process.env.PORT || 5001;

const startServer = async () => {
    await createAdmin();
    await initializeAcademicData();
    
    server.listen(PORT, '0.0.0.0', () => {
        console.log('\n' + '='.repeat(50));
        console.log('🚀 SHIFTFLOW PRO SERVER RUNNING');
        console.log('='.repeat(50));
        console.log(`📡 Server URL: http://localhost:${PORT}`);
        console.log(`🔧 API Test: http://localhost:${PORT}/api/test`);
        console.log(`💬 Socket.IO: ws://localhost:${PORT}`);
        console.log(`👥 Total Users: ${users.length}`);
        console.log(`📚 Academic Units: ${units.length}`);
        console.log(`👨‍🏫 Staff Members: ${users.filter(u => u.role === 'staff').length}`);
        console.log(`✅ Admin Login: admin@example.com / admin123`);
        console.log('='.repeat(50) + '\n');
    });
};

startServer();
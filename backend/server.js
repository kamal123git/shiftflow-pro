import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import axios from 'axios';
import toast from 'react-hot-toast';

const CalendarAvailability = ({ token, userId, isAdmin = false, staffId = null }) => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [availability, setAvailability] = useState({});
    const [loading, setLoading] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [allStaffAvailability, setAllStaffAvailability] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [staffList, setStaffList] = useState([]);
    
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    
    const timeSlots = [
        { start: '06:00', end: '09:00', label: '🌅 Early Morning', icon: '🌅', color: 'bg-orange-100' },
        { start: '09:00', end: '12:00', label: '☀️ Morning', icon: '☀️', color: 'bg-yellow-100' },
        { start: '12:00', end: '15:00', label: '🌤️ Afternoon', icon: '🌤️', color: 'bg-blue-100' },
        { start: '15:00', end: '18:00', label: '🌙 Late Afternoon', icon: '🌙', color: 'bg-indigo-100' },
        { start: '18:00', end: '21:00', label: '⭐ Evening', icon: '⭐', color: 'bg-purple-100' },
        { start: '21:00', end: '00:00', label: '🌃 Night', icon: '🌃', color: 'bg-gray-800 text-white' }
    ];
    
    useEffect(() => {
        if (!isAdmin) {
            fetchAvailability();
        } else {
            fetchAllStaffAvailability();
            fetchStaffList();
        }
    }, [selectedDate, isAdmin]);
    
    const fetchAvailability = async () => {
        try {
            const dateStr = selectedDate.toISOString().split('T')[0];
            const res = await axios.get(`${API_URL}/availability`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const availMap = {};
            res.data.forEach(avail => {
                const key = `${avail.date}_${avail.start_time}`;
                availMap[key] = avail.is_available;
            });
            setAvailability(availMap);
        } catch (error) {
            console.error('Failed to fetch availability');
        }
    };
    
    const fetchAllStaffAvailability = async () => {
        try {
            const res = await axios.get(`${API_URL}/availability/staff/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAllStaffAvailability(res.data);
        } catch (error) {
            console.error('Failed to fetch staff availability');
        }
    };
    
    const fetchStaffList = async () => {
        try {
            const res = await axios.get(`${API_URL}/staff`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStaffList(res.data);
        } catch (error) {
            console.error('Failed to fetch staff list');
        }
    };
    
    const toggleAvailability = async (slot, date = selectedDate) => {
        const dateStr = date.toISOString().split('T')[0];
        const key = `${dateStr}_${slot.start}`;
        const currentValue = availability[key] || false;
        
        setLoading(true);
        try {
            await axios.post(`${API_URL}/availability`, {
                date: dateStr,
                start_time: slot.start,
                end_time: slot.end,
                is_available: !currentValue
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setAvailability({ ...availability, [key]: !currentValue });
            toast.success(`${!currentValue ? 'Available' : 'Unavailable'} for ${slot.label} on ${dateStr}`);
        } catch (error) {
            toast.error('Failed to update availability');
        } finally {
            setLoading(false);
        }
    };
    
    const getDateStatus = (date) => {
        const dateStr = date.toISOString().split('T')[0];
        const slotsForDate = timeSlots.filter(slot => availability[`${dateStr}_${slot.start}`]);
        const availableCount = slotsForDate.filter(slot => availability[`${dateStr}_${slot.start}`]).length;
        
        if (availableCount === 0) return 'unavailable';
        if (availableCount === timeSlots.length) return 'full';
        return 'partial';
    };
    
    const getStaffAvailabilityForDate = (staffId, date) => {
        const dateStr = date.toISOString().split('T')[0];
        const staffAvail = allStaffAvailability.filter(a => 
            a.staff_id === staffId && a.date === dateStr && a.is_available === true
        );
        return staffAvail;
    };
    
    const tileClassName = ({ date, view }) => {
        if (view !== 'month') return null;
        
        if (!isAdmin) {
            const status = getDateStatus(date);
            if (status === 'full') return 'bg-green-500 text-white rounded-full';
            if (status === 'partial') return 'bg-yellow-500 text-white rounded-full';
            if (status === 'unavailable') return 'bg-gray-200 rounded-full';
        } else if (selectedStaff) {
            const staffAvail = getStaffAvailabilityForDate(selectedStaff, date);
            if (staffAvail.length > 0) return 'bg-green-500 text-white rounded-full';
        }
        return null;
    };
    
    const tileContent = ({ date, view }) => {
        if (view !== 'month') return null;
        
        if (!isAdmin) {
            const status = getDateStatus(date);
            if (status === 'full') return <span className="text-xs">✓✓</span>;
            if (status === 'partial') return <span className="text-xs">~</span>;
        } else if (selectedStaff) {
            const staffAvail = getStaffAvailabilityForDate(selectedStaff, date);
            if (staffAvail.length > 0) {
                return (
                    <div className="text-xs mt-1">
                        {staffAvail.map(avail => (
                            <div key={avail.id} className="text-green-600">
                                {avail.start_time.slice(0,5)}
                            </div>
                        ))}
                    </div>
                );
            }
        }
        return null;
    };
    
    // Staff Calendar View for Admin
    if (isAdmin) {
        return (
            <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-2xl font-bold mb-6">👥 Staff Availability Calendar</h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Staff List */}
                    <div className="bg-gray-50 rounded-xl p-4">
                        <h3 className="font-semibold mb-3">Select Staff Member</h3>
                        <div className="space-y-2">
                            <button
                                onClick={() => setSelectedStaff(null)}
                                className={`w-full text-left p-3 rounded-lg transition ${!selectedStaff ? 'bg-blue-500 text-white' : 'bg-white hover:bg-gray-100'}`}
                            >
                                📊 Overview
                            </button>
                            {staffList.map(staff => (
                                <button
                                    key={staff.id}
                                    onClick={() => setSelectedStaff(staff.id)}
                                    className={`w-full text-left p-3 rounded-lg transition ${selectedStaff === staff.id ? 'bg-blue-500 text-white' : 'bg-white hover:bg-gray-100'}`}
                                >
                                    <div className="font-medium">{staff.name}</div>
                                    <div className="text-xs opacity-75">{staff.email}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {/* Calendar */}
                    <div className="lg:col-span-3">
                        <Calendar
                            onChange={setSelectedDate}
                            value={selectedDate}
                            tileClassName={tileClassName}
                            tileContent={tileContent}
                            className="w-full border-0 shadow-sm rounded-xl"
                        />
                        
                        {selectedStaff && (
                            <div className="mt-6">
                                <h3 className="font-semibold mb-3">
                                    Availability for {new Date(selectedDate).toDateString()}
                                </h3>
                                <div className="space-y-2">
                                    {getStaffAvailabilityForDate(selectedStaff, selectedDate).map(avail => (
                                        <div key={avail.id} className="bg-green-50 p-3 rounded-lg border border-green-200">
                                            <div className="flex justify-between items-center">
                                                <span>{avail.start_time} - {avail.end_time}</span>
                                                <span className="text-green-600">✓ Available</span>
                                            </div>
                                        </div>
                                    ))}
                                    {getStaffAvailabilityForDate(selectedStaff, selectedDate).length === 0 && (
                                        <div className="text-gray-400 text-center py-8">
                                            No availability set for this date
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }
    
    // Staff Calendar View
    return (
        <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-2">📅 My Availability Calendar</h2>
            <p className="text-gray-500 mb-6">Click on any date to set your availability for that day</p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Calendar */}
                <div>
                    <Calendar
                        onChange={setSelectedDate}
                        value={selectedDate}
                        tileClassName={tileClassName}
                        className="w-full border-0 shadow-sm rounded-xl"
                    />
                    
                    <div className="flex justify-center gap-4 mt-4 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                            <span>Full Day Available</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                            <span>Partially Available</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-gray-300 rounded-full"></div>
                            <span>Not Available</span>
                        </div>
                    </div>
                </div>
                
                {/* Time Slots for Selected Date */}
                <div className="bg-gray-50 rounded-xl p-5">
                    <h3 className="text-lg font-semibold mb-4">
                        {selectedDate.toDateString()}
                    </h3>
                    
                    <div className="space-y-3">
                        {timeSlots.map(slot => {
                            const dateStr = selectedDate.toISOString().split('T')[0];
                            const key = `${dateStr}_${slot.start}`;
                            const isAvailable = availability[key] || false;
                            
                            return (
                                <button
                                    key={slot.start}
                                    onClick={() => toggleAvailability(slot)}
                                    disabled={loading}
                                    className={`w-full p-4 rounded-xl border-2 transition-all flex items-center justify-between ${isAvailable ? 'bg-green-50 border-green-500' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{slot.icon}</span>
                                        <div className="text-left">
                                            <div className="font-medium">{slot.label}</div>
                                            <div className="text-sm text-gray-500">{slot.start} - {slot.end}</div>
                                        </div>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-sm ${isAvailable ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                        {isAvailable ? 'Available ✓' : 'Unavailable'}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    
                    <div className="mt-4 text-center text-sm text-gray-500">
                        💡 Tip: Click on any time slot to toggle your availability
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalendarAvailability;
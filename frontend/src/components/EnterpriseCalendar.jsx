import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import multiMonthPlugin from '@fullcalendar/multimonth';
import axios from 'axios';
import toast from 'react-hot-toast';

const EnterpriseCalendar = ({ token, userId, isAdmin = false }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [selectedStart, setSelectedStart] = useState(null);
    const [selectedEnd, setSelectedEnd] = useState(null);
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('17:00');
    const [isAllDay, setIsAllDay] = useState(false);
    const [recurringWeeks, setRecurringWeeks] = useState(0);
    const [staffList, setStaffList] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [currentView, setCurrentView] = useState('dayGridMonth');
    const calendarRef = useRef(null);
    
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    
    const formatDate = (date) => {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    
    const getTimeString = (date) => {
        const d = new Date(date);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    
    // Fetch availability
    const fetchMyAvailability = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_URL}/availability`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const formattedEvents = res.data
                .filter(a => a.is_available === true)
                .map(a => {
                    let start = new Date(`${a.date}T${a.start_time}:00`);
                    let end = new Date(`${a.date}T${a.end_time}:00`);
                    
                    if (a.end_time === '00:00') {
                        end = new Date(end);
                        end.setDate(end.getDate() + 1);
                    }
                    
                    return {
                        id: a.id,
                        title: a.start_time === '00:00' && a.end_time === '23:59' ? '✅ All Day Available' : `✅ ${a.start_time} - ${a.end_time}`,
                        start: start,
                        end: end,
                        allDay: a.start_time === '00:00' && a.end_time === '23:59',
                        backgroundColor: '#10B981',
                        borderColor: '#059669',
                        textColor: 'white',
                        extendedProps: { type: 'availability' }
                    };
                });
            setEvents(formattedEvents);
        } catch (error) {
            console.error('Failed to fetch availability', error);
        } finally {
            setLoading(false);
        }
    };
    
    const fetchStaffAvailability = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_URL}/availability/staff/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            let filteredData = res.data;
            if (selectedStaff) {
                filteredData = res.data.filter(a => a.user_id === selectedStaff);
            }
            
            const formattedEvents = filteredData
                .filter(a => a.is_available === true)
                .map(a => {
                    let start = new Date(`${a.date}T${a.start_time}:00`);
                    let end = new Date(`${a.date}T${a.end_time}:00`);
                    
                    if (a.end_time === '00:00') {
                        end = new Date(end);
                        end.setDate(end.getDate() + 1);
                    }
                    
                    return {
                        id: a.id,
                        title: `${a.staff_name}: ${a.start_time === '00:00' && a.end_time === '23:59' ? 'All Day' : `${a.start_time}-${a.end_time}`}`,
                        start: start,
                        end: end,
                        allDay: a.start_time === '00:00' && a.end_time === '23:59',
                        backgroundColor: '#10B981',
                        borderColor: '#059669',
                        textColor: 'white',
                        extendedProps: { staffName: a.staff_name, staffId: a.user_id }
                    };
                });
            setEvents(formattedEvents);
        } catch (error) {
            console.error('Failed to fetch staff availability', error);
        } finally {
            setLoading(false);
        }
    };
    
    const fetchStaffList = async () => {
        try {
            const res = await axios.get(`${API_URL}/staff`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStaffList(res.data);
        } catch (error) {
            console.error('Failed to fetch staff list', error);
        }
    };
    
    useEffect(() => {
        if (isAdmin) {
            fetchStaffList();
            fetchStaffAvailability();
        } else {
            fetchMyAvailability();
        }
    }, [selectedStaff, isAdmin]);
    
    // Handle date selection (click & drag)
    const handleDateSelect = (selectInfo) => {
        setSelectedStart(selectInfo.start);
        setSelectedEnd(selectInfo.end);
        setStartTime(getTimeString(selectInfo.start));
        setEndTime(getTimeString(selectInfo.end));
        setIsAllDay(selectInfo.allDay);
        setSelectedEvent(null);
        setRecurringWeeks(0);
        setShowModal(true);
    };
    
    // Handle event click
    const handleEventClick = (clickInfo) => {
        setSelectedEvent(clickInfo.event);
        setSelectedStart(clickInfo.event.start);
        setSelectedEnd(clickInfo.event.end);
        setIsAllDay(clickInfo.event.allDay);
        setShowModal(true);
    };
    
    // Add single availability
    const addAvailability = async () => {
        if (!selectedStart) {
            toast.error('No date selected');
            return;
        }
        
        const dateStr = formatDate(selectedStart);
        let finalStart = startTime;
        let finalEnd = endTime;
        
        if (isAllDay) {
            finalStart = '00:00';
            finalEnd = '23:59';
        }
        
        if (!isAllDay && finalStart >= finalEnd) {
            toast.error('End time must be after start time');
            return;
        }
        
        try {
            await axios.post(`${API_URL}/availability`, {
                date: dateStr,
                start_time: finalStart,
                end_time: finalEnd,
                is_available: true
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            toast.success(`✅ Available added for ${dateStr}`);
            setShowModal(false);
            
            if (isAdmin) {
                fetchStaffAvailability();
            } else {
                fetchMyAvailability();
            }
        } catch (error) {
            console.error('Add availability error:', error);
            toast.error(error.response?.data?.error || 'Failed to add availability');
        }
    };
    
    // Add recurring weekly availability
    const addRecurringAvailability = async () => {
        if (!selectedStart || recurringWeeks === 0) return;
        
        const baseDate = new Date(selectedStart);
        const targetDay = baseDate.getDay();
        let finalStart = startTime;
        let finalEnd = endTime;
        
        if (isAllDay) {
            finalStart = '00:00';
            finalEnd = '23:59';
        }
        
        if (!isAllDay && finalStart >= finalEnd) {
            toast.error('End time must be after start time');
            return;
        }
        
        let successCount = 0;
        
        for (let i = 0; i < recurringWeeks; i++) {
            const currentDate = new Date(baseDate);
            currentDate.setDate(baseDate.getDate() + (i * 7));
            
            if (currentDate.getDay() === targetDay) {
                const dateStr = formatDate(currentDate);
                try {
                    await axios.post(`${API_URL}/availability`, {
                        date: dateStr,
                        start_time: finalStart,
                        end_time: finalEnd,
                        is_available: true
                    }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    successCount++;
                } catch (error) {
                    console.error(`Failed for ${dateStr}`);
                }
            }
        }
        
        if (successCount > 0) {
            toast.success(`✅ Added availability for ${successCount} weeks`);
        }
        
        setShowModal(false);
        
        if (isAdmin) {
            fetchStaffAvailability();
        } else {
            fetchMyAvailability();
        }
    };
    
    // Remove availability
    const removeAvailability = async () => {
        if (!selectedEvent) return;
        
        try {
            await axios.delete(`${API_URL}/availability/${selectedEvent.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            toast.success('❌ Availability removed');
            setShowModal(false);
            
            if (isAdmin) {
                fetchStaffAvailability();
            } else {
                fetchMyAvailability();
            }
        } catch (error) {
            toast.error('Failed to remove availability');
        }
    };
    
    // Remove all availability
    const removeAllAvailability = async () => {
        if (!window.confirm('⚠️ Remove ALL your availability? This cannot be undone.')) return;
        
        try {
            const promises = events.map(event => 
                axios.delete(`${API_URL}/availability/${event.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            );
            await Promise.all(promises);
            toast.success('❌ All availability removed');
            
            if (isAdmin) {
                fetchStaffAvailability();
            } else {
                fetchMyAvailability();
            }
        } catch (error) {
            toast.error('Failed to remove all availability');
        }
    };
    
    const handleViewChange = (view) => {
        setCurrentView(view);
        if (calendarRef.current) {
            const calendarApi = calendarRef.current.getApi();
            calendarApi.changeView(view);
        }
    };
    
    // Admin View
    if (isAdmin) {
        return (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-white">
                    <div className="flex justify-between items-center flex-wrap gap-4">
                        <div>
                            <h1 className="text-2xl font-bold">Staff Availability Calendar</h1>
                            <p className="text-blue-100 text-sm mt-1">View when team members are available</p>
                        </div>
                        <select
                            value={selectedStaff || ''}
                            onChange={(e) => setSelectedStaff(e.target.value ? parseInt(e.target.value) : null)}
                            className="px-4 py-2 rounded-lg bg-white text-gray-800 text-sm font-medium"
                        >
                            <option value="">All Staff</option>
                            {staffList.map(staff => (
                                <option key={staff.id} value={staff.id}>{staff.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                
                {/* View Tabs */}
                <div className="border-b px-4 py-2 flex gap-1 bg-gray-50 flex-wrap">
                    <button onClick={() => handleViewChange('dayGridMonth')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${currentView === 'dayGridMonth' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>Month</button>
                    <button onClick={() => handleViewChange('multiMonthYear')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${currentView === 'multiMonthYear' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>Year</button>
                    <button onClick={() => handleViewChange('timeGridWeek')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${currentView === 'timeGridWeek' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>Week</button>
                    <button onClick={() => handleViewChange('timeGridDay')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${currentView === 'timeGridDay' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>Day</button>
                    <button onClick={() => handleViewChange('listWeek')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${currentView === 'listWeek' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>List</button>
                </div>
                
                {/* Calendar */}
                <div className="p-4" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
                    {loading ? (
                        <div className="flex justify-center items-center h-full">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                        </div>
                    ) : (
                        <FullCalendar
                            ref={calendarRef}
                            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin, multiMonthPlugin]}
                            initialView={currentView}
                            headerToolbar={{
                                left: 'prev,next today',
                                center: 'title',
                                right: ''
                            }}
                            views={{
                                dayGridMonth: { buttonText: 'Month' },
                                multiMonthYear: { buttonText: 'Year', duration: { months: 12 } },
                                timeGridWeek: { buttonText: 'Week' },
                                timeGridDay: { buttonText: 'Day' },
                                listWeek: { buttonText: 'List' }
                            }}
                            events={events}
                            selectable={false}
                            editable={false}
                            eventClick={handleEventClick}
                            height="100%"
                            slotMinTime="00:00:00"
                            slotMaxTime="23:59:00"
                            allDaySlot={true}
                            slotDuration="00:30:00"
                            nowIndicator={true}
                            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: 'short' }}
                            validRange={{
                                start: '2024-01-01',
                                end: '2030-12-31'
                            }}
                        />
                    )}
                </div>
                
                {/* Legend */}
                <div className="border-t p-3 bg-gray-50 flex gap-4 text-sm flex-wrap">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-500 rounded"></div>
                        <span>Available</span>
                    </div>
                </div>
                
                {/* Event Modal */}
                {showModal && selectedEvent && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl w-full max-w-md p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold">Availability Details</h3>
                                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-gray-600">
                                    <span>📅</span>
                                    <span>{selectedEvent.start?.toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-3 text-gray-600">
                                    <span>⏰</span>
                                    <span>{selectedEvent.title}</span>
                                </div>
                                {selectedEvent.extendedProps?.staffName && (
                                    <div className="flex items-center gap-3 text-gray-600">
                                        <span>👤</span>
                                        <span>{selectedEvent.extendedProps.staffName}</span>
                                    </div>
                                )}
                            </div>
                            <button onClick={() => setShowModal(false)} className="w-full mt-6 bg-gray-200 py-2 rounded-lg hover:bg-gray-300">Close</button>
                        </div>
                    </div>
                )}
            </div>
        );
    }
    
    // Staff View
    return (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 p-4 text-white">
                <div className="flex justify-between items-center flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">My Availability Calendar</h1>
                        <p className="text-green-100 text-sm mt-1">Click and drag to set when you're available</p>
                    </div>
                    <button
                        onClick={removeAllAvailability}
                        className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition"
                    >
                        🗑️ Clear All
                    </button>
                </div>
            </div>
            
            {/* View Tabs */}
            <div className="border-b px-4 py-2 flex gap-1 bg-gray-50 flex-wrap">
                <button onClick={() => handleViewChange('dayGridMonth')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${currentView === 'dayGridMonth' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>Month</button>
                <button onClick={() => handleViewChange('multiMonthYear')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${currentView === 'multiMonthYear' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>Year</button>
                <button onClick={() => handleViewChange('timeGridWeek')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${currentView === 'timeGridWeek' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>Week</button>
                <button onClick={() => handleViewChange('timeGridDay')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${currentView === 'timeGridDay' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>Day</button>
                <button onClick={() => handleViewChange('listWeek')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${currentView === 'listWeek' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>List</button>
            </div>
            
            {/* Calendar */}
            <div className="p-4" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
                {loading ? (
                    <div className="flex justify-center items-center h-full">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                ) : (
                    <FullCalendar
                        ref={calendarRef}
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin, multiMonthPlugin]}
                        initialView={currentView}
                        headerToolbar={{
                            left: 'prev,next today',
                            center: 'title',
                            right: ''
                        }}
                        views={{
                            dayGridMonth: { buttonText: 'Month' },
                            multiMonthYear: { buttonText: 'Year', duration: { months: 12 } },
                            timeGridWeek: { buttonText: 'Week' },
                            timeGridDay: { buttonText: 'Day' },
                            listWeek: { buttonText: 'List' }
                        }}
                        events={events}
                        selectable={true}
                        selectMirror={true}
                        select={handleDateSelect}
                        eventClick={handleEventClick}
                        height="100%"
                        slotMinTime="00:00:00"
                        slotMaxTime="23:59:00"
                        allDaySlot={true}
                        slotDuration="00:30:00"
                        nowIndicator={true}
                        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: 'short' }}
                        validRange={{
                            start: '2024-01-01',
                            end: '2030-12-31'
                        }}
                    />
                )}
            </div>
            
            {/* Legend */}
            <div className="border-t p-3 bg-gray-50 flex gap-4 text-sm flex-wrap">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span>Available</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded"></div>
                    <span>Click & Drag to Add</span>
                </div>
                <div className="flex items-center gap-2">
                    <span>💡 Click on any green block to remove</span>
                </div>
            </div>
            
            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">
                                {selectedEvent ? 'Remove Availability' : 'Add Availability'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        
                        <div className="bg-gray-50 p-3 rounded-lg mb-4">
                            <p className="text-gray-600">
                                Date: <span className="font-medium">{selectedStart?.toLocaleDateString()}</span>
                            </p>
                            {!selectedEvent && !isAllDay && (
                                <p className="text-gray-600 mt-1">
                                    Time: <span className="font-medium">{startTime} - {endTime}</span>
                                </p>
                            )}
                            {selectedEvent && (
                                <p className="text-gray-600 mt-1">{selectedEvent.title}</p>
                            )}
                        </div>
                        
                        {!selectedEvent && (
                            <>
                                <label className="flex items-center gap-2 mb-4">
                                    <input
                                        type="checkbox"
                                        checked={isAllDay}
                                        onChange={(e) => setIsAllDay(e.target.checked)}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm">All Day</span>
                                </label>
                                
                                {!isAllDay && (
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Start Time</label>
                                            <input
                                                type="time"
                                                value={startTime}
                                                onChange={(e) => setStartTime(e.target.value)}
                                                className="w-full p-2 border rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">End Time</label>
                                            <input
                                                type="time"
                                                value={endTime}
                                                onChange={(e) => setEndTime(e.target.value)}
                                                className="w-full p-2 border rounded-lg"
                                            />
                                        </div>
                                    </div>
                                )}
                                
                                <div className="mb-4">
                                    <label className="block text-sm font-medium mb-2">Repeat every week</label>
                                    <select
                                        value={recurringWeeks}
                                        onChange={(e) => setRecurringWeeks(parseInt(e.target.value))}
                                        className="w-full p-2 border rounded-lg"
                                    >
                                        <option value="0">Just this day</option>
                                        <option value="4">4 weeks (1 month)</option>
                                        <option value="8">8 weeks (2 months)</option>
                                        <option value="12">12 weeks (3 months)</option>
                                    </select>
                                </div>
                            </>
                        )}
                        
                        {selectedEvent && (
                            <div className="bg-red-50 p-3 rounded-lg mb-4">
                                <p className="text-red-600 text-sm">This will remove your availability for this time slot.</p>
                            </div>
                        )}
                        
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 bg-gray-200 py-2 rounded-lg hover:bg-gray-300"
                            >
                                Cancel
                            </button>
                            {selectedEvent ? (
                                <button
                                    onClick={removeAvailability}
                                    className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600"
                                >
                                    Remove
                                </button>
                            ) : (
                                <button
                                    onClick={recurringWeeks > 0 ? addRecurringAvailability : addAvailability}
                                    className="flex-1 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600"
                                >
                                    {recurringWeeks > 0 ? 'Add for Weeks' : 'Add Availability'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnterpriseCalendar;
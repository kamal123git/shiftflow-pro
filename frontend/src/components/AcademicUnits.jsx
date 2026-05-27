import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AcademicUnits = ({ token, isAdmin = false }) => {
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUnit, setSelectedUnit] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newSession, setNewSession] = useState({
        unit_code: '',
        lecture_day: 'Monday',
        lecture_time: '09:00',
        tutorial_days: ['Monday', 'Tuesday'],
        tutorial_times: ['11:00', '09:00'],
        tutorial_groups: 2
    });
    
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    useEffect(() => {
        fetchUnits();
    }, []);
    
    const fetchUnits = async () => {
        try {
            const res = await axios.get(`${API_URL}/units`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUnits(res.data);
        } catch (error) {
            console.error('Failed to fetch units');
            toast.error('Could not load units');
        } finally {
            setLoading(false);
        }
    };
    
    const createCourseSessions = async () => {
        try {
            await axios.post(`${API_URL}/course-sessions`, newSession, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Course sessions created!');
            setShowCreateModal(false);
            setNewSession({
                unit_code: '',
                lecture_day: 'Monday',
                lecture_time: '09:00',
                tutorial_days: ['Monday', 'Tuesday'],
                tutorial_times: ['11:00', '09:00'],
                tutorial_groups: 2
            });
        } catch (error) {
            toast.error('Failed to create sessions');
        }
    };
    
    const runAutoSchedule = async () => {
        try {
            const res = await axios.post(`${API_URL}/auto-schedule/academic`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success(res.data.message);
            console.log('Assignments:', res.data.assignments);
        } catch (error) {
            toast.error('Auto-schedule failed');
        }
    };
    
    if (loading) {
        return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
    }
    
    return (
        <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">🎓 Academic Units</h2>
                    <p className="text-gray-500 text-sm mt-1">NAPS Course offerings for current semester</p>
                </div>
                {isAdmin && (
                    <div className="flex gap-3">
                        <button
                            onClick={runAutoSchedule}
                            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition"
                        >
                            🤖 Auto-Schedule All
                        </button>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
                        >
                            + Create Course Sessions
                        </button>
                    </div>
                )}
            </div>
            
            {/* Units Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {units.map(unit => (
                    <div
                        key={unit.id}
                        onClick={() => setSelectedUnit(unit)}
                        className="border rounded-xl p-4 hover:shadow-lg transition cursor-pointer bg-gradient-to-r from-blue-50 to-white"
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold text-blue-600">{unit.code}</h3>
                                <p className="text-gray-700 font-medium mt-1">{unit.name}</p>
                            </div>
                            <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-lg text-xs">{unit.credits} credits</span>
                        </div>
                        <div className="mt-3 flex gap-3 text-sm text-gray-500">
                            <span>📖 Lecture: {unit.lecture_hours}h</span>
                            <span>📝 Tutorial: {unit.tutorial_hours}h</span>
                            <span>👥 Groups: {unit.tutorial_groups}</span>
                        </div>
                    </div>
                ))}
            </div>
            
            {/* Unit Details Modal */}
            {selectedUnit && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">{selectedUnit.code} - {selectedUnit.name}</h3>
                            <button onClick={() => setSelectedUnit(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-gray-600">Credits:</span>
                                <span className="font-medium">{selectedUnit.credits}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-gray-600">Lecture Hours:</span>
                                <span className="font-medium">{selectedUnit.lecture_hours} hours/week</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-gray-600">Tutorial Hours:</span>
                                <span className="font-medium">{selectedUnit.tutorial_hours} hours/week</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-gray-600">Tutorial Groups:</span>
                                <span className="font-medium">{selectedUnit.tutorial_groups}</span>
                            </div>
                        </div>
                        <button onClick={() => setSelectedUnit(null)} className="w-full mt-6 bg-blue-500 text-white py-2 rounded-lg">Close</button>
                    </div>
                </div>
            )}
            
            {/* Create Course Sessions Modal (Admin only) */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                        <h3 className="text-xl font-bold mb-4">Create Course Sessions</h3>
                        <form onSubmit={(e) => { e.preventDefault(); createCourseSessions(); }} className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">Unit</label>
                                <select
                                    value={newSession.unit_code}
                                    onChange={(e) => setNewSession({...newSession, unit_code: e.target.value})}
                                    className="w-full p-2 border rounded-lg"
                                    required
                                >
                                    <option value="">Select Unit</option>
                                    {units.map(u => (
                                        <option key={u.id} value={u.code}>{u.code} - {u.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Lecture Day</label>
                                <select
                                    value={newSession.lecture_day}
                                    onChange={(e) => setNewSession({...newSession, lecture_day: e.target.value})}
                                    className="w-full p-2 border rounded-lg"
                                >
                                    {days.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Lecture Time</label>
                                <input
                                    type="time"
                                    value={newSession.lecture_time}
                                    onChange={(e) => setNewSession({...newSession, lecture_time: e.target.value})}
                                    className="w-full p-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Number of Tutorial Groups</label>
                                <input
                                    type="number"
                                    value={newSession.tutorial_groups}
                                    onChange={(e) => setNewSession({...newSession, tutorial_groups: parseInt(e.target.value)})}
                                    className="w-full p-2 border rounded-lg"
                                    min="1"
                                    max="5"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 bg-gray-300 py-2 rounded-lg">Cancel</button>
                                <button type="submit" className="flex-1 bg-blue-500 text-white py-2 rounded-lg">Create Sessions</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AcademicUnits;
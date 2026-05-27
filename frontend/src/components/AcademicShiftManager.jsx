import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AcademicShiftManager = ({ token }) => {
    const [units, setUnits] = useState([]);
    const [academicShifts, setAcademicShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [scheduling, setScheduling] = useState(false);
    const [formData, setFormData] = useState({
        unit_code: '',
        type: 'lecture',
        date: '',
        start_time: '09:00',
        end_time: '11:00',
        group_number: 1,
        required_expertise: 3
    });
    
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    
    useEffect(() => {
        fetchUnits();
        fetchAcademicShifts();
    }, []);
    
    const fetchUnits = async () => {
        try {
            const res = await axios.get(`${API_URL}/units`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUnits(res.data);
        } catch (error) {
            console.error('Failed to fetch units');
        }
    };
    
    const fetchAcademicShifts = async () => {
        try {
            const res = await axios.get(`${API_URL}/academic-shifts`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAcademicShifts(res.data);
        } catch (error) {
            console.error('Failed to fetch academic shifts');
        } finally {
            setLoading(false);
        }
    };
    
    const createShift = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/academic-shifts`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Academic shift created!');
            setShowForm(false);
            setFormData({
                unit_code: '',
                type: 'lecture',
                date: '',
                start_time: '09:00',
                end_time: '11:00',
                group_number: 1,
                required_expertise: 3
            });
            fetchAcademicShifts();
        } catch (error) {
            toast.error('Failed to create shift');
        }
    };
    
    const runAutoSchedule = async () => {
        setScheduling(true);
        try {
            const res = await axios.post(`${API_URL}/academic-auto-schedule`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success(res.data.message);
            fetchAcademicShifts();
        } catch (error) {
            toast.error('Auto-schedule failed');
        } finally {
            setScheduling(false);
        }
    };
    
    if (loading) {
        return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
    }
    
    return (
        <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">🎓 Academic Schedule Manager</h2>
                    <p className="text-gray-500 text-sm mt-1">Create lecture and tutorial sessions for NAPS units</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={runAutoSchedule}
                        disabled={scheduling}
                        className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50"
                    >
                        {scheduling ? 'Scheduling...' : '🤖 Auto-Assign Staff'}
                    </button>
                    <button
                        onClick={() => setShowForm(true)}
                        className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                    >
                        + Create Session
                    </button>
                </div>
            </div>
            
            {/* Academic Shifts Display */}
            {academicShifts.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    No academic sessions created yet. Click "Create Session" to add lectures and tutorials.
                </div>
            ) : (
                <div className="space-y-8">
                    {academicShifts.map(unit => (
                        <div key={unit.unit_code} className="border rounded-xl overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-white">
                                <h3 className="text-lg font-bold">{unit.unit_code} - {unit.unit_name}</h3>
                            </div>
                            
                            {/* Lectures */}
                            <div className="p-4 border-b">
                                <h4 className="font-semibold text-gray-700 mb-3">📖 Lectures</h4>
                                {unit.lectures.length === 0 ? (
                                    <p className="text-gray-400 text-sm">No lectures scheduled</p>
                                ) : (
                                    <div className="space-y-2">
                                        {unit.lectures.map(lecture => (
                                            <div key={lecture.id} className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
                                                <div>
                                                    <p className="font-medium">{lecture.date} | {lecture.start_time} - {lecture.end_time}</p>
                                                    {lecture.staff.length > 0 ? (
                                                        <p className="text-sm text-green-600">👨‍🏫 Assigned: {lecture.staff.map(s => s.name).join(', ')}</p>
                                                    ) : (
                                                        <p className="text-sm text-orange-500">⚠️ Not assigned yet</p>
                                                    )}
                                                </div>
                                                <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-lg text-xs">Lecture</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            {/* Tutorials */}
                            <div className="p-4">
                                <h4 className="font-semibold text-gray-700 mb-3">📝 Tutorials</h4>
                                {unit.tutorials.length === 0 ? (
                                    <p className="text-gray-400 text-sm">No tutorials scheduled</p>
                                ) : (
                                    <div className="space-y-2">
                                        {unit.tutorials.map(tutorial => (
                                            <div key={tutorial.id} className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
                                                <div>
                                                    <p className="font-medium">Group {tutorial.group_number}: {tutorial.date} | {tutorial.start_time} - {tutorial.end_time}</p>
                                                    {tutorial.staff.length > 0 ? (
                                                        <p className="text-sm text-green-600">👨‍🏫 Assigned: {tutorial.staff.map(s => s.name).join(', ')}</p>
                                                    ) : (
                                                        <p className="text-sm text-orange-500">⚠️ Not assigned yet</p>
                                                    )}
                                                </div>
                                                <span className="bg-purple-100 text-purple-600 px-2 py-1 rounded-lg text-xs">Tutorial</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Create Session Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Create Academic Session</h3>
                            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={createShift} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Unit</label>
                                <select
                                    value={formData.unit_code}
                                    onChange={(e) => setFormData({...formData, unit_code: e.target.value})}
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
                                <label className="block text-sm font-medium mb-1">Session Type</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                                    className="w-full p-2 border rounded-lg"
                                >
                                    <option value="lecture">Lecture</option>
                                    <option value="tutorial">Tutorial</option>
                                </select>
                            </div>
                            
                            {formData.type === 'tutorial' && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Group Number</label>
                                    <input
                                        type="number"
                                        value={formData.group_number}
                                        onChange={(e) => setFormData({...formData, group_number: parseInt(e.target.value)})}
                                        className="w-full p-2 border rounded-lg"
                                        min="1"
                                        max="5"
                                        required
                                    />
                                </div>
                            )}
                            
                            <div>
                                <label className="block text-sm font-medium mb-1">Date</label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                                    className="w-full p-2 border rounded-lg"
                                    required
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Start Time</label>
                                    <input
                                        type="time"
                                        value={formData.start_time}
                                        onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                                        className="w-full p-2 border rounded-lg"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">End Time</label>
                                    <input
                                        type="time"
                                        value={formData.end_time}
                                        onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                                        className="w-full p-2 border rounded-lg"
                                        required
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium mb-1">Required Expertise Level</label>
                                <select
                                    value={formData.required_expertise}
                                    onChange={(e) => setFormData({...formData, required_expertise: parseInt(e.target.value)})}
                                    className="w-full p-2 border rounded-lg"
                                >
                                    <option value="1">Level 1 (Beginner)</option>
                                    <option value="2">Level 2 (Intermediate)</option>
                                    <option value="3">Level 3 (Advanced)</option>
                                    <option value="4">Level 4 (Expert)</option>
                                    <option value="5">Level 5 (Master)</option>
                                </select>
                            </div>
                            
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-300 py-2 rounded-lg">Cancel</button>
                                <button type="submit" className="flex-1 bg-blue-500 text-white py-2 rounded-lg">Create Session</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AcademicShiftManager;
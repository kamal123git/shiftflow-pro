import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const StaffProfile = ({ token, user, onUpdate }) => {
    const [units, setUnits] = useState([]);
    const [expertise, setExpertise] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [profile, setProfile] = useState(null);
    const [formData, setFormData] = useState({
        experience_years: 0,
        qualification: 'Bachelor',
        phone: '',
        max_hours_per_week: 40
    });
    const [selectedExpertise, setSelectedExpertise] = useState({});
    
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    
    useEffect(() => {
        fetchProfile();
        fetchUnits();
        fetchExpertise();
    }, []);
    
    const fetchProfile = async () => {
        try {
            const res = await axios.get(`${API_URL}/staff/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProfile(res.data);
            setFormData({
                experience_years: res.data.experience_years || 0,
                qualification: res.data.qualification || 'Bachelor',
                phone: res.data.phone || '',
                max_hours_per_week: res.data.max_hours_per_week || 40
            });
        } catch (error) {
            console.error('Failed to fetch profile:', error);
            toast.error('Could not load profile');
        }
    };
    
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
    
    const fetchExpertise = async () => {
        try {
            const res = await axios.get(`${API_URL}/staff/expertise/${user?.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setExpertise(res.data);
            const expertiseMap = {};
            res.data.forEach(e => {
                expertiseMap[e.unit_code] = e.expertise_level;
            });
            setSelectedExpertise(expertiseMap);
        } catch (error) {
            console.error('Failed to fetch expertise');
        } finally {
            setLoading(false);
        }
    };
    
    const updateProfile = async () => {
        try {
            const res = await axios.put(`${API_URL}/staff/profile`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Profile updated successfully!');
            setEditing(false);
            setProfile(res.data.user);
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Update error:', error);
            toast.error(error.response?.data?.error || 'Failed to update profile');
        }
    };
    
    const addExpertise = async (unitCode, level) => {
        if (level === 0) {
            setSelectedExpertise({...selectedExpertise, [unitCode]: 0});
            return;
        }
        try {
            await axios.post(`${API_URL}/staff/expertise`, {
                staff_id: user.id,
                unit_code: unitCode,
                expertise_level: level,
                experience_years: formData.experience_years
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success(`Expertise set for ${unitCode} (Level ${level})`);
            setSelectedExpertise({...selectedExpertise, [unitCode]: level});
        } catch (error) {
            console.error('Expertise error:', error);
            toast.error('Failed to save expertise');
        }
    };
    
    if (loading) {
        return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
    }
    
    return (
        <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">👨‍🏫 My Profile</h2>
                <button
                    onClick={() => setEditing(!editing)}
                    className="text-blue-500 hover:text-blue-600"
                >
                    {editing ? 'Cancel' : '✏️ Edit Profile'}
                </button>
            </div>
            
            {/* Profile Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="font-semibold mb-3">Personal Information</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Name:</span>
                            <span className="font-medium">{profile?.name || user?.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Email:</span>
                            <span className="font-medium">{profile?.email || user?.email}</span>
                        </div>
                        {editing ? (
                            <>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Phone:</span>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                        className="border rounded px-2 py-1 w-40"
                                        placeholder="Enter phone number"
                                    />
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Experience (years):</span>
                                    <input
                                        type="number"
                                        value={formData.experience_years}
                                        onChange={(e) => setFormData({...formData, experience_years: parseInt(e.target.value)})}
                                        className="border rounded px-2 py-1 w-20"
                                        min="0"
                                        max="50"
                                    />
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Qualification:</span>
                                    <select
                                        value={formData.qualification}
                                        onChange={(e) => setFormData({...formData, qualification: e.target.value})}
                                        className="border rounded px-2 py-1"
                                    >
                                        <option value="Bachelor">Bachelor</option>
                                        <option value="Master">Master</option>
                                        <option value="PhD">PhD</option>
                                        <option value="Professor">Professor</option>
                                    </select>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Max Hours/Week:</span>
                                    <input
                                        type="number"
                                        value={formData.max_hours_per_week}
                                        onChange={(e) => setFormData({...formData, max_hours_per_week: parseInt(e.target.value)})}
                                        className="border rounded px-2 py-1 w-20"
                                        min="10"
                                        max="60"
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Phone:</span>
                                    <span className="font-medium">{profile?.phone || 'Not set'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Experience:</span>
                                    <span className="font-medium">{profile?.experience_years || 0} years</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Qualification:</span>
                                    <span className="font-medium">{profile?.qualification || 'Bachelor'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Max Hours/Week:</span>
                                    <span className="font-medium">{profile?.max_hours_per_week || 40} hours</span>
                                </div>
                            </>
                        )}
                    </div>
                    {editing && (
                        <button
                            onClick={updateProfile}
                            className="w-full mt-4 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
                        >
                            Save Changes
                        </button>
                    )}
                </div>
                
                {/* Expertise Section */}
                <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="font-semibold mb-3">📚 My Expertise</h3>
                    <p className="text-xs text-gray-500 mb-3">Set your expertise level for each unit (1-5). Higher level = priority for lectures.</p>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                        {units.map(unit => {
                            const currentLevel = selectedExpertise[unit.code] || 0;
                            return (
                                <div key={unit.id} className="bg-white rounded-lg p-3 border">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-medium">{unit.code}</p>
                                            <p className="text-xs text-gray-500">{unit.name}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={currentLevel}
                                                onChange={(e) => {
                                                    const level = parseInt(e.target.value);
                                                    addExpertise(unit.code, level);
                                                }}
                                                className="border rounded px-2 py-1 text-sm"
                                            >
                                                <option value="0">No expertise</option>
                                                <option value="1">Level 1 (Beginner)</option>
                                                <option value="2">Level 2 (Intermediate)</option>
                                                <option value="3">Level 3 (Advanced)</option>
                                                <option value="4">Level 4 (Expert)</option>
                                                <option value="5">Level 5 (Master)</option>
                                            </select>
                                        </div>
                                    </div>
                                    {currentLevel > 0 && (
                                        <div className="mt-2">
                                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${currentLevel * 20}%` }}></div>
                                            </div>
                                            <p className="text-xs text-green-600 mt-1">Expertise Level: {currentLevel}/5</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            
            {/* My Assigned Sessions */}
            <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold mb-3">📅 My Teaching Assignments</h3>
                <div className="text-center text-gray-500 py-8">
                    <p>Your teaching assignments will appear here after auto-scheduling.</p>
                    <p className="text-sm mt-2">Admin needs to run "Auto-Schedule All" to assign sessions.</p>
                </div>
            </div>
        </div>
    );
};

export default StaffProfile;
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const MyTeaching = ({ token }) => {
    const [teaching, setTeaching] = useState({ lectures: [], tutorials: [] });
    const [loading, setLoading] = useState(true);
    
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    
    useEffect(() => {
        fetchMyTeaching();
    }, []);
    
    const fetchMyTeaching = async () => {
        try {
            const res = await axios.get(`${API_URL}/my-teaching`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTeaching(res.data);
        } catch (error) {
            console.error('Failed to fetch teaching assignments');
            toast.error('Could not load your teaching schedule');
        } finally {
            setLoading(false);
        }
    };
    
    if (loading) {
        return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
    }
    
    const totalLectures = teaching.lectures.length;
    const totalTutorials = teaching.tutorials.length;
    const totalHours = [...teaching.lectures, ...teaching.tutorials].reduce((sum, item) => {
        const start = parseInt(item.start_time.split(':')[0]);
        const end = parseInt(item.end_time.split(':')[0]);
        return sum + (end - start);
    }, 0);
    
    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-4 text-white">
                    <p className="text-sm opacity-80">Lectures</p>
                    <p className="text-3xl font-bold">{totalLectures}</p>
                    <p className="text-xs opacity-70 mt-1">Assigned to you</p>
                </div>
                <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-4 text-white">
                    <p className="text-sm opacity-80">Tutorials</p>
                    <p className="text-3xl font-bold">{totalTutorials}</p>
                    <p className="text-xs opacity-70 mt-1">Assigned to you</p>
                </div>
                <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-4 text-white">
                    <p className="text-sm opacity-80">Total Hours</p>
                    <p className="text-3xl font-bold">{totalHours}</p>
                    <p className="text-xs opacity-70 mt-1">Teaching hours</p>
                </div>
            </div>
            
            {/* Lectures Section */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 text-white">
                    <h2 className="text-xl font-bold">📖 My Lectures</h2>
                </div>
                <div className="p-5">
                    {teaching.lectures.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">No lectures assigned yet</p>
                    ) : (
                        <div className="space-y-3">
                            {teaching.lectures.map(lecture => (
                                <div key={lecture.id} className="border rounded-xl p-4 hover:shadow-md transition">
                                    <div className="flex justify-between items-start flex-wrap gap-2">
                                        <div>
                                            <h3 className="font-bold text-lg">{lecture.unit_code} - {lecture.unit_name}</h3>
                                            <p className="text-gray-600 mt-1">
                                                📅 {lecture.date} | ⏰ {lecture.start_time} - {lecture.end_time}
                                            </p>
                                            <p className="text-sm text-blue-600 mt-1">📖 Lecture Session</p>
                                        </div>
                                        <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-sm">✓ Assigned</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Tutorials Section */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-5 py-3 text-white">
                    <h2 className="text-xl font-bold">📝 My Tutorials</h2>
                </div>
                <div className="p-5">
                    {teaching.tutorials.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">No tutorials assigned yet</p>
                    ) : (
                        <div className="space-y-3">
                            {teaching.tutorials.map(tutorial => (
                                <div key={tutorial.id} className="border rounded-xl p-4 hover:shadow-md transition">
                                    <div className="flex justify-between items-start flex-wrap gap-2">
                                        <div>
                                            <h3 className="font-bold text-lg">{tutorial.unit_code} - {tutorial.unit_name}</h3>
                                            <p className="text-gray-600 mt-1">
                                                📅 {tutorial.date} | ⏰ {tutorial.start_time} - {tutorial.end_time}
                                            </p>
                                            <p className="text-sm text-purple-600 mt-1">
                                                📝 Tutorial Group {tutorial.group_number}
                                            </p>
                                        </div>
                                        <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-sm">✓ Assigned</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MyTeaching;
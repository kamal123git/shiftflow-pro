import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';

const AIAssistant = ({ token, user }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [conversationHistory, setConversationHistory] = useState([]);
    const messagesEndRef = useRef(null);
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim()) return;
        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        try {
            const response = await axios.post(`${API_URL}/ai/chat`, {
                message: userMessage,
                history: conversationHistory
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const aiReply = response.data.reply;
            setMessages(prev => [...prev, { role: 'assistant', content: aiReply }]);
            setConversationHistory(prev => [
                ...prev,
                { role: 'user', content: userMessage },
                { role: 'assistant', content: aiReply }
            ]);
        } catch (error) {
            console.error('AI error:', error);
            toast.error('AI assistant temporarily unavailable');
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again later.' }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearConversation = () => {
        setMessages([]);
        setConversationHistory([]);
        toast.success('Conversation cleared');
    };

    return (
        <>
            {/* Floating button */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-20 right-4 md:bottom-6 md:right-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all z-[9999]"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
            </button>

            {/* Chat Modal */}
            {isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl flex flex-col h-[600px] shadow-2xl">
                        {/* Header */}
                        <div className="flex justify-between items-center p-4 border-b bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-t-2xl">
                            <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                                <h3 className="text-lg font-semibold">ShiftFlow AI Assistant</h3>
                                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">GPT‑powered</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={clearConversation} className="text-white hover:text-gray-200 text-sm" title="Clear conversation">
                                    🧹
                                </button>
                                <button onClick={() => setIsOpen(false)} className="text-white hover:text-gray-200 text-2xl leading-none">
                                    ×
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                            {messages.length === 0 && (
                                <div className="text-center text-gray-400 mt-8">
                                    <div className="text-5xl mb-3">🤖</div>
                                    <p className="font-medium">Hello! I'm your ShiftFlow AI Assistant.</p>
                                    <p className="text-sm mt-2">I can help you with:</p>
                                    <ul className="text-xs mt-1 list-disc list-inside text-left max-w-sm mx-auto">
                                        <li>📅 Viewing your shifts and availability</li>
                                        <li>🔄 Requesting shift swaps or time off</li>
                                        <li>⏰ Clock in/out and time tracking</li>
                                        <li>⚙️ Using auto‑scheduling and reports</li>
                                    </ul>
                                    <p className="text-sm mt-4 text-purple-600">Ask me anything – I remember our conversation!</p>
                                </div>
                            )}
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-2xl p-3 ${msg.role === 'user' ? 'bg-purple-500 text-white' : 'bg-white border shadow-sm text-gray-800'}`}>
                                        <div className="text-xs font-medium mb-1 opacity-70">
                                            {msg.role === 'user' ? 'You' : 'AI Assistant'}
                                        </div>
                                        {/* Fixed: wrap ReactMarkdown in a div with the class */}
                                        <div className="prose prose-sm">
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="flex justify-start">
                                    <div className="bg-white border shadow-sm rounded-2xl p-3">
                                        <div className="flex space-x-1">
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="border-t p-3 bg-white rounded-b-2xl">
                            <div className="flex gap-2">
                                <textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    placeholder="Ask me anything... (Shift+Enter for new line)"
                                    className="flex-1 p-2 border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                                    rows="2"
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={loading}
                                    className="bg-purple-500 text-white px-4 py-2 rounded-xl hover:bg-purple-600 disabled:opacity-50 self-end"
                                >
                                    Send
                                </button>
                            </div>
                            <div className="text-xs text-gray-400 mt-2 text-center">
                                🔒 Your data is private – AI only sees your schedule info.
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AIAssistant;
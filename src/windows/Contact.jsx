import React, { useState } from 'react';
import { Send, Paperclip, Smile } from 'lucide-react';
import WindowWrapper from '../hoc/WindowWrapper';
import WindowControls from '../components/WindowControl';

const Contact = () => {
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');

    const handleSend = () => {
        window.location.href = `mailto:your.email@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    };

    return (
        <>
            <div id="window-header">
                <WindowControls target="contact" />
                <p>New Message</p>
                <div></div>
            </div>

            <div className="flex items-center gap-6 bg-[#252525] px-4 py-2 border-b border-[#1a1a1a] text-gray-400">
                <button onClick={handleSend} className="hover:text-blue-400 transition-colors">
                    <Send size={18} />
                </button>
                <button className="hover:text-blue-400 transition-colors">
                    <Paperclip size={18} />
                </button>
                <button className="hover:text-blue-400 transition-colors">
                    <Smile size={18} />
                </button>
            </div>

            <div className="flex flex-col bg-[#1e1e1e] h-[300px]">
                <div className="flex items-center border-b border-[#2a2a2a] p-2">
                    <span className="w-16 text-gray-500 text-sm font-medium text-right pr-3">To:</span>
                    <input
                        type="text"
                        value="your.email@gmail.com"
                        readOnly
                        className="flex-1 outline-none text-sm text-gray-300 bg-transparent"
                    />
                </div>

                <div className="flex items-center border-b border-[#2a2a2a] p-2">
                    <span className="w-16 text-gray-500 text-sm font-medium text-right pr-3">Cc:</span>
                    <input
                        type="text"
                        className="flex-1 outline-none text-sm text-gray-300 bg-transparent"
                    />
                </div>

                <div className="flex items-center border-b border-[#2a2a2a] p-2">
                    <span className="w-16 text-gray-500 text-sm font-medium text-right pr-3">Subject:</span>
                    <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="flex-1 outline-none text-sm text-gray-300 bg-transparent placeholder:text-gray-600"
                        placeholder="Project Inquiry"
                    />
                </div>

                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="flex-1 resize-none p-4 outline-none text-sm text-gray-200 font-sans leading-relaxed bg-transparent placeholder:text-gray-600"
                    placeholder="Type your message here..."
                />
            </div>
        </>
    );
};

export default WindowWrapper(Contact, 'contact');

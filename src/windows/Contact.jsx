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

            <div className="flex items-center gap-6 bg-gray-100 px-4 py-2 border-b border-gray-200 text-gray-500">
                <button onClick={handleSend} className="hover:text-blue-500 transition-colors">
                    <Send size={18} />
                </button>
                <button className="hover:text-blue-500 transition-colors">
                    <Paperclip size={18} />
                </button>
                <button className="hover:text-blue-500 transition-colors">
                    <Smile size={18} />
                </button>
            </div>

            <div className="flex flex-col bg-white h-[300px]">
                <div className="flex items-center border-b border-gray-100 p-2">
                    <span className="w-16 text-gray-400 text-sm font-medium text-right pr-3">To:</span>
                    <input
                        type="text"
                        value="your.email@gmail.com"
                        readOnly
                        className="flex-1 outline-none text-sm text-gray-700 bg-transparent"
                    />
                </div>

                <div className="flex items-center border-b border-gray-100 p-2">
                    <span className="w-16 text-gray-400 text-sm font-medium text-right pr-3">Cc:</span>
                    <input
                        type="text"
                        className="flex-1 outline-none text-sm text-gray-700 bg-transparent"
                    />
                </div>

                <div className="flex items-center border-b border-gray-100 p-2">
                    <span className="w-16 text-gray-400 text-sm font-medium text-right pr-3">Subject:</span>
                    <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="flex-1 outline-none text-sm text-gray-700 bg-transparent"
                        placeholder="Project Inquiry"
                    />
                </div>

                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="flex-1 resize-none p-4 outline-none text-sm text-gray-800 font-sans leading-relaxed"
                    placeholder="Type your message here..."
                />
            </div>
        </>
    );
};

export default WindowWrapper(Contact, 'contact');

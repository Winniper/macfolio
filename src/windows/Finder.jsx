import React, { useState } from 'react';
import {
    AppWindow,
    Cloud,
    Download,
    FileText,
    Folder,
    HardDrive,
    Home,
    Monitor,
    Image as ImageIcon,
    Music,
    Video
} from 'lucide-react';

import WindowWrapper from '../hoc/WindowWrapper';
import WindowControls from '../components/WindowControl';

const finderItems = [
    {
        id: 1,
        title: 'Projects',
        type: 'folder',
        icon: Folder,
        color: 'text-blue-500',
    },
    {
        id: 2,
        title: 'Resume.pdf',
        type: 'file',
        icon: FileText,
        color: 'text-red-500',
    },
    {
        id: 3,
        title: 'Profile.png',
        type: 'image',
        icon: ImageIcon,
        color: 'text-purple-500',
    },
    {
        id: 4,
        title: 'Music',
        type: 'folder',
        icon: Music,
        color: 'text-green-500',
    },
    {
        id: 5,
        title: 'Movies',
        type: 'folder',
        icon: Video,
        color: 'text-pink-500',
    },
];

const SidebarItem = ({ icon: Icon, label, active = false }) => (
    <div
        className={`flex w-full items-center gap-2 rounded px-2 py-1 text-xs font-medium cursor-pointer ${active ? 'bg-blue-600/30 text-blue-300' : 'text-gray-400 hover:bg-[#333333]'
            }`}
    >
        <Icon size={14} />
        <span>{label}</span>
    </div>
);

const Finder = () => {
    const [selectedItem, setSelectedItem] = useState(null);

    return (
        <>
            <div id="window-header">
                <WindowControls target="finder" />
                <div className="flex items-center gap-2">
                    <span className="text-gray-500 cursor-default">&lt;</span>
                    <span className="text-gray-500 cursor-default">&gt;</span>
                    <span className="font-semibold text-gray-300 ml-2">Desktop</span>
                </div>
                <div></div>
            </div>

            <div className="flex overflow-hidden h-[400px]">
                <div className="w-44 bg-[#252525] p-3 border-r border-[#1a1a1a]">
                    <div className="space-y-4">
                        <div>
                            <p className="mb-2 ml-1 text-[10px] font-bold text-gray-500 uppercase">Favorites</p>
                            <div className="space-y-0.5">
                                <SidebarItem icon={Home} label="Recents" />
                                <SidebarItem icon={AppWindow} label="Applications" />
                                <SidebarItem icon={Monitor} label="Desktop" active />
                                <SidebarItem icon={FileText} label="Documents" />
                                <SidebarItem icon={Download} label="Downloads" />
                            </div>
                        </div>

                        <div>
                            <p className="mb-2 ml-1 text-[10px] font-bold text-gray-500 uppercase">iCloud</p>
                            <div className="space-y-0.5">
                                <SidebarItem icon={Cloud} label="iCloud Drive" />
                            </div>
                        </div>

                        <div>
                            <p className="mb-2 ml-1 text-[10px] font-bold text-gray-500 uppercase">Locations</p>
                            <div className="space-y-0.5">
                                <SidebarItem icon={HardDrive} label="Macintosh HD" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 bg-[#1e1e1e] p-4" onClick={() => setSelectedItem(null)}>
                    <div className="grid grid-cols-4 gap-4">
                        {finderItems.map((item) => (
                            <div
                                key={item.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedItem(item.id);
                                }}
                                className={`flex flex-col items-center justify-center gap-1 rounded-lg p-3 transition-colors cursor-pointer ${selectedItem === item.id ? 'bg-blue-600/20 ring-1 ring-blue-500' : 'hover:bg-[#333333]'
                                    }`}
                            >
                                <item.icon
                                    size={42}
                                    strokeWidth={1}
                                    className={item.color || 'text-blue-500'}
                                />
                                <span className={`text-xs text-center max-w-[80px] truncate ${selectedItem === item.id ? 'bg-blue-500 text-white rounded px-1' : 'text-gray-300'
                                    }`}>
                                    {item.title}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};

export default WindowWrapper(Finder, 'finder');

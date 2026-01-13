import React from 'react';

interface Props {
    text: string;
}

export const SlackPreview: React.FC<Props> = ({ text }) => {
    // Basic parser to mimic Slack formatting
    const renderContent = (content: string) => {
        return content.split('\n').map((line, i) => {
            // Bold
            let formatted = line.replace(/\*(.*?)\*/g, '<span class="font-bold text-[#1C1C1C]">$1</span>');
            
            // Links
            formatted = formatted.replace(/<(.*?)\|(.*?)>/g, '<a href="$1" class="text-[#1264A3] hover:underline">$2</a>');
            
            // Bullets formatting
            if (line.trim().startsWith('•')) {
                return <div key={i} className="pl-4 text-[13px] leading-[1.4] text-gray-700" dangerouslySetInnerHTML={{ __html: formatted }} />;
            }
            
            // Section Headers (usually bold in our generator)
            if (line.trim().startsWith('*') && line.trim().endsWith('*') && !line.includes('@channel')) {
                 return <div key={i} className="mt-4 mb-1 text-[13px] leading-[1.4] text-gray-900" dangerouslySetInnerHTML={{ __html: formatted }} />;
            }

            // Top Header (@channel)
            if (line.includes('@channel')) {
                formatted = formatted.replace('@channel', '<span class="bg-[#1264A3]/10 text-[#1264A3] px-1 rounded">@channel</span>');
                return <div key={i} className="mb-2 text-[14px] text-gray-900" dangerouslySetInnerHTML={{ __html: formatted }} />;
            }

            if (!line.trim()) return <div key={i} className="h-2"></div>;

            return <div key={i} className="text-[13px] leading-[1.4] text-gray-700" dangerouslySetInnerHTML={{ __html: formatted }} />;
        });
    };

    return (
        <div className="bg-white p-6 font-['Lato',sans-serif]">
            <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded bg-gray-200 flex-shrink-0 flex items-center justify-center text-xs font-bold text-gray-500">
                    YOU
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="font-bold text-[14px] text-[#1C1C1C]">Creative Director</span>
                        <span className="text-[11px] text-gray-500">10:42 AM</span>
                    </div>
                    <div>
                        {renderContent(text)}
                    </div>
                </div>
            </div>
        </div>
    );
};
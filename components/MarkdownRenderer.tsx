import React from 'react';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
    if (!content) return null;

    // Split content by code blocks first optionally, but for now just paragraphs
    const paragraphs = content.split('\n');

    return (
        <div className={`space-y-1 ${className}`}>
            {paragraphs.map((paragraph, pIndex) => {
                // Handle empty lines as breaks
                if (!paragraph.trim()) {
                    return <div key={pIndex} className="h-2" />;
                }

                // Process formatting within the paragraph
                // Regex to split by bold (**text**), italic (*text*), and code (`text`)
                // Order matters: match ** first, then *, then `
                const parts = paragraph.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);

                return (
                    <p key={pIndex} className="leading-relaxed break-words">
                        {parts.map((part, i) => {
                            // Handle Bold
                            if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
                                return (
                                    <span key={i} className="font-bold text-purple-200">
                                        {part.slice(2, -2)}
                                    </span>
                                );
                            }

                            // Handle Italic
                            if (part.startsWith('*') && part.endsWith('*') && part.length >= 2 && !part.startsWith('**')) {
                                return (
                                    <span key={i} className="italic text-purple-100">
                                        {part.slice(1, -1)}
                                    </span>
                                );
                            }

                            // Handle Inline Code
                            if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
                                return (
                                    <code key={i} className="bg-purple-900/50 px-1.5 py-0.5 rounded text-sm font-mono text-purple-200 border border-purple-500/30">
                                        {part.slice(1, -1)}
                                    </code>
                                );
                            }

                            // Handle Links [text](url) - Simple pass for links within text parts
                            // This is a basic implementation. For nested constraints, a full parser is better.
                            const linkParts = part.split(/(\[.*?\]\(.*?\))/g);
                            if (linkParts.length > 1) {
                                return linkParts.map((subPart, j) => {
                                    const linkMatch = subPart.match(/^\[(.*?)\]\((.*?)\)$/);
                                    if (linkMatch) {
                                        return (
                                            <a
                                                key={`${i}-${j}`}
                                                href={linkMatch[2]}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                                            >
                                                {linkMatch[1]}
                                            </a>
                                        );
                                    }
                                    return subPart;
                                });
                            }

                            return part;
                        })}
                    </p>
                );
            })}
        </div>
    );
}

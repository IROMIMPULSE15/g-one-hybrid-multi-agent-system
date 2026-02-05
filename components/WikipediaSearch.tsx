'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, BookOpen, Sparkles } from 'lucide-react';

interface WikipediaResult {
    success: boolean;
    title?: string;
    summary?: string;
    url?: string;
    relatedTopics?: string[];
    error?: string;
    isPro?: boolean;
}

interface WikipediaSearchProps {
    userPlan?: 'Free' | 'Pro' | 'Enterprise';
    onSearch?: (query: string, result: WikipediaResult) => void;
}

export default function WikipediaSearch({
    userPlan = 'Free',
    onSearch
}: WikipediaSearchProps) {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<WikipediaResult | null>(null);

    const isPro = userPlan === 'Pro' || userPlan === 'Enterprise';

    const handleSearch = async () => {
        if (!query.trim()) return;

        setLoading(true);
        setResult(null);

        try {
            const response = await fetch('/api/voice-assistant', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: query,
                    userPlan,
                    mode: 'wikipedia',
                }),
            });

            const data = await response.json();

            if (data.success) {
                const wikiResult: WikipediaResult = {
                    success: true,
                    title: data.metadata?.title,
                    summary: data.response,
                    isPro,
                };

                setResult(wikiResult);
                onSearch?.(query, wikiResult);
            } else {
                setResult({
                    success: false,
                    error: data.error || 'Search failed',
                });
            }
        } catch (error) {
            console.error('Wikipedia search error:', error);
            setResult({
                success: false,
                error: 'Failed to connect to Wikipedia search',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BookOpen className="h-6 w-6 text-blue-500" />
                            <CardTitle>Wikipedia Search</CardTitle>
                        </div>
                        {isPro && (
                            <Badge variant="default" className="bg-purple-500">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Pro
                            </Badge>
                        )}
                    </div>
                    <CardDescription>
                        Search Wikipedia for knowledge, history, and reference information
                        {isPro && ' - Enhanced results with Pro version'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input
                            type="text"
                            placeholder="e.g., Who is Albert Einstein?"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyPress={handleKeyPress}
                            disabled={loading}
                            className="flex-1"
                        />
                        <Button
                            onClick={handleSearch}
                            disabled={loading || !query.trim()}
                            className="min-w-[100px]"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Searching
                                </>
                            ) : (
                                <>
                                    <Search className="h-4 w-4 mr-2" />
                                    Search
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Plan Features */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                            <p className="font-medium">Your Plan: {userPlan}</p>
                            <ul className="text-muted-foreground space-y-1">
                                <li>✓ {isPro ? '5' : '3'} search results</li>
                                <li>✓ {isPro ? '10' : '5'} sentences extract</li>
                                {isPro && <li>✓ Enhanced related topics</li>}
                            </ul>
                        </div>
                        <div className="space-y-1">
                            <p className="font-medium">Best For:</p>
                            <ul className="text-muted-foreground space-y-1">
                                <li>• Historical facts</li>
                                <li>• Biographies</li>
                                <li>• Concepts & definitions</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Results */}
            {result && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            {result.success ? (
                                <>
                                    <BookOpen className="h-5 w-5 text-green-500" />
                                    {result.title || 'Search Results'}
                                    {result.isPro && (
                                        <Badge variant="outline" className="ml-2">
                                            <Sparkles className="h-3 w-3 mr-1" />
                                            Pro Search
                                        </Badge>
                                    )}
                                </>
                            ) : (
                                <>
                                    <Search className="h-5 w-5 text-red-500" />
                                    No Results
                                </>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {result.success ? (
                            <div className="space-y-4">
                                <div className="prose prose-sm max-w-none dark:prose-invert">
                                    <p className="whitespace-pre-wrap">{result.summary}</p>
                                </div>

                                {result.relatedTopics && result.relatedTopics.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="font-medium text-sm">Related Topics:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {result.relatedTopics.map((topic, idx) => (
                                                <Badge
                                                    key={idx}
                                                    variant="secondary"
                                                    className="cursor-pointer hover:bg-secondary/80"
                                                    onClick={() => setQuery(topic)}
                                                >
                                                    {topic}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {result.url && (
                                    <div className="pt-2 border-t">
                                        <a
                                            href={result.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-blue-500 hover:underline"
                                        >
                                            Read more on Wikipedia →
                                        </a>
                                    </div>
                                )}

                                {result.isPro && (
                                    <div className="text-xs text-muted-foreground italic">
                                        Enhanced results with Pro version
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>{result.error || 'No results found'}</p>
                                <p className="text-sm mt-2">Try rephrasing your search query</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Example Queries */}
            {!result && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Example Queries</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                'Who is Marie Curie?',
                                'What is quantum computing?',
                                'History of the Internet',
                                'Explain photosynthesis',
                                'Tell me about Ancient Rome',
                                'What is artificial intelligence?',
                            ].map((example, idx) => (
                                <Button
                                    key={idx}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setQuery(example)}
                                    className="justify-start text-left h-auto py-2"
                                >
                                    {example}
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Info Banner */}
            <div className="text-xs text-center text-muted-foreground">
                <p>
                    💡 Wikipedia is for knowledge and reference, not for news or real-time information.
                    {!isPro && (
                        <span className="block mt-1">
                            Upgrade to Pro for enhanced search results with more details and related topics!
                        </span>
                    )}
                </p>
            </div>
        </div>
    );
}

'use client';

import React, { useState } from 'react';
import WikipediaSearch from '@/components/WikipediaSearch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Zap, CheckCircle2, XCircle } from 'lucide-react';

export default function WikipediaDemo() {
    const [selectedPlan, setSelectedPlan] = useState<'Free' | 'Pro'>('Free');

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center space-y-4">
                    <div className="flex items-center justify-center gap-3">
                        <BookOpen className="h-12 w-12 text-blue-500" />
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            Wikipedia Search
                        </h1>
                    </div>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Access the world's knowledge instantly - No API key required!
                        Search Wikipedia for historical facts, biographies, concepts, and more.
                    </p>
                    <div className="flex items-center justify-center gap-2">
                        <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
                            ✅ No API Key Needed
                        </Badge>
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">
                            🌐 Free Public API
                        </Badge>
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-400">
                            🚀 Pro Enhanced
                        </Badge>
                    </div>
                </div>

                {/* Plan Selector */}
                <Card className="border-2">
                    <CardHeader>
                        <CardTitle>Select Your Plan</CardTitle>
                        <CardDescription>
                            Try the search with different plans to see the difference
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={selectedPlan} onValueChange={(v) => setSelectedPlan(v as 'Free' | 'Pro')}>
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="Free">Free Plan</TabsTrigger>
                                <TabsTrigger value="Pro">
                                    <Zap className="h-4 w-4 mr-2" />
                                    Pro Plan
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </CardContent>
                </Card>

                {/* Feature Comparison */}
                <div className="grid md:grid-cols-2 gap-6">
                    <Card className={selectedPlan === 'Free' ? 'border-2 border-blue-500' : ''}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Free Plan
                                {selectedPlan === 'Free' && <Badge>Active</Badge>}
                            </CardTitle>
                            <CardDescription>Perfect for casual searches</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span>3 search results per query</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span>5 sentences of content</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span>Basic related topics</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span>No API key required</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <XCircle className="h-4 w-4" />
                                <span>Standard processing</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={selectedPlan === 'Pro' ? 'border-2 border-purple-500' : ''}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap className="h-5 w-5 text-purple-500" />
                                Pro Plan
                                {selectedPlan === 'Pro' && <Badge variant="default" className="bg-purple-500">Active</Badge>}
                            </CardTitle>
                            <CardDescription>Enhanced search for power users</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="font-medium">5 search results per query (+66%)</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="font-medium">10 sentences of content (2x more)</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="font-medium">Enhanced related topics</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span>No API key required</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="font-medium">Priority processing</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="font-medium">Pro badge indicator</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Wikipedia Search Component */}
                <WikipediaSearch
                    userPlan={selectedPlan}
                    onSearch={(query, result) => {
                        console.log('Search performed:', { query, result });
                    }}
                />

                {/* Information Cards */}
                <div className="grid md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">✅ Best For</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-1">
                            <p>• Historical facts</p>
                            <p>• Biographies</p>
                            <p>• Concepts & definitions</p>
                            <p>• General knowledge</p>
                            <p>• Reference information</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">❌ NOT For</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-1">
                            <p>• Breaking news</p>
                            <p>• Current events</p>
                            <p>• Real-time data</p>
                            <p>• Stock prices</p>
                            <p>• Weather updates</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">🔑 Key Features</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-1">
                            <p>• No API key needed</p>
                            <p>• Completely free</p>
                            <p>• Instant results</p>
                            <p>• Reliable sources</p>
                            <p>• Pro enhancements</p>
                        </CardContent>
                    </Card>
                </div>

                {/* API Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>API Information</CardTitle>
                        <CardDescription>
                            Direct access to Wikipedia's public API
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="font-medium mb-2">Endpoint:</p>
                            <code className="block bg-muted p-3 rounded text-sm">
                                https://en.wikipedia.org/w/api.php
                            </code>
                        </div>
                        <div>
                            <p className="font-medium mb-2">Example Search:</p>
                            <code className="block bg-muted p-3 rounded text-sm break-all">
                                https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=India&format=json
                            </code>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="font-medium mb-1">Free Version:</p>
                                <ul className="space-y-1 text-muted-foreground">
                                    <li>• 3 search results</li>
                                    <li>• 5 sentences extract</li>
                                    <li>• Basic related topics</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-medium mb-1">Pro Version:</p>
                                <ul className="space-y-1 text-muted-foreground">
                                    <li>• 5 search results (+66%)</li>
                                    <li>• 10 sentences extract (2x)</li>
                                    <li>• Enhanced related topics</li>
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Footer */}
                <div className="text-center text-sm text-muted-foreground">
                    <p>
                        Wikipedia content is available under the Creative Commons Attribution-ShareAlike License.
                    </p>
                    <p className="mt-2">
                        This is a demonstration of Wikipedia API integration with Free and Pro tier support.
                    </p>
                </div>
            </div>
        </div>
    );
}

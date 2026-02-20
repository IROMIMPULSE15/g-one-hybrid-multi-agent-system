'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'

export default function AuthDiagnosticPage() {
    const { data: session, status } = useSession()
    const [tokenInfo, setTokenInfo] = useState<any>(null)

    useEffect(() => {
        if (session) {
            setTokenInfo({
                hasAccessToken: !!(session as any)?.accessToken,
                accessTokenPreview: (session as any)?.accessToken
                    ? `${(session as any).accessToken.substring(0, 20)}...`
                    : 'None',
                userName: session.user?.name,
                userEmail: session.user?.email,
                provider: (session as any)?.provider || 'Unknown'
            })
        }
    }, [session])

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading authentication status...</p>
                </div>
            </div>
        )
    }

    if (!session) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
                    <div className="text-center mb-6">
                        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Not Authenticated</h1>
                        <p className="text-gray-600 mb-6">
                            You need to sign in with Google to use the Email Agent
                        </p>
                    </div>

                    <button
                        onClick={() => signIn('google')}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Sign in with Google
                    </button>

                    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                            <strong>⚠️ Important:</strong> Make sure to grant Gmail permissions when signing in!
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4">
            <div className="max-w-3xl mx-auto">
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 text-white">
                        <h1 className="text-3xl font-bold mb-2">🔐 Authentication Diagnostic</h1>
                        <p className="text-blue-100">Check your Google OAuth and Gmail permissions</p>
                    </div>

                    {/* Status Cards */}
                    <div className="p-6 space-y-4">
                        {/* Authentication Status */}
                        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-green-900">Authenticated</h3>
                                    <p className="text-sm text-green-700">Signed in as {session.user?.email}</p>
                                </div>
                            </div>
                        </div>

                        {/* Access Token Status */}
                        <div className={`border rounded-lg p-4 ${tokenInfo?.hasAccessToken
                                ? 'border-green-200 bg-green-50'
                                : 'border-red-200 bg-red-50'
                            }`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tokenInfo?.hasAccessToken
                                        ? 'bg-green-100'
                                        : 'bg-red-100'
                                    }`}>
                                    {tokenInfo?.hasAccessToken ? (
                                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) : (
                                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    )}
                                </div>
                                <div>
                                    <h3 className={`font-semibold ${tokenInfo?.hasAccessToken ? 'text-green-900' : 'text-red-900'
                                        }`}>
                                        {tokenInfo?.hasAccessToken ? 'Access Token Present' : 'Access Token Missing'}
                                    </h3>
                                    <p className={`text-sm ${tokenInfo?.hasAccessToken ? 'text-green-700' : 'text-red-700'
                                        }`}>
                                        {tokenInfo?.hasAccessToken
                                            ? `Token: ${tokenInfo.accessTokenPreview}`
                                            : 'Gmail API calls will fail - reconnect required'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* User Info */}
                        <div className="border border-gray-200 rounded-lg p-4">
                            <h3 className="font-semibold text-gray-900 mb-3">Session Information</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Name:</span>
                                    <span className="font-medium">{session.user?.name || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Email:</span>
                                    <span className="font-medium">{session.user?.email || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Provider:</span>
                                    <span className="font-medium">{tokenInfo?.provider}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Has Gmail Token:</span>
                                    <span className={`font-medium ${tokenInfo?.hasAccessToken ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                        {tokenInfo?.hasAccessToken ? 'Yes ✓' : 'No ✗'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Action Required */}
                        {!tokenInfo?.hasAccessToken && (
                            <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                                <h3 className="font-semibold text-orange-900 mb-2">⚠️ Action Required</h3>
                                <p className="text-sm text-orange-800 mb-4">
                                    Your session doesn't have a Gmail access token. This means the Email Agent cannot save drafts to Gmail.
                                </p>
                                <button
                                    onClick={() => {
                                        signOut({ redirect: false }).then(() => {
                                            setTimeout(() => signIn('google'), 500)
                                        })
                                    }}
                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                                >
                                    Reconnect Google Account
                                </button>
                            </div>
                        )}

                        {/* Success Message */}
                        {tokenInfo?.hasAccessToken && (
                            <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                                <h3 className="font-semibold text-green-900 mb-2">✅ All Set!</h3>
                                <p className="text-sm text-green-800">
                                    Your Email Agent is ready to save drafts to Gmail. Go to the demo page and try it out!
                                </p>
                                <a
                                    href="/demo"
                                    className="mt-3 inline-block bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                                >
                                    Go to Demo →
                                </a>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                        <button
                            onClick={() => signOut()}
                            className="text-red-600 hover:text-red-700 font-medium text-sm"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>

                {/* Debug Info (Development Only) */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="mt-6 bg-gray-800 text-gray-100 rounded-lg p-4 font-mono text-xs overflow-auto">
                        <h4 className="font-semibold mb-2">Debug Info (Dev Only)</h4>
                        <pre>{JSON.stringify({ session, tokenInfo }, null, 2)}</pre>
                    </div>
                )}
            </div>
        </div>
    )
}

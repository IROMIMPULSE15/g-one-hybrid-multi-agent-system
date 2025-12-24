'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface User {
  id: string;
  name: string;
  email: string;
  plan: string;
  chatsUsed: number;
  chatsLimit: number;
  createdAt: string;
}

export default function UserDetails() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Redirect to login if not authenticated
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }

    // If authenticated, set user from session
    if (status === 'authenticated' && session?.user) {
      setUser({
        id: session.user.id || '',
        name: session.user.name || 'Unknown',
        email: session.user.email || '',
        plan: (session.user as any).plan || 'Free',
        chatsUsed: (session.user as any).chatsUsed || 0,
        chatsLimit: (session.user as any).chatsLimit || 200,
        createdAt: new Date().toISOString(),
      });
      setLoading(false);
    }
  }, [status, session, router]);

  const handleLogout = async () => {
    await signOut({ redirect: true, callbackUrl: '/auth/login' });
  };

  if (loading || status === 'loading') {
    return <div className="p-4 text-center text-gray-400">Loading...</div>;
  }

  if (!user) {
    return <div className="p-4 text-center text-gray-400">No user data available</div>;
  }

  const usagePercentage = (user.chatsUsed / user.chatsLimit) * 100;

  return (
    <div className="space-y-6">
      <div className="p-6 bg-gradient-to-br from-purple-900 to-slate-900 rounded-lg shadow-lg border border-purple-700">
        <h2 className="text-2xl font-bold mb-6 text-white">User Profile</h2>
        
        <div className="space-y-4">
          <div className="border-b border-purple-700 pb-4">
            <p className="text-gray-400 text-sm">Full Name</p>
            <p className="text-white text-lg font-semibold">{user.name}</p>
          </div>
          
          <div className="border-b border-purple-700 pb-4">
            <p className="text-gray-400 text-sm">Email</p>
            <p className="text-white text-lg font-semibold">{user.email}</p>
          </div>
          
          <div className="border-b border-purple-700 pb-4">
            <p className="text-gray-400 text-sm">Plan</p>
            <div className="flex items-center gap-2">
              <p className="text-white text-lg font-semibold">{user.plan}</p>
              <span className="px-3 py-1 bg-purple-600 text-white text-xs rounded-full">
                {user.plan === 'Free' ? '200 chats' : user.plan === 'Pro' ? 'Unlimited' : 'Enterprise'}
              </span>
            </div>
          </div>

          <div className="border-b border-purple-700 pb-4">
            <p className="text-gray-400 text-sm mb-3">Chat Usage</p>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white">{user.chatsUsed} / {user.chatsLimit} chats</span>
              <span className="text-purple-400 text-sm">{Math.round(usagePercentage)}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2.5">
              <div
                className="bg-gradient-to-r from-purple-600 to-cyan-600 h-2.5 rounded-full transition-all"
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              ></div>
            </div>
          </div>

          {user.plan === 'Free' && user.chatsUsed >= user.chatsLimit && (
            <div className="bg-orange-900/30 border border-orange-700 rounded-lg p-4">
              <p className="text-orange-300 text-sm">
                You've used all your free chats. Upgrade to Pro or Enterprise for more!
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 flex gap-4">
          <Button
            onClick={() => router.push('/pricing')}
            className="flex-1 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white"
          >
            Upgrade Plan
          </Button>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="flex-1 border-purple-700 text-purple-400 hover:bg-purple-900/30"
          >
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
} 
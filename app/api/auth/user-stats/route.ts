import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

/**
 * Get comprehensive user statistics for analytics
 * GET /api/auth/user-stats
 * Query params: email (optional)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    console.log('📊 User stats requested for email:', email);

    await connectDB();

    if (email) {
      // Get specific user stats
      const user = await User.findOne({ email: email.toLowerCase().trim() });

      if (!user) {
        return NextResponse.json(
          { success: false, message: 'User not found' },
          { status: 404 }
        );
      }

      const chatsLimitMap = {
        'Free': 200,
        'Pro': 10000,
        'Enterprise': 50000
      };
      const chatsLimit = chatsLimitMap[user.plan as keyof typeof chatsLimitMap] || 200;
      const usagePercentage = (user.chatsUsed / chatsLimit) * 100;

      return NextResponse.json({
        success: true,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          plan: user.plan,
          chatsUsed: user.chatsUsed,
          chatsLimit,
          usagePercentage: Math.round(usagePercentage),
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
          isActive: user.isActive,
          daysActive: Math.floor((new Date().getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        }
      });
    } else {
      // Get overall system stats
      const totalUsers = await User.countDocuments();
      const activeUsers = await User.countDocuments({ isActive: true });
      const usersByPlan = await User.aggregate([
        { $group: { _id: '$plan', count: { $sum: 1 } } }
      ]);
      const totalChatsUsed = await User.aggregate([
        { $group: { _id: null, total: { $sum: '$chatsUsed' } } }
      ]);

      return NextResponse.json({
        success: true,
        stats: {
          totalUsers,
          activeUsers,
          inactiveUsers: totalUsers - activeUsers,
          usersByPlan: usersByPlan.reduce((acc, { _id, count }) => {
            acc[_id || 'Unknown'] = count;
            return acc;
          }, {}),
          totalChatsUsed: totalChatsUsed[0]?.total || 0,
          timestamp: new Date()
        }
      });
    }
  } catch (error: any) {
    console.error('❌ User stats error:', error);
    return NextResponse.json(
      { 
        success: false,
        message: error.message || 'Internal server error'
      },
      { status: 500 }
    );
  }
}

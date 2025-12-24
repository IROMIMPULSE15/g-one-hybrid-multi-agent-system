import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

/**
 * Update user chat usage
 * POST /api/auth/update-usage
 * Body: { email: string, increment: number }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, increment = 1 } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email is required' },
        { status: 400 }
      );
    }

    if (increment < 0 || increment > 100) {
      return NextResponse.json(
        { success: false, message: 'Invalid increment value' },
        { status: 400 }
      );
    }

    console.log(`📝 Updating chat usage for ${email} by ${increment}`);

    await connectDB();

    // Find user and check if they have chat quota available
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Get chat limit
    const chatsLimitMap = {
      'Free': 200,
      'Pro': 10000,
      'Enterprise': 50000
    };
    const chatsLimit = chatsLimitMap[user.plan as keyof typeof chatsLimitMap] || 200;

    // Check if user has chat quota
    if (user.chatsUsed >= chatsLimit) {
      console.warn(`⚠️ User ${email} has reached chat limit`);
      return NextResponse.json(
        { 
          success: false, 
          message: 'Chat limit reached. Please upgrade your plan.',
          chatsUsed: user.chatsUsed,
          chatsLimit
        },
        { status: 429 }
      );
    }

    // Update chat usage
    user.chatsUsed = Math.min(user.chatsUsed + increment, chatsLimit);
    await user.save();

    console.log(`✅ Chat usage updated. New count: ${user.chatsUsed}/${chatsLimit}`);

    return NextResponse.json({
      success: true,
      message: 'Chat usage updated',
      chatsUsed: user.chatsUsed,
      chatsLimit,
      remainingChats: chatsLimit - user.chatsUsed,
      usagePercentage: Math.round((user.chatsUsed / chatsLimit) * 100)
    });

  } catch (error: any) {
    console.error('❌ Update usage error:', error);
    return NextResponse.json(
      { 
        success: false,
        message: error.message || 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET request - returns chat usage for a user
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email is required' },
        { status: 400 }
      );
    }

    console.log(`📊 Checking chat usage for ${email}`);

    await connectDB();

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

    return NextResponse.json({
      success: true,
      chatsUsed: user.chatsUsed,
      chatsLimit,
      remainingChats: chatsLimit - user.chatsUsed,
      usagePercentage: Math.round((user.chatsUsed / chatsLimit) * 100),
      plan: user.plan
    });

  } catch (error: any) {
    console.error('❌ Get usage error:', error);
    return NextResponse.json(
      { 
        success: false,
        message: error.message || 'Internal server error'
      },
      { status: 500 }
    );
  }
}

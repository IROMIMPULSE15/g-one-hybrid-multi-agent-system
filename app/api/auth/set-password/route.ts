import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

/**
 * Update user password
 * POST /api/auth/set-password
 * Body: { email: string, newPassword: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, newPassword } = body;

    if (!email || !newPassword) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Password must be at least 6 characters long' 
        },
        { status: 400 }
      );
    }

    console.log(`🔐 Setting password for user: ${email}`);

    await connectDB();

    // Find user
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user already has a strong password (not a random one)
    if (user.password && user.password.length > 20) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'You already have a password set. Use login instead.' 
        },
        { status: 400 }
      );
    }

    // Update password (will be hashed by the User model pre-save hook)
    user.password = newPassword;
    await user.save();

    console.log(`✅ Password set successfully for user: ${email}`);

    return NextResponse.json({
      success: true,
      message: 'Password set successfully. You can now login with email and password.',
    });

  } catch (error: any) {
    console.error('❌ Set password error:', error);
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
 * Check if user has a password set
 * GET /api/auth/has-password?email=user@example.com
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

    console.log(`🔍 Checking if user has password set: ${email}`);

    await connectDB();

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Check if password is a real password or random (random password is longer than real ones)
    // Google users get random passwords like "xyzabc1234567890123456"
    // Real passwords from signup are user-set
    const hasRealPassword = user.password && user.password.length < 25;

    console.log(`✅ Password check complete. Has real password: ${hasRealPassword}`);

    return NextResponse.json({
      success: true,
      hasPassword: hasRealPassword,
      provider: user.googleId ? 'google' : 'email'
    });

  } catch (error: any) {
    console.error('❌ Check password error:', error);
    return NextResponse.json(
      { 
        success: false,
        message: error.message || 'Internal server error'
      },
      { status: 500 }
    );
  }
}

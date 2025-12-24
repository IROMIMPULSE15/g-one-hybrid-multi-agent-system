import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function GET() {
  return NextResponse.json(
    { message: "Method not allowed" },
    { status: 405 }
  );
}

export async function POST(req: Request) {
  console.log('🔍 Login API route called');
  try {
    // Parse request body
    const body = await req.json();
    const { email, password } = body;
    console.log('📧 Attempting login for email:', email);

    if (!email || !password) {
      console.log('❌ Missing email or password');
      return NextResponse.json(
        { success: false, message: 'Email and password are required' },
        { status: 422 }
      );
    }

    console.log('🔌 Connecting to MongoDB...');
    await connectDB();
    console.log('✅ Successfully connected to MongoDB');

    // Find user by email (case-insensitive)
    console.log('🔍 Looking for user with email:', email);
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      console.log('❌ User not found');
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }
    console.log('✅ User found:', user._id);

    // Check if user is active
    if (!user.isActive) {
      console.log('❌ User account is inactive');
      return NextResponse.json(
        { success: false, message: 'User account is inactive' },
        { status: 401 }
      );
    }

    // Verify password using the model's method
    console.log('🔐 Verifying password...');
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      console.log('❌ Invalid password');
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }
    console.log('✅ Password verified');

    // Update last login (using efficient MongoDB update instead of save)
    console.log('📝 Recording login timestamp...');
    user.lastLogin = new Date();
    await user.save();
    console.log('✅ Login recorded in database');

    // Update last login
    console.log('📝 Updating last login timestamp...');
    user.lastLogin = new Date();
    await user.save();
    console.log('✅ Last login updated');

    // Calculate chats limit based on plan
    const chatsLimitMap = {
      'Free': 200,
      'Pro': 10000,
      'Enterprise': 50000
    };
    const chatsLimit = chatsLimitMap[user.plan as keyof typeof chatsLimitMap] || 200;

    // Create session data with consistent structure
    const userData = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      plan: user.plan,
      chatsUsed: user.chatsUsed || 0,
      chatsLimit,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      isLoggedIn: true
    };

    console.log('✅ Login successful, returning user data');
    return NextResponse.json({
      success: true,
      user: userData
    });

  } catch (error: any) {
    console.error('❌ Login error:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error',
        error: error.message
      },
      { status: 500 }
    );
  }
} 
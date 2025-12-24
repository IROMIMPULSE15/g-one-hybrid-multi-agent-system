import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function GET(request: NextRequest) {
  try {
    // Get email from search params
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { 
          success: false,
          message: 'Email is required' 
        },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    await connectDB();
    console.log('Attempting to find user with email:', email);

    // Find user by email
    const user = await User.findOne({ email }).select('-password'); // Exclude password field
    
    if (!user) {
      return NextResponse.json(
        { 
          success: false,
          message: 'User not found' 
        },
        { status: 404 }
      );
    }

    // Calculate chats limit based on plan
    const chatsLimit = user.plan === 'Free' ? 200 : user.plan === 'Pro' ? 10000 : 50000;

    // Return user data with consistent structure
    return NextResponse.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        plan: user.plan,
        chatsUsed: user.chatsUsed || 0,
        chatsLimit,
        createdAt: user.createdAt,
        isLoggedIn: true
      }
    });

  } catch (error: any) {
    console.error('Fetch user error:', {
      message: error.message,
      code: error.code,
      name: error.name
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
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
        { message: 'Email is required' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    await connectDB();
    console.log('Connected to MongoDB, searching for user:', email);

    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    // Return user data
    return NextResponse.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        plan: user.plan,
        createdAt: user.createdAt
      }
    });

  } catch (error: any) {
    console.error('Fetch user error:', error);
    return NextResponse.json(
      { 
        message: 'Internal server error', 
        error: error.message 
      },
      { status: 500 }
    );
  }
} 
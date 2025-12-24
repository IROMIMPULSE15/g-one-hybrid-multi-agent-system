import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

// Add GET method handler for browser testing
export async function GET() {
  return NextResponse.json(
    { message: "Method not allowed" },
    { status: 405 }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, plan = 'Free' } = body;

    console.log(`📝 Signup attempt for email: ${email}`);

    // Validate required fields
    if (!name || !email || !password) {
      console.warn(`❌ Missing required fields for signup`);
      return NextResponse.json(
        { 
          success: false,
          message: 'Missing required fields' 
        },
        { status: 422 }
      );
    }

    // Validate plan
    const validPlans = ['Free', 'Pro', 'Enterprise'];
    if (!validPlans.includes(plan)) {
      console.warn(`❌ Invalid plan selected: ${plan}`);
      return NextResponse.json(
        { 
          success: false,
          message: 'Invalid plan selected' 
        },
        { status: 422 }
      );
    }

    console.log(`🔌 Connecting to MongoDB...`);
    await connectDB();
    console.log(`✅ MongoDB connected`);

    // Check if user already exists
    console.log(`🔍 Checking if user exists...`);
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.warn(`❌ User already exists: ${email}`);
      return NextResponse.json(
        { 
          success: false,
          message: 'User already exists with this email' 
        },
        { status: 422 }
      );
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      plan,
      chatsUsed: 0,
      isActive: true,
      createdAt: new Date()
    });

    console.log(`✅ User created successfully: ${user._id}`);
    console.log(`📝 Storing user password hash in MongoDB (${user.password.substring(0, 10)}...)`);

    // Calculate chats limit based on plan
    const chatsLimitMap = {
      'Free': 200,
      'Pro': 10000,
      'Enterprise': 50000
    };
    const chatsLimit = chatsLimitMap[plan as keyof typeof chatsLimitMap] || 200;

    return NextResponse.json(
      { 
        success: true,
        message: 'User created successfully',
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          plan: user.plan,
          chatsUsed: 0,
          chatsLimit,
          createdAt: user.createdAt,
          isLoggedIn: true
        }
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('❌ Signup error:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });

    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return NextResponse.json(
        { 
          success: false,
          message: `A user with this ${field} already exists` 
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { 
        success: false,
        message: error.message || 'Internal server error' 
      },
      { status: 500 }
    );
  }
} 
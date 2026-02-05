import { NextResponse } from 'next/server';


export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime ? process.uptime() : 'N/A',
      services: {
        api: 'operational',
        database: 'checking...',
      },
    };

    // Optional: Add database connectivity check
    // Uncomment if you want to verify MongoDB connection
    /*
    try {
      const { default: dbConnect } = await import('@/lib/dbConnect');
      await dbConnect();
      healthStatus.services.database = 'operational';
    } catch (dbError) {
      healthStatus.services.database = 'degraded';
      healthStatus.status = 'degraded';
    }
    */

    return NextResponse.json(healthStatus, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
}

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasDbUrl: !!process.env.DATABASE_URL,
    dbUrlPrefix: process.env.DATABASE_URL?.substring(0, 15) || 'NOT SET',
    hasToken: !!process.env.DATABASE_AUTH_TOKEN,
    tokenPrefix: process.env.DATABASE_AUTH_TOKEN?.substring(0, 8) || 'NOT SET',
    nodeEnv: process.env.NODE_ENV,
  });
}
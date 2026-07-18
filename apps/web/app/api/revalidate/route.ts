import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

/**
 * On-demand cache revalidation endpoint.
 *
 * Call with:
 * - ?path=/products/abc to revalidate a specific product page
 * - ?path=/collections to revalidate collections
 * - ?path=/ to revalidate homepage
 *
 * For security, this endpoint should only be called from the admin/API
 * after product mutations (create, update, delete).
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get('path');
  const secret = searchParams.get('secret');

  // Simple secret check - in production, use proper env var
  const expectedSecret = process.env.REVALIDATION_SECRET;
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  if (!path) {
    return NextResponse.json(
      { error: 'Missing path parameter' },
      { status: 400 }
    );
  }

  try {
    revalidatePath(path);
    return NextResponse.json({ success: true, message: `Revalidated: ${path}` });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Revalidation failed' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifySessionToken } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Bỏ qua tuyệt đối toàn bộ file nội bộ Next.js (bao gồm _next/webpack-hmr), API auth và file tĩnh
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/favicon.ico' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Lấy cookie session
  const sessionCookie = req.cookies.get(COOKIE_NAME)?.value;
  const session = sessionCookie ? await verifySessionToken(sessionCookie) : null;
  const isAuthenticated = !!session;

  const isLoginPage = pathname === '/login';
  const isPublicPage = isLoginPage || pathname.startsWith('/tra-cuu');

  // 1. Nếu đã đăng nhập mà cố vào /login -> Chuyển hướng về /orders
  if (isLoginPage && isAuthenticated) {
    return NextResponse.redirect(new URL('/orders', req.url));
  }

  // 2. Nếu chưa đăng nhập và không phải trang công khai -> Bắt buộc chuyển về /login
  if (!isPublicPage && !isAuthenticated) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }


  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Bỏ qua tất cả các file hệ thống và file tĩnh:
     * - api/auth (đăng nhập / đăng xuất)
     * - _next (bao gồm _next/static, _next/image, _next/webpack-hmr)
     * - favicon.ico
     * - Tất cả file có đuôi mở rộng (.jpg, .png, .svg, .js, .css, ...)
     */
    '/((?!api/auth|_next|favicon\\.ico|.*\\.[\\w]+$).*)',
  ],
};

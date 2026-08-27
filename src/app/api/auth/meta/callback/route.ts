import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { exchangeCodeForToken, discoverFacebookPages } from "@/lib/meta";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const forwardedProto = req.headers.get("x-forwarded-proto") || (forwardedHost.includes("localhost") ? "http" : "https");
  const baseUrl = `${forwardedProto}://${forwardedHost}`;

  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { ownerEmail: session.user.email },
    });

    if (!business) {
      return NextResponse.redirect(new URL("/settings?meta=error&reason=missing_business", baseUrl));
    }

    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    
    if (error) {
      return NextResponse.redirect(new URL("/settings?meta=error&reason=oauth_denied", baseUrl));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL("/settings?meta=error&reason=missing_params", baseUrl));
    }

    const savedState = req.cookies.get("meta_oauth_state")?.value;
    if (!savedState || state !== savedState) {
      return NextResponse.redirect(new URL("/settings?meta=error&reason=invalid_state", baseUrl));
    }

    let userAccessToken: string;
    try {
      userAccessToken = await exchangeCodeForToken(code, baseUrl);
    } catch (e) {
      console.error("Token exchange failed", e);
      return NextResponse.redirect(new URL("/settings?meta=error&reason=token_exchange_failed", baseUrl));
    }

    let pages: Array<{ id: string, name: string, access_token: string, instagram_business_account?: { id: string } }> = [];
    try {
      pages = await discoverFacebookPages(userAccessToken);
    } catch (e) {
      console.error("Pages discovery failed", e);
      return NextResponse.redirect(new URL("/settings?meta=error&reason=pages_fetch_failed", baseUrl));
    }

    if (!pages || pages.length === 0) {
      return NextResponse.redirect(new URL("/settings?meta=error&reason=no_pages_found", baseUrl));
    }

    // Persist discovered channels
    for (const page of pages) {
      const pageId = page.id;
      const pageName = page.name;
      const pageAccessToken = page.access_token;
      const instagramAccountId = page.instagram_business_account?.id;

      if (!pageId || !pageAccessToken) continue;

      // Upsert Messenger Channel
      const existingMessenger = await prisma.channel.findFirst({
        where: { businessId: business.id, pageId: pageId, type: "messenger" }
      });

      if (existingMessenger) {
        await prisma.channel.update({
          where: { id: existingMessenger.id },
          data: {
            displayName: pageName,
            accessToken: pageAccessToken,
            connected: true,
          }
        });
      } else {
        await prisma.channel.create({
          data: {
            businessId: business.id,
            type: "messenger",
            displayName: pageName,
            pageId: pageId,
            accessToken: pageAccessToken,
            connected: true,
          }
        });
      }

      // Upsert Instagram Channel if linked
      if (instagramAccountId) {
        const existingInstagram = await prisma.channel.findFirst({
          where: { businessId: business.id, instagramId: instagramAccountId, type: "instagram" }
        });

        if (existingInstagram) {
          await prisma.channel.update({
            where: { id: existingInstagram.id },
            data: {
              displayName: `${pageName} (Instagram)`,
              accessToken: pageAccessToken, // Graph API uses the Page Access Token for IG messaging too
              pageId: pageId, 
              connected: true,
            }
          });
        } else {
          await prisma.channel.create({
            data: {
              businessId: business.id,
              type: "instagram",
              displayName: `${pageName} (Instagram)`,
              instagramId: instagramAccountId,
              pageId: pageId,
              accessToken: pageAccessToken,
              connected: true,
            }
          });
        }
      }
    }

    const response = NextResponse.redirect(new URL("/settings?meta=connected", baseUrl));
    response.cookies.delete("meta_oauth_state");

    return response;
  } catch (error) {
    console.error("Meta callback error:", error);
    return NextResponse.redirect(new URL("/settings?meta=error&reason=internal_error", baseUrl));
  }
}

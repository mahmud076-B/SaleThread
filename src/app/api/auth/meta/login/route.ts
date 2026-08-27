import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMetaConfig, META_API_VERSION } from "@/lib/meta";
import crypto from "crypto";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const forwardedProto = req.headers.get("x-forwarded-proto") || (forwardedHost.includes("localhost") ? "http" : "https");
    const baseUrl = `${forwardedProto}://${forwardedHost}`;
    const config = getMetaConfig(baseUrl);
    const state = crypto.randomBytes(16).toString("hex");

    const url = new URL(`https://www.facebook.com/${META_API_VERSION}/dialog/oauth`);
    url.searchParams.set("client_id", config.appId);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", config.scopes);
    url.searchParams.set("response_type", "code");

    const response = NextResponse.redirect(url.toString());
    
    // Set CSRF state cookie
    response.cookies.set("meta_oauth_state", state, {
      httpOnly: true,
      secure: forwardedProto === "https",
      sameSite: "lax",
      maxAge: 60 * 10, // 10 minutes
    });

    return response;
  } catch (error) {
    console.error("Meta login error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

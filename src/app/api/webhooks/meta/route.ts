import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ingestIncomingMessage, NormalizedMessage } from "@/lib/meta/ingest";

// Handle GET for webhook verification
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    // Return hub.challenge as plain text
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// Handle POST for webhook events
export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-hub-signature-256");
    if (!signature) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      console.error("META_APP_SECRET not configured");
      return new NextResponse("Internal Server Error", { status: 500 });
    }

    // Read raw body for HMAC verification
    const rawBody = await req.text();

    // Verify signature
    const hmac = crypto.createHmac("sha256", appSecret);
    const expectedSignature = `sha256=${hmac.update(rawBody).digest("hex")}`;
    
    // Timing-safe compare
    const sigBuffer = Buffer.from(signature);
    const expBuffer = Buffer.from(expectedSignature);
    
    if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Parse payload after signature verification
    const body = JSON.parse(rawBody);

    if (body.object === "page" || body.object === "instagram") {
      const isInstagram = body.object === "instagram";
      const channelType = isInstagram ? "instagram" : "messenger";

      for (const entry of body.entry) {
        const channelIdentifier = entry.id; // Page ID or IG Account ID

        for (const messagingItem of entry.messaging || []) {
          // We only prioritize plain text messages for this step
          if (messagingItem.message && messagingItem.message.text) {
            const senderId = messagingItem.sender.id;
            const text = messagingItem.message.text;
            const messageId = messagingItem.message.mid;
            // Use messaging timestamp, or entry time, or current time
            const timestamp = messagingItem.timestamp || entry.time || Date.now();

            const normalizedEvent: NormalizedMessage = {
              channelType,
              channelIdentifier,
              senderId,
              messageId,
              text,
              timestamp,
            };

            await ingestIncomingMessage(normalizedEvent);
          } else {
            // Safely ignore non-text events, attachments, postbacks, etc.
            console.log(`[Webhook] Ignored non-text or unsupported event for ${channelType}`);
          }
        }
      }
    }

    // Always return 200 OK quickly to acknowledge receipt
    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    // Avoid logging raw body or sensitive data
    console.error("Webhook processing error:", error instanceof Error ? error.message : "Unknown error");
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

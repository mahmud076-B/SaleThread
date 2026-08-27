export const META_API_VERSION = "v26.0";

export function getMetaConfig(baseUrl: string) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const verifyToken = process.env.META_VERIFY_TOKEN;

  if (!appId || !appSecret || !baseUrl) {
    throw new Error("Missing Meta environment variables or baseUrl");
  }

  return {
    appId,
    appSecret,
    verifyToken,
    baseUrl,
    redirectUri: `${baseUrl}/api/auth/meta/callback`,
    scopes: [
      "pages_show_list",
      "pages_messaging",
      "pages_manage_metadata",
      "instagram_basic",
      "instagram_manage_messages",
      "business_management",
    ].join(","),
  };
}

export async function exchangeCodeForToken(code: string, baseUrl: string) {
  const config = getMetaConfig(baseUrl);
  const tokenUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", config.appId);
  tokenUrl.searchParams.set("redirect_uri", config.redirectUri);
  tokenUrl.searchParams.set("client_secret", config.appSecret);
  tokenUrl.searchParams.set("code", code);

  const res = await fetch(tokenUrl.toString(), {
    method: "GET",
    headers: { "Accept": "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed with status ${res.status}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("No access_token in response");
  }

  return data.access_token as string;
}

export async function discoverFacebookPages(userAccessToken: string) {
  const pagesUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/me/accounts`);
  pagesUrl.searchParams.set("fields", "id,name,access_token,instagram_business_account");
  pagesUrl.searchParams.set("access_token", userAccessToken);

  const res = await fetch(pagesUrl.toString());
  if (!res.ok) {
    throw new Error(`Pages fetch failed with status ${res.status}`);
  }

  const data = await res.json();
  return data.data as Array<{
    id: string;
    name: string;
    access_token: string;
    instagram_business_account?: { id: string };
  }>;
}

export async function sendMessengerReply(
  pageId: string,
  pageAccessToken: string,
  recipientPsid: string,
  text: string
) {
  const url = `https://graph.facebook.com/${META_API_VERSION}/${pageId}/messages`;
  
  const payload = {
    recipient: { id: recipientPsid },
    message: { text }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${pageAccessToken}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    let errorMsg = `Meta API returned ${res.status}`;
    try {
      const errorData = await res.json();
      if (errorData.error && errorData.error.message) {
        errorMsg += `: ${errorData.error.message}`;
      }
    } catch (e) {
      // Ignore JSON parse errors for the error body
    }
    throw new Error(errorMsg);
  }

  const data = await res.json();
  return data;
}

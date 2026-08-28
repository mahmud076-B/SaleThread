import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export type MessageContext = {
  sender: "business" | "customer" | "ai_draft";
  content: string;
};

export type Suggestion = {
  text: string;
  tone: string;
};

export async function generateReplySuggestions(messages: MessageContext[]): Promise<Suggestion[]> {
  if (!openai) {
    throw new Error("OpenAI API key is not configured.");
  }

  // Format messages for OpenAI
  const conversationContext = messages.map(msg => `${msg.sender === 'business' ? 'Agent' : 'Customer'}: ${msg.content}`).join("\n");

  const prompt = `You are a professional sales and customer support assistant helping an agent reply to a customer conversation.
Your goal is to suggest 3 different short, concise, and highly effective replies the agent can send next.

Conversation history (oldest to newest):
${conversationContext}

CRITICAL RULES:
1. NEVER invent prices, discounts, delivery dates, or policies. Only use information explicitly present in the conversation history.
2. If the customer asks a question you don't know the answer to, suggest a polite reply saying you will check and get back to them.
3. NEVER mention that you are an AI.
4. Keep the replies very concise and natural for a Messenger/Instagram chat.
5. MATCH THE CUSTOMER'S LANGUAGE exactly. If the customer writes in Bangla, reply in Bangla. If English, reply in English. If Banglish (Bengali written in English letters), reply in Banglish.
6. Do not include placeholders like "[Your Name]". Write the exact text the agent can send with one click.
7. Tone should vary slightly across the 3 suggestions (e.g., Professional, Friendly, Concise).
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      messages: [
        { role: "system", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "reply_suggestions",
          schema: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: {
                      type: "string",
                      description: "The exact suggested reply text."
                    },
                    tone: {
                      type: "string",
                      description: "A short 1-word description of the tone (e.g., 'Professional', 'Friendly', 'Direct', 'Concise')."
                    }
                  },
                  required: ["text", "tone"],
                  additionalProperties: false
                },
                minItems: 3,
                maxItems: 3
              }
            },
            required: ["suggestions"],
            additionalProperties: false
          },
          strict: true
        }
      }
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response from OpenAI");
    
    const parsed = JSON.parse(content);
    return parsed.suggestions;
  } catch (error) {
    console.error("OpenAI Error:", error);
    throw new Error("Failed to generate AI suggestions.");
  }
}

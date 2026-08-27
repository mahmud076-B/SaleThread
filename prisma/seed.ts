import { PrismaClient, ChannelType, ConversationStatus, MessageSender, ComplianceState } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // ── Clean slate ──────────────────────────────────────────────────────────
  await prisma.followUpDraft.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.productCatalogItem.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.business.deleteMany();
  await prisma.user.deleteMany();

  // ── User + Business ───────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("demo1234", 12);

  const user = await prisma.user.create({
    data: {
      email: "demo@salethread.com",
      passwordHash,
    },
  });

  const business = await prisma.business.create({
    data: {
      name: "Rina Fashion House",
      ownerEmail: user.email,
    },
  });

  // ── Channels ──────────────────────────────────────────────────────────────
  const messengerChannel = await prisma.channel.create({
    data: {
      businessId: business.id,
      type: ChannelType.messenger,
      displayName: "Rina Fashion — Facebook Page",
      connected: true,
    },
  });

  const instagramChannel = await prisma.channel.create({
    data: {
      businessId: business.id,
      type: ChannelType.instagram,
      displayName: "@rinafashionbd",
      connected: true,
    },
  });

  // ── Product Catalog ───────────────────────────────────────────────────────
  await prisma.productCatalogItem.createMany({
    data: [
      { businessId: business.id, name: "Jamdani Saree (Red)", price: 3500, stockNote: "5 pieces left" },
      { businessId: business.id, name: "Muslin Kurta (White)", price: 1200, stockNote: null },
      { businessId: business.id, name: "Cotton Salwar Set (Blue)", price: 1800, stockNote: "Last 2 pieces" },
      { businessId: business.id, name: "Silk Dupatta", price: 800, stockNote: "In stock" },
      { businessId: business.id, name: "Embroidered Panjabi", price: 2200, stockNote: "New arrival" },
    ],
  });

  // ── Customers ─────────────────────────────────────────────────────────────
  const customerData = [
    { name: "Nusrat Jahan", channelType: ChannelType.messenger, externalId: "fb_uid_1001" },
    { name: "Raihan Ahmed", channelType: ChannelType.instagram, externalId: "ig_uid_2001" },
    { name: "Mithila Akter", channelType: ChannelType.messenger, externalId: "fb_uid_1002" },
    { name: "Sabbir Hossain", channelType: ChannelType.instagram, externalId: "ig_uid_2002" },
    { name: "Tania Islam", channelType: ChannelType.messenger, externalId: "fb_uid_1003" },
    { name: "Arif Chowdhury", channelType: ChannelType.instagram, externalId: "ig_uid_2003" },
    { name: "Sharmin Sultana", channelType: ChannelType.messenger, externalId: "fb_uid_1004" },
    { name: "Mahbub Alam", channelType: ChannelType.instagram, externalId: "ig_uid_2004" },
    { name: "Farida Begum", channelType: ChannelType.messenger, externalId: "fb_uid_1005" },
    { name: "Imran Khan", channelType: ChannelType.instagram, externalId: "ig_uid_2005" },
  ];

  const customers = await Promise.all(
    customerData.map((c) =>
      prisma.customer.create({ data: { businessId: business.id, ...c } })
    )
  );

  const [nusrat, raihan, mithila, sabbir, tania, arif, sharmin, mahbub, farida, imran] = customers;

  // ── Conversations + Messages ──────────────────────────────────────────────
  // Helper to create a conversation with messages
  async function createConv({
    customer,
    channel,
    status,
    reason,
    estimatedValue,
    lastMessageAt,
    messages,
  }: {
    customer: (typeof customers)[number];
    channel: typeof messengerChannel;
    status: ConversationStatus;
    reason?: string;
    estimatedValue?: number;
    lastMessageAt: Date;
    messages: Array<{ sender: MessageSender; content: string; minutesAgo: number }>;
  }) {
    const conv = await prisma.conversation.create({
      data: {
        businessId: business.id,
        customerId: customer.id,
        channelId: channel.id,
        status,
        reason: reason ?? null,
        estimatedValue: estimatedValue ?? null,
        lastMessageAt,
      },
    });

    const now = new Date();
    await prisma.message.createMany({
      data: messages.map((m) => ({
        conversationId: conv.id,
        sender: m.sender,
        content: m.content,
        sentAt: new Date(now.getTime() - m.minutesAgo * 60 * 1000),
      })),
    });

    return conv;
  }

  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);

  // ── SOLD conversations ────────────────────────────────────────────────────
  const conv1 = await createConv({
    customer: nusrat,
    channel: messengerChannel,
    status: ConversationStatus.sold,
    reason: "Customer confirmed purchase of Jamdani Saree after seeing price",
    estimatedValue: 3500,
    lastMessageAt: hoursAgo(2),
    messages: [
      { sender: MessageSender.customer, content: "Assalamu alaikum! Jamdani saree ta ki abhi available?", minutesAgo: 180 },
      { sender: MessageSender.business, content: "Walaikum assalam! Haa, ekdom available. 5 pcs ache. Price 3500 taka.", minutesAgo: 170 },
      { sender: MessageSender.customer, content: "Ok baji, order dibo. Cash on delivery hobe?", minutesAgo: 160 },
      { sender: MessageSender.business, content: "Haa, COD available. Address ta pathaan.", minutesAgo: 150 },
      { sender: MessageSender.customer, content: "Dhaka, Mirpur 10. Name: Nusrat Jahan, 01712-XXXXXX", minutesAgo: 140 },
      { sender: MessageSender.business, content: "Order confirmed! 2-3 din er modhye deliver hobe. 🎉", minutesAgo: 130 },
    ],
  });

  const conv2 = await createConv({
    customer: mithila,
    channel: messengerChannel,
    status: ConversationStatus.sold,
    reason: "Sold Muslin Kurta + Dupatta combo after size query",
    estimatedValue: 2000,
    lastMessageAt: hoursAgo(5),
    messages: [
      { sender: MessageSender.customer, content: "Apa, muslin kurta ta S size a ache? আর দুপাট্টা কি আলাদা পাওয়া যায়?", minutesAgo: 360 },
      { sender: MessageSender.business, content: "S size ache! Dupatta o ache, 800 taka. Combo nile 1800 e debo.", minutesAgo: 350 },
      { sender: MessageSender.customer, content: "Perfect! Duitai nibo. Bkash e payment korbo?", minutesAgo: 340 },
      { sender: MessageSender.business, content: "Bkash personal: 01XXXXXXXXX. 500 tk advance pathaan.", minutesAgo: 330 },
      { sender: MessageSender.customer, content: "Done, pathiye diyechi!", minutesAgo: 320 },
    ],
  });

  const conv3 = await createConv({
    customer: tania,
    channel: messengerChannel,
    status: ConversationStatus.sold,
    reason: "Cotton Salwar Set purchased for Eid gift",
    estimatedValue: 1800,
    lastMessageAt: hoursAgo(28),
    messages: [
      { sender: MessageSender.customer, content: "Salwar set ta ki gift wrap kore pathano jay? Eid er gift.", minutesAgo: 1740 },
      { sender: MessageSender.business, content: "Haa apni! Free gift wrap kori. Kono special message likhbo?", minutesAgo: 1730 },
      { sender: MessageSender.customer, content: "Nice! 'Happy Eid' likhle cholbe. Order dibo.", minutesAgo: 1720 },
      { sender: MessageSender.business, content: "Order placed! Delivery will be within 48 hrs. 🎁", minutesAgo: 1710 },
    ],
  });

  const conv4 = await createConv({
    customer: sharmin,
    channel: messengerChannel,
    status: ConversationStatus.sold,
    reason: "Embroidered Panjabi sold for groom's family",
    estimatedValue: 4400,
    lastMessageAt: hoursAgo(48),
    messages: [
      { sender: MessageSender.customer, content: "Bhai er biye te panjabi lagbe. 2 ta nibo, discount hobe?", minutesAgo: 2940 },
      { sender: MessageSender.business, content: "2 ta nile 10% off debo! 2 ta miliye 3960 taka.", minutesAgo: 2930 },
      { sender: MessageSender.customer, content: "Thik ache, nibo! L aur XL size lagbe.", minutesAgo: 2920 },
      { sender: MessageSender.business, content: "Perfect. Advance ta diye confirm koren. 🙏", minutesAgo: 2910 },
      { sender: MessageSender.customer, content: "Advance pathiye diyechi. Jldi pathaben!", minutesAgo: 2880 },
    ],
  });

  // ── LOST conversations ────────────────────────────────────────────────────
  const conv5 = await createConv({
    customer: raihan,
    channel: instagramChannel,
    status: ConversationStatus.lost,
    reason: "Price too high — customer said competitor cheaper by 500tk",
    estimatedValue: undefined,
    lastMessageAt: hoursAgo(20),
    messages: [
      { sender: MessageSender.customer, content: "Bhai jamdani saree er price koto?", minutesAgo: 1260 },
      { sender: MessageSender.business, content: "Jamdani saree 3500 taka bhai.", minutesAgo: 1250 },
      { sender: MessageSender.customer, content: "Onek beshi to! Onno jaygay 3000 te pacchi.", minutesAgo: 1240 },
      { sender: MessageSender.business, content: "Amar ta authentic, quality check kora. Aktu beshi lagbe.", minutesAgo: 1230 },
      { sender: MessageSender.customer, content: "Na bhai, thakuk.", minutesAgo: 1200 },
    ],
  });

  const conv6 = await createConv({
    customer: sabbir,
    channel: instagramChannel,
    status: ConversationStatus.lost,
    reason: "Customer went silent after asking for product photos",
    estimatedValue: undefined,
    lastMessageAt: hoursAgo(72),
    messages: [
      { sender: MessageSender.customer, content: "Silk dupatta ta r photo pathaben? Instagram a clear dekha jacche na.", minutesAgo: 4380 },
      { sender: MessageSender.business, content: "Sure! Ektu wait koren, photo pathacchi.", minutesAgo: 4370 },
      { sender: MessageSender.business, content: "[Photo sent — dupatta front and back]", minutesAgo: 4360 },
      { sender: MessageSender.customer, content: "Ok dekhlam.", minutesAgo: 4320 },
      // No response after that
    ],
  });

  const conv7 = await createConv({
    customer: arif,
    channel: instagramChannel,
    status: ConversationStatus.lost,
    reason: "Out of stock — customer wanted blue panjabi, not available in size",
    estimatedValue: undefined,
    lastMessageAt: hoursAgo(30),
    messages: [
      { sender: MessageSender.customer, content: "Panjabi ta blue color e ache? XXL size?", minutesAgo: 1860 },
      { sender: MessageSender.business, content: "Sorry bhai, blue XXL stock a nei. White o black ache.", minutesAgo: 1850 },
      { sender: MessageSender.customer, content: "Blue lagbei. Pরে stock a aile janaben.", minutesAgo: 1840 },
      { sender: MessageSender.business, content: "Sure! Stock aile notify korbo.", minutesAgo: 1830 },
    ],
  });

  // ── PENDING conversations ─────────────────────────────────────────────────
  const conv8 = await createConv({
    customer: mahbub,
    channel: instagramChannel,
    status: ConversationStatus.pending,
    reason: "Waiting for customer to confirm size and color preference",
    estimatedValue: 2200,
    lastMessageAt: hoursAgo(6),
    messages: [
      { sender: MessageSender.customer, content: "Ei ta ki stock a ache? আমার জন্য একটা রাখবেন?", minutesAgo: 380 },
      { sender: MessageSender.business, content: "Haa ache! Size ki lagbe — S, M, L, or XL?", minutesAgo: 370 },
      { sender: MessageSender.customer, content: "M hobe. Color options ki ki?", minutesAgo: 360 },
      { sender: MessageSender.business, content: "White, navy blue, aur off-white. Konta neben?", minutesAgo: 350 },
      { sender: MessageSender.customer, content: "Navy blue ta bhalo lagche. Price ta aktu kom hoye na?", minutesAgo: 340 },
      { sender: MessageSender.business, content: "Best price e diyechi already. Confirm koren, hold kore rakhchi! 🙏", minutesAgo: 330 },
    ],
  });

  const conv9 = await createConv({
    customer: farida,
    channel: messengerChannel,
    status: ConversationStatus.pending,
    reason: "Customer asking about return policy before purchasing",
    estimatedValue: 3500,
    lastMessageAt: hoursAgo(3),
    messages: [
      { sender: MessageSender.customer, content: "Apa, return policy ki? Saree ta gift e dibo, size thik na hoile?", minutesAgo: 200 },
      { sender: MessageSender.business, content: "7 diner modhye exchange korte parben. Return e full refund nei, exchange hoy.", minutesAgo: 190 },
      { sender: MessageSender.customer, content: "Hmm, thik ache. Jamdani saree ta standard size hoy toh?", minutesAgo: 180 },
      { sender: MessageSender.business, content: "Haa, saree one size fits all essentially. Petticoat alag size e pawa jay.", minutesAgo: 170 },
      { sender: MessageSender.customer, content: "Ok bujhlam. Aktu socha dorkar.", minutesAgo: 160 },
    ],
  });

  const conv10 = await createConv({
    customer: imran,
    channel: instagramChannel,
    status: ConversationStatus.pending,
    reason: "Negotiating bulk order discount for 5 panjabis",
    estimatedValue: 9000,
    lastMessageAt: hoursAgo(1),
    messages: [
      { sender: MessageSender.customer, content: "Bhai 5 ta panjabi nile koto discount pabo? Office er jonno.", minutesAgo: 80 },
      { sender: MessageSender.business, content: "5 ta nile 15% off dibo — 5 * 2200 = 11000, discount e 9350 taka.", minutesAgo: 70 },
      { sender: MessageSender.customer, content: "9000 e hobe? Sob ek color e nibo, easy hobe apnar jonno o.", minutesAgo: 60 },
      { sender: MessageSender.business, content: "Let me check with my supplier. 10 min e janacchi.", minutesAgo: 50 },
    ],
  });

  const conv11 = await createConv({
    customer: nusrat,
    channel: messengerChannel,
    status: ConversationStatus.pending,
    reason: "Repeat customer — asking about new collection arrival date",
    estimatedValue: 1800,
    lastMessageAt: hoursAgo(8),
    messages: [
      { sender: MessageSender.customer, content: "Apa, new collection kobe ashbe? আগের বার যেটা নিয়েছিলাম সেটা সবাই পছন্দ করেছে!", minutesAgo: 490 },
      { sender: MessageSender.business, content: "Aw, that's great to hear! New collection next week e ashbe inshallah. 🎉", minutesAgo: 480 },
      { sender: MessageSender.customer, content: "Ok! Jodi cotton salwar set ase, amake first a janaben?", minutesAgo: 470 },
      { sender: MessageSender.business, content: "Absolutely! You're on my VIP list. 😊", minutesAgo: 460 },
    ],
  });

  const conv12 = await createConv({
    customer: mithila,
    channel: messengerChannel,
    status: ConversationStatus.pending,
    reason: "Waiting for delivery address before processing order",
    estimatedValue: 1200,
    lastMessageAt: hoursAgo(4),
    messages: [
      { sender: MessageSender.customer, content: "Apa, kurta ta order korte chai. Bkash a advance dibo.", minutesAgo: 250 },
      { sender: MessageSender.business, content: "Sure! Delivery address ta pathaben please?", minutesAgo: 240 },
      { sender: MessageSender.customer, content: "Chattogram, Agrabad. Full address ektu pore pathacchi.", minutesAgo: 230 },
    ],
  });

  const conv13 = await createConv({
    customer: raihan,
    channel: instagramChannel,
    status: ConversationStatus.pending,
    reason: "Interested in Silk Dupatta, asked about shipping to Sylhet",
    estimatedValue: 800,
    lastMessageAt: hoursAgo(12),
    messages: [
      { sender: MessageSender.customer, content: "Sylhet e ki deliver koren?", minutesAgo: 730 },
      { sender: MessageSender.business, content: "Haa, Bangladesh er jokono jaygay deliver kori. Sundarban / Pathao e pathai.", minutesAgo: 720 },
      { sender: MessageSender.customer, content: "Shipping charge koto?", minutesAgo: 710 },
      { sender: MessageSender.business, content: "Dhaka er bayre 120 taka. Sylhet 3-4 din lagbe.", minutesAgo: 700 },
      { sender: MessageSender.customer, content: "Ok, dupatta ta nibo. Stock ache toh?", minutesAgo: 650 },
      { sender: MessageSender.business, content: "Ache! Confirm korben? 😊", minutesAgo: 640 },
    ],
  });

  const conv14 = await createConv({
    customer: sabbir,
    channel: instagramChannel,
    status: ConversationStatus.pending,
    reason: "Customer asked about custom embroidery option, waiting for quote",
    estimatedValue: 2500,
    lastMessageAt: hoursAgo(16),
    messages: [
      { sender: MessageSender.customer, content: "Custom embroidery hoy? Name lekha diye panjabi banate parbo?", minutesAgo: 980 },
      { sender: MessageSender.business, content: "Haa! Custom order kori. Extra 300 taka lagbe. Design ta pathaben.", minutesAgo: 970 },
      { sender: MessageSender.customer, content: "Nice! Design pathacchi. Koto din lagbe?", minutesAgo: 960 },
      { sender: MessageSender.business, content: "7-10 working days. Rush delivery 14 additional.", minutesAgo: 950 },
      { sender: MessageSender.customer, content: "Ok, design pathabo kal. Thakben?", minutesAgo: 900 },
    ],
  });

  const conv15 = await createConv({
    customer: farida,
    channel: messengerChannel,
    status: ConversationStatus.lost,
    reason: "Customer found item cheaper elsewhere, no response after counter-offer",
    estimatedValue: undefined,
    lastMessageAt: hoursAgo(96),
    messages: [
      { sender: MessageSender.customer, content: "Kurta r price negotiable? Ami 900 e nite partam.", minutesAgo: 5800 },
      { sender: MessageSender.business, content: "Minimum 1100 e dite parbo. 100 tk discount dichi.", minutesAgo: 5790 },
      { sender: MessageSender.customer, content: "Ok dekhi onno jagay", minutesAgo: 5760 },
    ],
  });

  // ── Follow-up Drafts ──────────────────────────────────────────────────────
  await prisma.followUpDraft.create({
    data: {
      conversationId: conv8.id,
      draftText:
        "Hi Mahbub bhai! Apnar navy blue M size panjabi hold kore rakhchi. Aajke confirm korle kal-i process korte parbo. Stock limited, jldi nenen! 🙏",
      complianceState: ComplianceState.send_now,
      createdAt: new Date(now.getTime() - 30 * 60 * 1000),
    },
  });

  await prisma.followUpDraft.create({
    data: {
      conversationId: conv9.id,
      draftText:
        "Farida apa, jamdani saree ta ki confirm korben? Return policy niye kono jiggasha thakle bolun — help korte ready achi. Eid er age deliver kore dite parbo inshallah. 😊",
      complianceState: ComplianceState.needs_human_agent_tag,
      createdAt: new Date(now.getTime() - 15 * 60 * 1000),
    },
  });

  await prisma.followUpDraft.create({
    data: {
      conversationId: conv10.id,
      draftText:
        "Imran bhai, 9000 taka e 5 ta panjabi — confirmed! Supplier confirmed korche. Sob ek color (navy) neben? Advance diye order lock koren. 💪",
      complianceState: ComplianceState.needs_template,
      createdAt: new Date(now.getTime() - 45 * 60 * 1000),
    },
  });

  await prisma.followUpDraft.create({
    data: {
      conversationId: conv13.id,
      draftText:
        "Raihan bhai, silk dupatta er stock clear hoye jacche! Apnake hold kore rakhte parbo aajker modhye. Confirm korben? Sylhet delivery guaranteed. 🎁",
      complianceState: ComplianceState.blocked,
      createdAt: new Date(now.getTime() - 60 * 60 * 1000),
    },
  });

  console.log("✅ Seed complete!");
  console.log("   Business: Rina Fashion House");
  console.log("   Login: demo@salethread.com / demo1234");
  console.log(`   Conversations: 15 created (4 sold, 4 lost, 7 pending)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

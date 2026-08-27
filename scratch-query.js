const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const customers = await prisma.customer.findMany({
    take: 10
  });
  console.log("Latest Customers:");
  console.log(JSON.stringify(customers, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());

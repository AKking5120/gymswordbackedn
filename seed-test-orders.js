require('dotenv').config();
const supabase = require('./config/db');

const seedTestOrders = async () => {
  console.log("Seeding test orders for graphs...\n");

  // 1. Get a user
  const { data: users, error: userErr } = await supabase.from('users').select('id').limit(1);
  if (userErr || !users?.length) {
    console.log("No users found. Creating a test user...");
    const { data: newUser, error: createErr } = await supabase.from('users').insert({
      name: "Test User",
      email: "test@example.com",
      password: "$2b$10$dummy",
      role: "user",
    }).select('id').single();
    if (createErr) { console.error("Failed to create user:", createErr); return; }
    users.push(newUser);
  }
  const userId = users[0].id;

  // 2. Get products
  const { data: products, error: prodErr } = await supabase.from('products').select('id, name, price').eq('is_active', true);
  if (prodErr || !products?.length) {
    console.log("No products found. Please add products first via the admin panel.");
    return;
  }
  console.log(`Using user: ${userId}`);
  console.log(`Using ${products.length} products\n`);

  // 3. Generate orders across last 30 days
  const statuses = ['delivered', 'delivered', 'delivered', 'shipped', 'processing', 'pending'];
  const now = Date.now();
  const dayMs = 86400000;

  let totalOrders = 0;
  for (let daysAgo = 30; daysAgo >= 0; daysAgo -= Math.floor(Math.random() * 3) + 1) {
    const orderCount = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < orderCount; i++) {
      const createdAt = new Date(now - daysAgo * dayMs - Math.random() * dayMs);
      const itemCount = Math.floor(Math.random() * 3) + 1;
      let totalAmount = 0;
      const items = [];

      for (let j = 0; j < itemCount; j++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const qty = Math.floor(Math.random() * 2) + 1;
        const price = parseFloat(product.price) || 999;
        items.push({ product_id: product.id, quantity: qty, price });
        totalAmount += price * qty;
      }

      const status = statuses[Math.floor(Math.random() * statuses.length)];

      const { data: order, error: orderErr } = await supabase.from('orders').insert({
        user_id: userId,
        total_amount: totalAmount,
        status,
        payment_method: 'cod',
        payment_status: status === 'delivered' ? 'paid' : 'pending',
        created_at: createdAt.toISOString(),
      }).select('id').single();

      if (orderErr) { console.error("Order insert error:", orderErr); continue; }

      for (const item of items) {
        const { error: itemErr } = await supabase.from('order_items').insert({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
        });
        if (itemErr) console.error("Order item insert error:", itemErr);
      }

      totalOrders++;
      const dateStr = createdAt.toLocaleDateString('en-IN');
      console.log(`  Order #${order.id}: ₹${totalAmount} — ${status} — ${dateStr} (${itemCount} items)`);
    }
  }

  console.log(`\nDone! Created ${totalOrders} test orders.`);
};

seedTestOrders().catch(console.error);

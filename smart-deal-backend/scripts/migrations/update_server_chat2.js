const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const chatApis = `
// ==========================================
// ORDER CHAT APIs
// ==========================================
app.get('/api/orders/:order_id/messages', async (req, res) => {
  const orderId = req.params.order_id;
  try {
    const [messages] = await db.query(
      'SELECT * FROM order_messages WHERE order_id = ? ORDER BY created_at ASC',
      [orderId]
    );
    res.json({ success: true, messages });
  } catch (error) {
    console.error('Error fetching order messages:', error);
    res.status(500).json({ success: false, message: 'ไม่สามารถดึงข้อความได้' });
  }
});

app.post('/api/orders/:order_id/messages', async (req, res) => {
  const orderId = req.params.order_id;
  const { sender_id, sender_type, message } = req.body;
  
  if (!sender_id || !sender_type || !message) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
  }
  
  try {
    const [result] = await db.query(
      'INSERT INTO order_messages (order_id, sender_id, sender_type, message) VALUES (?, ?, ?, ?)',
      [orderId, sender_id, sender_type, message]
    );
    res.json({ success: true, message: 'ส่งข้อความสำเร็จ', message_id: result.insertId });
  } catch (error) {
    console.error('Error sending order message:', error);
    res.status(500).json({ success: false, message: 'ไม่สามารถส่งข้อความได้' });
  }
});
`;

if (!code.includes('/api/orders/:order_id/messages')) {
  code = code.replace("app.listen(PORT,", chatApis + "\napp.listen(PORT,");
  fs.writeFileSync('server.js', code);
  console.log('API inserted');
} else {
  console.log('Already exists');
}

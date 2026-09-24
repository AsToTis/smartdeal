const fs = require('fs'); 
let content = fs.readFileSync('server.js', 'utf8'); 
const target = '    // ให้คะแนน Point โบนัสแก่ผู้ใช้ 50 คะแนนเมื่อรีวิว\r\n    await db.execute(\r\n  const { productId } = req.params;'; 
const target2 = '    // ให้คะแนน Point โบนัสแก่ผู้ใช้ 50 คะแนนเมื่อรีวิว\n    await db.execute(\n  const { productId } = req.params;'; 
const replacement = `    // ให้คะแนน Point โบนัสแก่ผู้ใช้ 50 คะแนนเมื่อรีวิว
    await db.execute(
      \`INSERT INTO user_points (user_id, points) VALUES (?, 1300)
       ON DUPLICATE KEY UPDATE points = points + 50\`,
      [user_id || 2]
    );

    res.json({ success: true, message: 'ส่งรีวิวสำเร็จ ขอบคุณสำหรับคำติชม!', review_id: result.insertId });
  } catch (error) {
    console.error('❌ POST /api/reviews error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. ดึงรีวิวของสินค้า / ร้าน
app.get('/api/reviews/product/:productId', async (req, res) => {
  const { productId } = req.params;`;
content = content.replace(target, replacement).replace(target2, replacement);
fs.writeFileSync('server.js', content);

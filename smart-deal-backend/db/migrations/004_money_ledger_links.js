// 004: เชื่อมรายการถอนเงินกับสมุดบัญชีร้าน (transactions) เพื่อดูสถานะถอน/คืนเงินได้ในตารางเดียว
module.exports = {
  name: '004_money_ledger_links',
  async up(conn, h) {
    await h.addColumn('transactions', 'withdrawal_id', "INT NULL COMMENT 'อ้างอิงคำขอถอนเงิน (withdrawals.id)'");
    // ย้อนหลัง: คำขอถอนเงินของร้านที่ยังไม่มีในสมุดบัญชี
    await conn.query(`
      INSERT INTO transactions (shop_id, withdrawal_id, amount, type, status, description, created_at)
      SELECT w.shop_id, w.id, w.amount, 'withdrawal',
             CASE w.status WHEN 'completed' THEN 'completed' WHEN 'rejected' THEN 'failed' ELSE 'pending' END,
             CONCAT('ร้าน ', COALESCE(s.name, CONCAT('#', w.shop_id)), ' ขอถอนเงิน ฿', FORMAT(w.amount, 2), ' เข้าบัญชี ', COALESCE(w.bank_info, '-'), ' [ย้อนหลัง]'),
             w.created_at
      FROM withdrawals w LEFT JOIN shops s ON s.shop_id = w.shop_id
      WHERE w.shop_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.withdrawal_id = w.id AND t.type = 'withdrawal')
    `);
  },
};


import sys
with open('c:/smartdeal/smart-deal-backend/src/server.js', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''const [check] = await db.execute('SELECT shop_id, status FROM shops WHERE owner_id = ?', [owner_id]);
    
    if (check.length > 0) {
      if (check[0].status === 'rejected') {
        await db.execute(
          \UPDATE shops SET name=?, description=?, category_id=?, address=?, latitude=?, longitude=?, bank_name=?, bank_account=?, id_card_image=?, bookbank_image=?, status='pending' WHERE owner_id=?\,
          [name, description || null, category_id || null, address, latitude || null, longitude || null, bank_name || null, bank_account || null, id_card_image, bookbank_image, owner_id]
        );'''

replacement = '''const [check] = await db.execute('SELECT * FROM shops WHERE owner_id = ?', [owner_id]);
    
    if (check.length > 0) {
      if (check[0].status === 'rejected') {
        const final_id_card = id_card_image || check[0].id_card_image;
        const final_bookbank = bookbank_image || check[0].bookbank_image;
        await db.execute(
          \UPDATE shops SET name=?, description=?, category_id=?, address=?, latitude=?, longitude=?, bank_name=?, bank_account=?, id_card_image=?, bookbank_image=?, status='pending' WHERE owner_id=?\,
          [name, description || null, category_id || null, address, latitude || null, longitude || null, bank_name || null, bank_account || null, final_id_card, final_bookbank, owner_id]
        );'''

if target in content:
    content = content.replace(target, replacement)
    with open('c:/smartdeal/smart-deal-backend/src/server.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Replaced')
else:
    print('Target not found')


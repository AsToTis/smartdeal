const fs = require('fs');
let c = fs.readFileSync('src/server.js', 'utf8');

const regex = /const winnerBid = topBids\.length > 0 \? topBids\[0\] : null;\s*const winnerUserId = winnerBid \? winnerBid\.user_id : \(auction\.winner_user_id \|\| 2\);\s*const winAmount = winnerBid \? parseFloat\(winnerBid\.bid_amount\) : parseFloat\(auction\.current_bid \|\| auction\.start_price\);\s*const winnerName = winnerBid\?\.full_name \|\| 'ผู้ชนะการประมูล';/;

const replacementString = `    const winnerBid = topBids.length > 0 ? topBids[0] : null;

    if (!winnerBid) {
      await connection.query(
        'UPDATE auctions SET auction_status = "ended" WHERE auction_id = ?',
        [auctionId]
      );
      await connection.commit();
      return res.json({
        success: true,
        message: 'ปิดการประมูลเรียบร้อย (ไม่มีผู้เสนอราคา)'
      });
    }

    const winnerUserId = winnerBid.user_id;
    const winAmount = parseFloat(winnerBid.bid_amount);
    const winnerName = winnerBid.full_name || 'ผู้ชนะการประมูล';`;

if (regex.test(c)) {
    c = c.replace(regex, replacementString);
    fs.writeFileSync('src/server.js', c);
    console.log("Success");
} else {
    console.log("Not found");
}

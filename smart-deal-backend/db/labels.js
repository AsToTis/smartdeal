// คำอธิบายภาษาไทยที่ใช้ร่วมกันระหว่าง migration และ server
const ORDER_STATUS_TH = {
  new: 'เริ่มสร้างคำสั่งซื้อ',
  pending: 'รอร้านค้ารับออเดอร์',
  paid: 'ชำระเงินแล้ว รอร้านค้ารับออเดอร์',
  preparing: 'ร้านค้ารับออเดอร์แล้ว กำลังเตรียมสินค้า',
  ready: 'ร้านค้าเตรียมสินค้าเสร็จแล้ว รอไรเดอร์มารับ',
  finding_rider: 'กำลังค้นหาไรเดอร์',
  rider_accepted: 'ไรเดอร์รับงานแล้ว กำลังเดินทางไปร้าน',
  picked_up: 'ไรเดอร์รับสินค้าจากร้านแล้ว',
  delivering: 'ไรเดอร์กำลังนำส่งสินค้าให้ลูกค้า',
  shipped: 'จัดส่งสินค้าแล้ว',
  delivered: 'ไรเดอร์ส่งสินค้าถึงลูกค้าแล้ว (รอลูกค้ายืนยัน)',
  completed: 'ลูกค้ายืนยันรับสินค้า คำสั่งซื้อเสร็จสมบูรณ์',
  cancelled: 'คำสั่งซื้อถูกยกเลิก',
};

const ROLE_TH = {
  buyer: 'ลูกค้า',
  seller: 'ร้านค้า',
  driver: 'ไรเดอร์',
  rider: 'ไรเดอร์',
  admin: 'ผู้ดูแลระบบ',
  system: 'ระบบอัตโนมัติ',
};

const statusTh = (s) => ORDER_STATUS_TH[s] || s || '';
const roleTh = (r) => ROLE_TH[r] || r || '';

module.exports = { ORDER_STATUS_TH, ROLE_TH, statusTh, roleTh };

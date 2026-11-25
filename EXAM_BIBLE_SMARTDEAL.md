# EXAM_BIBLE_SMARTDEAL (คู่มือเตรียมสอบเจาะลึกโปรเจกต์ Smart Deal)

## 1. สถาปัตยกรรมระบบและการเชื่อมต่อ (System Architecture)

### 1.1 ภาพรวมการทำงานร่วมกัน
- **แอปลูกค้าและร้านค้า (smart-deal-app)**: พัฒนาด้วย **React Native (Expo)** ฝั่งหน้าบ้าน (Frontend) รองรับทั้ง iOS และ Android จัดการ State ด้วย `useState`/`useEffect` และใช้ `axios`/`fetch` ในการยิง API ไปที่ Backend
- **แอปไรเดอร์ (smart-deal-rider-app)**: แอปแยกสำหรับคนขับรถเพื่อรับออเดอร์และอัปเดตพิกัด (Tracking)
- **หน้า Web Admin**: ระบบหลังบ้านสำหรับแอดมิน เพื่อใช้ดูยอดขาย อนุมัติร้านค้า และจัดการผู้ใช้ โดยทำงานเชื่อมต่อกับระบบฐานข้อมูลผ่าน Backend Admin APIs (`/api/admin/...`)
- **Backend API (Node.js/Express)**: เซิร์ฟเวอร์หลักรันอยู่บน Cloud (Render: `https://smartdeal-backend-vhjo.onrender.com`) ทำหน้าที่รับ Request, ตรวจสอบความถูกต้อง (Validation/Auth), นำข้อมูลไปประมวลผล (Business Logic), คิวรี DB, และส่ง Response กลับเป็น JSON
- **Database (MySQL)**: ฐานข้อมูลตั้งอยู่ที่เซิร์ฟเวอร์อาจารย์ (`202.28.34.205` พอร์ต `3306` ฐานข้อมูล `db244`) ทุกการอ่าน/เขียนข้อมูลจะถูกควบคุมผ่าน Backend API ด้วยไลบรารี `mysql2` เท่านั้น แอปจะไม่ต่อ DB ตรงๆ เพื่อความปลอดภัย

### 1.2 ไลบรารีสำคัญใน `package.json` ของ Backend
- **`express`**: Web Framework หลักสำหรับสร้าง API Server และจัดการ Routing (API Endpoints)
- **`mysql2`**: ใช้เชื่อมต่อและส่งคำสั่ง SQL ไปยัง MySQL Database (รองรับ Promise/Async-Await ใช้งานง่ายขึ้น)
- **`bcryptjs`**: ใช้สำหรับเข้ารหัส (Hashing) รหัสผ่านก่อนบันทึกลง DB และใช้เทียบรหัสผ่านตอน Login (รักษาความปลอดภัยไม่ให้เก็บรหัสผ่านจริงเป็นข้อความธรรมดา)
- **`jsonwebtoken` (JWT)**: ใช้สร้าง Token เมื่อผู้ใช้ Login สำเร็จ เพื่อให้แอปนำไปแนบกับ Header (Authorization) ในการยืนยันตัวตนสำหรับเรียก API เส้นอื่นๆ
- **`multer`**: จัดการเรื่องการอัปโหลดไฟล์ เช่น รูปโปรไฟล์ รูปภาพสินค้า หรือสลิปโอนเงิน (รองรับ multipart/form-data)
- **`cors`**: (Cross-Origin Resource Sharing) อนุญาตให้ Frontend (Expo/Web) ที่รันอยู่คนละโดเมนสามารถยิง API ข้ามโดเมนมาหา Backend ได้
- **`dotenv`**: เครื่องมือโหลดตัวแปรสภาพแวดล้อม (Environment Variables) เช่น DB Config จากไฟล์ `.env` เข้ามาใน `process.env` เพื่อไม่ให้รหัสผ่านฐานข้อมูลหลุดไปในโค้ด
- **`promptpay-qr` / `qrcode`**: สร้าง QR Code โอนเงินพร้อมเพย์อัตโนมัติตามเลขบัญชีและยอดเงินสำหรับระบบชำระเงิน
- **`nodemailer`**: ใช้สำหรับส่งอีเมลจากเซิร์ฟเวอร์ (เช่น ส่ง OTP กู้คืนรหัสผ่าน)

---

## 2. เจาะลึกระบบหลังบ้าน (Backend - `server.js`) และ API

ระบบ Backend ใน `server.js` มี Endpoint มากกว่า 100 เส้น ถูกแบ่งเป็นหมวดหมู่สำคัญดังนี้:

### 2.1 หมวดหมู่ สมาชิกและการล็อกอิน (Auth)
- **`POST /api/login`**
  - **Input**: รับ `req.body` (email/phone, password)
  - **Logic**: หา user จาก email หรือ phone -> ใช้ `bcrypt.compare()` เทียบรหัสผ่าน -> ถ้าถูก สร้าง JWT Token ส่งกลับ
  - **SQL**: `SELECT * FROM users WHERE email = ? OR phone = ?`
  - **Response**: `{ token, user: { user_id, role, ... } }`
- **`POST /api/register`**
  - **Input**: รับ `req.body` (email, phone, password, full_name, role)
  - **Logic**: เช็กว่ามีอีเมลซ้ำไหม -> นำ password ไป hash ด้วย bcrypt -> บันทึกลง DB
  - **SQL**: `INSERT INTO users (email, phone, password_hash, full_name, role, status) VALUES (?, ?, ?, ?, ?, ?)`

### 2.2 หมวดหมู่ ร้านค้า และ สินค้า (Shops / Products / Promotions)
- **`GET /api/home-data`** (ดึงข้อมูลแสดงหน้าแรก)
  - **SQL**: มีการดึงหลายตารางเช่น `SELECT * FROM categories`, `SELECT p.*, s.name AS shop_name FROM products p JOIN shops s ...`
- **`GET /api/shops/:shopId/products`** (ดึงสินค้าในร้าน)
  - **SQL**: `SELECT p.*, c.name AS category_name FROM products p ...`
- **`POST /api/shops/:shopId/products`** (ร้านค้าสร้างสินค้า/โปรโมชัน)
  - **SQL**: `INSERT INTO products (shop_id, name, description, price, ...)`

### 2.3 หมวดหมู่ ตะกร้า และ การสั่งซื้อ (Orders) **[สำคัญมาก]**
- **`POST /api/orders`** (ตอนลูกค้ากดชำระเงิน)
  - **Input**: `req.body` (ข้อมูลตะกร้าสินค้า items, ยอดรวม total_amount, ที่อยู่จัดส่ง)
  - **Logic**: ระบบจะวนลูปอ่านรายการในตะกร้า -> ล็อก (FOR UPDATE) สินค้าใน DB เพื่อเช็กสต๊อก -> ถ้าพอ จะสร้างบิลออเดอร์ -> บันทึกรายละเอียดสินค้า -> และตัดสต๊อก
  - **SQL**: 
    1. `INSERT INTO orders (...) VALUES (...)` (สร้างบิลหลัก)
    2. รันลูป `INSERT INTO order_items (...)` (บันทึกรายตัว)
    3. `UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?` (ตัดสต๊อกทันที)

### 2.4 หมวดหมู่ การชำระเงิน (Payments)
- **`POST /api/payment/generate-qr`**
  - **Input**: `req.body` (order_id, amount)
  - **Logic**: ดึงข้อมูลเบอร์พร้อมเพย์ของร้าน -> ใช้โมดูล `promptpay-qr` สร้าง payload -> ใช้ `qrcode` แปลงเป็นรูป Base64 Image
  - **Response**: ส่งรูป `{ qrImage: 'data:image/png;base64,...' }` กลับไปโชว์ในแอป

### 2.5 หมวดหมู่ ไรเดอร์ และ การติดตาม (Rider & Tracking)
- **`PUT /api/riders/:id/location`**
  - **Logic**: ไรเดอร์ยิง API นี้เรื่อยๆ เพื่ออัปเดตตำแหน่งตัวเอง
  - **SQL**: `UPDATE riders SET current_lat = ?, current_lng = ?, updated_at = NOW() WHERE rider_id = ?`
- **`GET /api/orders/:orderId/tracking`**
  - **Logic**: ลูกค้ายิง API นี้เพื่อดึงพิกัดล่าสุดไปโชว์ในแผนที่
  - **SQL**: `SELECT o.*, s.latitude, s.longitude, r.current_lat, r.current_lng FROM orders o ...`

### 2.6 หมวดหมู่ Admin (ผู้ดูแลระบบ)
- **`GET /api/admin/users`** -> ใช้ดึงรายชื่อผู้ใช้ทั้งหมด (SQL: `SELECT * FROM users`)
- **`GET /api/admin/shops/pending`** -> แจ้งเตือนร้านที่รอการอนุมัติ (`SELECT * FROM shops WHERE status = 'pending'`)
- **`PUT /api/admin/shops/:id/approve`** -> อนุมัติร้านค้าเปิดระบบ (`UPDATE shops SET status = 'approved'`)

---

## 3. เจาะลึกโค้ดแอปลูกค้าและร้านค้า (`smart-deal-app/src/app`) แบบรายไฟล์

ตัวอย่างการทำงานและลอจิกของไฟล์สำคัญๆ (หน้าจอ):

- **`login.tsx` / `register.tsx`**:
  - **หน้าที่**: หน้าจอเข้าสู่ระบบและสมัครสมาชิก
  - **State**: เก็บ `email`, `password` ด้วย `useState`
  - **การเชื่อมต่อ**: ส่ง `axios.post('/api/login')` เมื่อได้ Token มาแล้วจะเก็บรักษาไว้เพื่อใช้ครั้งหน้าโดยไม่ต้องล็อกอินใหม่
- **`index.tsx` (หรือ Home)**:
  - **หน้าที่**: หน้าหลักของแอป แสดงสินค้า แบนเนอร์
  - **Effect**: ใช้ `useEffect` เรียกฟังก์ชันดึง API `GET /api/home-data` ทำงานอัตโนมัติ 1 ครั้งตอนโหลดหน้าจอ
- **`product-detail.tsx` / `auction-detail.tsx`**:
  - **หน้าที่**: ดูรายละเอียดสินค้า หรือประมูลดีลพิเศษ
  - **ฟังก์ชันสำคัญ**: มีการคำนวณส่วนลด หรือ การตั้งเวลา (Countdown Timer) สำหรับดีลที่ใกล้หมดเวลา และฟังก์ชันรับค่าจำนวนชิ้นเข้าสู่ตะกร้า
- **`cart.tsx` & `checkout.tsx`**:
  - **หน้าที่**: สรุปยอดซื้อและรายการสินค้าในตะกร้า
  - **ลอจิก**: ใช้คำสั่ง `reduce` ในการคำนวณราคาสินค้ารวม (Total Price) เช่น `items.reduce((sum, item) => sum + (item.price * item.quantity), 0)` 
  - **การเชื่อมต่อ**: กดยืนยันแล้วแอปจะเรียกฟังก์ชัน ยิง `POST /api/orders`
- **`payment.tsx`**:
  - **หน้าที่**: โชว์ QR Code ชำระเงิน
  - **Effect**: ใช้วิธี Polling (ตั้ง `setInterval`) เพื่อยิงเช็กหลังบ้านสม่ำเสมอว่าลูกค้าโอนหรือยัง ถ้าโอนแล้วเปลี่ยนหน้าจอไปใบเสร็จ
- **`tracking.tsx` / `order-tracking.tsx`**:
  - **หน้าที่**: แผนที่ (Map) แสดงตำแหน่งร้านค้า ลูกค้า และคนขับ (Real-time tracking)
  - **การเชื่อมต่อ**: ยิง `/api/orders/:orderId/tracking` ดึงพิกัด (Lat, Lng) มาตั้งเป็น State `<MapView>` ให้หมุดขยับได้
- **`notifications.tsx`**:
  - **หน้าที่**: หน้าแจ้งเตือนออเดอร์ ดึงข้อมูลจากการเชื่อม `GET /api/notifications`

---

## 4. เจาะลึกโค้ดหน้า Web Admin

*(หมายเหตุ: ส่วนติดต่อผู้ใช้งาน (UI) ของ Web Admin ไม่ได้อยู่ในโฟลเดอร์ของ Mobile App โดยตรง แต่อาจารย์อาจสอบถามถึงกลไกที่ Web Admin ใช้เชื่อมต่อ)*
- **การจัดการผู้ใช้งานและการอนุมัติร้านค้า**: ตารางข้อมูลในหน้า Web Admin จะถูกปั้นจาก Response JSON ที่ยิงไปขอจาก Backend เช่น `GET /api/admin/users`
- **ฟังก์ชันอนุมัติ**: เมื่อแอดมินคลิก "อนุมัติร้าน" ปุ่มนั้นจะส่ง HTTP PUT ไปที่ `/api/admin/shops/1/approve`
- **การดูยอดขาย (Dashboard)**: Backend มีการสร้างคิวรี (SQL) สรุปยอด เช่น ดึงคำสั่ง `SELECT SUM(total_amount), COUNT(order_id) FROM orders WHERE status='completed'` แล้วโยนกลับไปให้ Web Admin สร้างกราฟรายได้

---

## 5. เก็งคำถาม-คำตอบ (Q&A เกร็งข้อสอบ 💯)

### 📌 Q1: เวลากดสั่งซื้ออาหาร 1 ออเดอร์ โค้ดทำงานตั้งแต่หน้าแอป วิ่งไป Backend ลงตารางไหนบ้าง? (เล่าเป็น Step)
**ตอบ**: (อธิบายตามสเต็ปนี้ได้เลย)
1. **(App)** ผู้ใช้กดปุ่มยืนยันในหน้าจอ `checkout.tsx` แอปจะรวบรวมข้อมูลรายการสินค้าที่สั่ง (Cart Items) และที่อยู่จัดส่ง ส่งแบบ JSON ไปที่ API
2. **(API)** เรียกไปที่เส้น `POST /api/orders` ฝั่ง Backend (`server.js`) จะรับข้อมูลไว้
3. **(Backend & DB)** ฝั่ง Server ทำการตรวจสอบสต๊อก แล้วเปิด Database Transaction คิวรีลงตาราง 2 ตารางหลักคือ:
   - `INSERT INTO orders` (ตารางบิลหลัก เก็บว่าลูกค้าคนไหนสั่ง ยอดรวมเท่าไหร่ สถานะรอจ่ายเงิน)
   - `INSERT INTO order_items` (ตารางลูก เก็บรายละเอียดย่อยว่าในบิลนั้นมีสินค้าอะไรบ้าง จำนวนกี่ชิ้น)
   - จากนั้นคิวรี `UPDATE products SET stock_quantity = ...` (หักลบจำนวนสต๊อกสินค้าทันที)
4. **(Response)** Backend ตอบกลับด้วยเลขออเดอร์ ID แล้ว App พาผู้ใช้เด้งไปหน้าชำระเงิน `payment.tsx`

### 📌 Q2: ถ้าอาจารย์สั่งให้ "ลองแก้เพิ่มข้อความตรงหน้าแอป หรือแก้สีปุ่มตรงนี้สดๆ" ต้องเปิดแก้ที่ไหน?
**ตอบ**:
- ให้ดูว่าหน้าจอที่อาจารย์ชี้คือหน้าอะไร หากเป็นหน้าล็อกอิน ให้ไปที่ `smart-deal-app/src/app/login.tsx` ทันที หรือถ้าหน้าออเดอร์ไปที่ `checkout.tsx` เลื่อนหา Component UI (เช่น `<Text>` หรือ `<TouchableOpacity>`) แล้วแก้ข้อความ (string) หรือเปลี่ยน style inline (เช่น `backgroundColor: '#FF0000'`) พอเซฟไฟล์ปุ๊บ Expo มีระบบ Hot Reload หน้าแอปที่เปิดโชว์อาจารย์อยู่จะเปลี่ยนสีทันทีครับ

### 📌 Q3: ระบบรู้ได้ไงว่าเรา Login แล้ว? ความปลอดภัยอยู่ตรงไหน?
**ตอบ**:
- ระบบใช้ **JWT (JSON Web Token)** ในการยืนยันตัวตนครับ ใน `server.js` เมื่อเราส่งรหัสผ่านเข้ามา API จะเอาไปแปลงเทียบด้วย `bcrypt.compare()` หากรหัสถูกต้อง Server จะเจเนอเรต Token ย้อนกลับไป 
- ในฝั่งหน้าแอป (`login.tsx`) จะเอา Token นี้มาเก็บลง Cache/Local Storage. เวลากดหน้าอื่นๆ หรือดึงข้อมูลส่วนตัว แอปจะแนบ Token นี้ไปใน `Header` ของ Axios (Authorization: Bearer <token>) ทุกครั้ง 
- Backend จะมี Middleware ดักเช็ก Token ทุกครั้งว่าถูกปลอมแปลงไหม ถ้ายืนยันผ่านถึงจะทำคำสั่ง SQL ต่อครับ

### 📌 Q4: ระบบการแสดงแผนที่ ติดตามไรเดอร์แบบ Real-time (Tracking) ทำงานยังไง?
**ตอบ**:
- ทำงานประสานกัน 3 ส่วนครับ:
  1. ฝั่งแอปไรเดอร์จะคอยดึง GPS มือถือ แล้วยิง API `PUT /api/riders/:id/location` ตลอดเวลาเพื่อไปเซฟ Lat/Lng ล่าสุดลงตาราง `riders` ใน DB
  2. ฝั่งหน้าแอปผู้ใช้งาน `tracking.tsx` จะมีโค้ดตั้งเวลา (Polling) ด้วย `setInterval()` ดึง API `GET /api/orders/:orderId/tracking` มาดึงพิกัดล่าสุดของไรเดอร์นั้นๆ
  3. นำค่า Lat/Lng ที่ Backend คืนให้ มาอัปเดต State `riderLocation` ปักหมุดพิกัดลงใน Component `<MapView>` หมุดในแผนที่ก็จะวิ่งขยับได้ครับ

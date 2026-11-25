-- 001: Smart Deal base schema (generated from the live db244 structure on 2026-11-25)
-- ทุกคำสั่งเป็น CREATE TABLE IF NOT EXISTS จึงรันซ้ำบนฐานเดิมได้โดยไม่กระทบข้อมูล
SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE IF NOT EXISTS `auction_bids` (
  `bid_id` int(11) NOT NULL AUTO_INCREMENT,
  `auction_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `bid_amount` decimal(10,2) NOT NULL,
  `bid_status` enum('active','outbid','won') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`bid_id`),
  KEY `fk_auction_bids_auctions` (`auction_id`),
  KEY `fk_auction_bids_users` (`user_id`),
  CONSTRAINT `fk_auction_bids_auctions` FOREIGN KEY (`auction_id`) REFERENCES `auctions` (`auction_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_auction_bids_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `auctions` (
  `auction_id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `image_url` longtext DEFAULT NULL,
  `shop_id` int(11) DEFAULT 1,
  `shop_name` varchar(255) DEFAULT NULL,
  `start_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `current_bid` decimal(10,2) DEFAULT 0.00,
  `min_increment` decimal(10,2) DEFAULT 50.00,
  `end_time` datetime NOT NULL,
  `auction_status` enum('active','ended','cancelled') DEFAULT 'active',
  `winner_user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `original_price` decimal(10,2) DEFAULT NULL,
  `discount_percent` int(11) DEFAULT NULL,
  PRIMARY KEY (`auction_id`),
  KEY `fk_auctions_shops` (`shop_id`),
  KEY `fk_auctions_winner` (`winner_user_id`),
  CONSTRAINT `fk_auctions_shops` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`shop_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_auctions_winner` FOREIGN KEY (`winner_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `banners` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `image_url` longtext DEFAULT NULL,
  `link_url` varchar(255) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `subtitle` varchar(255) DEFAULT NULL,
  `badge_text` varchar(100) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `categories` (
  `category_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `icon_name` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `complaints` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `image_url` longtext DEFAULT NULL,
  `status` enum('pending','in_progress','resolved') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `deliveries` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `rider_id` int(11) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'assigned',
  `assigned_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `proof_image` longtext DEFAULT NULL,
  `pickup_proof_image` longtext DEFAULT NULL,
  `pickup_proofs` longtext DEFAULT NULL,
  `pickup_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_id` (`order_id`),
  KEY `rider_id` (`rider_id`),
  CONSTRAINT `deliveries_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`),
  CONSTRAINT `deliveries_ibfk_2` FOREIGN KEY (`rider_id`) REFERENCES `riders` (`rider_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `notifications` (
  `notification_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `type` varchar(50) NOT NULL DEFAULT 'general',
  `reference_id` int(11) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`notification_id`),
  KEY `fk_notifications_users` (`user_id`),
  CONSTRAINT `fk_notifications_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `order_issues` (
  `issue_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `issue_topic` varchar(255) NOT NULL,
  `issue_detail` text DEFAULT NULL,
  `status` enum('pending','investigating','resolved') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`issue_id`),
  KEY `fk_order_issues_orders` (`order_id`),
  KEY `fk_order_issues_users` (`user_id`),
  CONSTRAINT `fk_order_issues_orders` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_order_issues_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `order_issues_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE,
  CONSTRAINT `order_issues_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `product_id` int(11) DEFAULT NULL,
  `product_name` varchar(255) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `shop_id` int(11) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_order_items_orders` (`order_id`),
  KEY `fk_order_items_products` (`product_id`),
  CONSTRAINT `fk_order_items_orders` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_order_items_products` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `order_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `sender_id` int(11) NOT NULL,
  `sender_type` varchar(50) DEFAULT NULL,
  `message` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `receiver_type` varchar(50) DEFAULT 'all',
  `image_url` longtext DEFAULT NULL,
  `shop_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_order_messages_orders` (`order_id`),
  CONSTRAINT `fk_order_messages_orders` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `orders` (
  `order_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `shop_id` int(11) NOT NULL,
  `subtotal` decimal(10,2) DEFAULT NULL,
  `delivery_fee` decimal(10,2) DEFAULT NULL,
  `discount` decimal(10,2) DEFAULT 0.00,
  `total_amount` decimal(10,2) NOT NULL,
  `order_status` varchar(50) DEFAULT 'pending',
  `delivery_type` enum('pickup','delivery') NOT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `receiver_name` varchar(100) DEFAULT NULL,
  `receiver_phone` varchar(20) DEFAULT NULL,
  `shipping_address` text DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `note_for_rider` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `order_type` varchar(50) DEFAULT 'normal',
  `prepared_at` timestamp NULL DEFAULT NULL,
  `picked_up_at` timestamp NULL DEFAULT NULL,
  `delivered_at` timestamp NULL DEFAULT NULL,
  `delivery_lat` decimal(10,8) DEFAULT NULL,
  `delivery_lng` decimal(11,8) DEFAULT NULL,
  `rider_id` int(11) DEFAULT NULL,
  `payment_status` varchar(50) DEFAULT 'pending',
  `charge_id` varchar(100) DEFAULT NULL,
  `shop_statuses` longtext DEFAULT NULL,
  PRIMARY KEY (`order_id`),
  KEY `fk_orders_users` (`user_id`),
  KEY `fk_orders_shops` (`shop_id`),
  KEY `fk_orders_riders` (`rider_id`),
  CONSTRAINT `fk_orders_riders` FOREIGN KEY (`rider_id`) REFERENCES `riders` (`rider_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_orders_shops` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`shop_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_orders_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `payments` (
  `payment_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `payment_method` enum('promptpay','mobilebanking') NOT NULL,
  `payment_status` enum('pending','success','failed') DEFAULT 'pending',
  `amount` decimal(10,2) NOT NULL,
  `paid_at` datetime DEFAULT NULL,
  PRIMARY KEY (`payment_id`),
  KEY `fk_payments_orders` (`order_id`),
  CONSTRAINT `fk_payments_orders` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `products` (
  `product_id` int(11) NOT NULL AUTO_INCREMENT,
  `shop_id` int(11) DEFAULT NULL,
  `category_id` int(11) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `original_price` decimal(10,2) DEFAULT NULL,
  `discount_price` decimal(10,2) DEFAULT NULL,
  `discount_percent` int(11) DEFAULT NULL,
  `expiry_text` varchar(100) DEFAULT NULL,
  `image_url` longtext DEFAULT NULL,
  `description` text DEFAULT NULL,
  `freshness` varchar(100) DEFAULT 'ทำสดใหม่ทุกเช้า',
  `shipping_type` varchar(100) DEFAULT 'ควบคุมอุณหภูมิ',
  `deal_end_time` datetime DEFAULT NULL,
  `stock_quantity` int(11) NOT NULL DEFAULT 5,
  `is_auction` tinyint(1) DEFAULT 0,
  `expiry_time` datetime DEFAULT NULL,
  PRIMARY KEY (`product_id`),
  KEY `fk_products_shops` (`shop_id`),
  KEY `fk_products_categories` (`category_id`),
  CONSTRAINT `fk_products_categories` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_products_shops` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`shop_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `receipts` (
  `receipt_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `receipt_number` varchar(50) NOT NULL,
  `issued_at` datetime NOT NULL,
  PRIMARY KEY (`receipt_id`),
  KEY `fk_receipts_orders` (`order_id`),
  CONSTRAINT `fk_receipts_orders` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `receipts_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `reviews` (
  `review_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `shop_id` int(11) DEFAULT NULL,
  `rating` int(11) NOT NULL DEFAULT 5,
  `comment` text DEFAULT NULL,
  `image_url` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `rider_id` int(11) DEFAULT NULL,
  `rider_rating` tinyint(4) DEFAULT NULL,
  `rider_comment` text DEFAULT NULL,
  PRIMARY KEY (`review_id`),
  KEY `fk_reviews_products` (`product_id`),
  KEY `fk_reviews_users` (`user_id`),
  KEY `fk_reviews_orders` (`order_id`),
  CONSTRAINT `fk_reviews_orders` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_reviews_products` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_reviews_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `rider_wallets` (
  `rider_id` int(11) NOT NULL,
  `balance` decimal(10,2) DEFAULT 0.00,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`rider_id`),
  CONSTRAINT `fk_rider_wallets_riders` FOREIGN KEY (`rider_id`) REFERENCES `riders` (`rider_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `riders` (
  `rider_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `vehicle_type` varchar(50) NOT NULL,
  `license_plate` varchar(20) NOT NULL,
  `rider_status` enum('available','busy','offline') DEFAULT 'offline',
  `name` varchar(255) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `rating` decimal(3,1) DEFAULT 5.0,
  `current_lat` decimal(10,8) DEFAULT NULL,
  `current_lng` decimal(11,8) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'available',
  `vehicle_plate` varchar(50) NOT NULL DEFAULT '',
  `real_name` varchar(255) DEFAULT NULL,
  `vehicle_detail` varchar(255) DEFAULT NULL,
  `vehicle_doc_image` text DEFAULT NULL,
  `license_number` varchar(100) DEFAULT NULL,
  `reject_reason` text DEFAULT NULL,
  `id_card_image` text DEFAULT NULL,
  `license_image` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`rider_id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `riders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `shop_wallets` (
  `shop_id` int(11) NOT NULL,
  `balance` decimal(10,2) DEFAULT 0.00,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`shop_id`),
  CONSTRAINT `fk_shop_wallets_shops` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`shop_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `shops` (
  `shop_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `image_url` longtext DEFAULT NULL,
  `rating` decimal(3,1) DEFAULT 0.0,
  `distance` varchar(50) DEFAULT NULL,
  `tag1` varchar(100) DEFAULT NULL,
  `tag2` varchar(100) DEFAULT NULL,
  `promptpay_number` varchar(15) DEFAULT '0812345678',
  `latitude` decimal(10,8) DEFAULT 16.24682600,
  `longitude` decimal(11,8) DEFAULT 103.25199200,
  `address` text DEFAULT NULL,
  `owner_id` int(11) DEFAULT NULL,
  `bank_account` varchar(50) DEFAULT NULL,
  `id_card_image` text DEFAULT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `description` text DEFAULT NULL,
  `category_id` int(11) DEFAULT NULL,
  `bank_name` varchar(100) DEFAULT NULL,
  `bookbank_image` text DEFAULT NULL,
  `reject_reason` text DEFAULT NULL,
  `opening_hours` varchar(100) DEFAULT 'ทุกวัน 08:00 - 20:00',
  `is_open` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`shop_id`),
  KEY `fk_shops_users` (`owner_id`),
  KEY `fk_shops_categories` (`category_id`),
  CONSTRAINT `fk_shops_categories` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_shops_users` FOREIGN KEY (`owner_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `system_settings` (
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text NOT NULL,
  `category` varchar(50) NOT NULL,
  `description` varchar(255) NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `transactions` (
  `transaction_id` int(11) NOT NULL AUTO_INCREMENT,
  `shop_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `type` enum('withdrawal','income') NOT NULL,
  `status` enum('pending','completed','failed') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`transaction_id`),
  KEY `fk_transactions_shops` (`shop_id`),
  CONSTRAINT `fk_transactions_shops` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`shop_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`shop_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `user_addresses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `address_detail` text DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT 16.24682600,
  `longitude` decimal(11,8) DEFAULT 103.25199200,
  `receiver_name` varchar(255) DEFAULT NULL,
  `receiver_phone` varchar(50) DEFAULT NULL,
  `note_for_rider` text DEFAULT NULL,
  `is_default` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_user_addresses_users` (`user_id`),
  CONSTRAINT `fk_user_addresses_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `user_point_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `points_change` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `user_points` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `points` int(11) DEFAULT 1250,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `fk_user_points_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `users` (
  `user_id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `role` enum('buyer','seller','driver','admin') NOT NULL,
  `status` enum('active','deleted') DEFAULT 'active',
  `last_login` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `avatar_url` longtext DEFAULT NULL,
  `is_2fa_enabled` tinyint(1) DEFAULT 0,
  `push_token` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `wallet_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_type` enum('shop','rider','system') NOT NULL,
  `target_id` int(11) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `type` enum('credit','debit') NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `withdrawals` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_type` enum('shop','rider') DEFAULT 'shop',
  `shop_id` int(11) DEFAULT NULL,
  `rider_id` int(11) DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `status` enum('pending','completed','rejected') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `processed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_withdrawals_shops` (`shop_id`),
  KEY `fk_withdrawals_riders` (`rider_id`),
  CONSTRAINT `fk_withdrawals_riders` FOREIGN KEY (`rider_id`) REFERENCES `riders` (`rider_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_withdrawals_shops` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`shop_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



-- ข้อมูลอ้างอิงตั้งต้น (INSERT IGNORE: ไม่ทับข้อมูลเดิม)
INSERT  IGNORE INTO `categories` VALUES (1,'เบเกอรี่','bakery-dining');
INSERT  IGNORE INTO `categories` VALUES (2,'อาหารมื้อหลัก','restaurant');
INSERT  IGNORE INTO `categories` VALUES (3,'ผลไม้','eco');
INSERT  IGNORE INTO `categories` VALUES (4,'เครื่องดื่ม','local-cafe');
INSERT  IGNORE INTO `categories` VALUES (5,'ขนมหวาน','icecream');
INSERT  IGNORE INTO `system_settings` VALUES ('app_name','Smart Deal','info','ชื่อแอปพลิเคชัน','2026-09-15 23:35:31');
INSERT  IGNORE INTO `system_settings` VALUES ('auto_cancel_minutes','15','operation','ยกเลิกออเดอร์อัตโนมัติหากไม่มีไรเดอร์รับ (นาที)','2026-09-15 23:35:31');
INSERT  IGNORE INTO `system_settings` VALUES ('base_delivery_fee','35','financial','ค่าจัดส่งเริ่มต้น (บาท)','2026-09-15 23:35:31');
INSERT  IGNORE INTO `system_settings` VALUES ('facebook_url','https://facebook.com/smartdeal','info','ลิงก์ Facebook Page','2026-09-15 23:35:32');
INSERT  IGNORE INTO `system_settings` VALUES ('maintenance_mode','false','operation','เปิดโหมดซ่อมบำรุงระบบ (แอปจะใช้งานไม่ได้)','2026-09-15 23:35:31');
INSERT  IGNORE INTO `system_settings` VALUES ('max_delivery_radius_km','15','operation','ระยะทางจัดส่งสูงสุด (กิโลเมตร)','2026-09-15 23:35:31');
INSERT  IGNORE INTO `system_settings` VALUES ('minimum_order_value','50','financial','ยอดสั่งซื้อขั้นต่ำ (บาท)','2026-09-15 23:35:31');
INSERT  IGNORE INTO `system_settings` VALUES ('per_km_fee','8','financial','ค่าจัดส่งต่อกิโลเมตร (บาท)','2026-09-15 23:35:31');
INSERT  IGNORE INTO `system_settings` VALUES ('platform_fee_percent','15','financial','เปอร์เซ็นต์ GP ที่หักจากร้านค้า (%)','2026-09-15 23:35:31');
INSERT  IGNORE INTO `system_settings` VALUES ('rider_commission_percent','100','financial','ส่วนแบ่งค่าส่งให้ไรเดอร์ (%)','2026-09-15 23:35:31');
INSERT  IGNORE INTO `system_settings` VALUES ('support_email','support@smartdeal.com','info','อีเมลติดต่อฝ่ายซัพพอร์ต','2026-09-15 23:35:32');
INSERT  IGNORE INTO `system_settings` VALUES ('support_phone','02-123-4567','info','เบอร์โทรศัพท์ติดต่อฉุกเฉิน','2026-09-15 23:35:32');
INSERT  IGNORE INTO `system_settings` VALUES ('system_open','true','operation','เปิดรับออเดอร์ (true/false)','2026-09-15 23:35:31');
SET FOREIGN_KEY_CHECKS=1;

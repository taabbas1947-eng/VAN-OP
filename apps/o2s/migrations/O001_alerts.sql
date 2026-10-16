-- O2S alerts on laptop and phone (Web Push). Tahir, 16 Oct 2026.
-- Apply by hand: your local database (XAMPP, van_platform) first, then the live database in phpMyAdmin when you choose.
-- Keys are kept short so this also works on older MySQL (5.6 and up).
-- Adds 3 new tables only. Changes no existing table and no data. Safe to run twice (IF NOT EXISTS).
-- Until these tables exist, O2S shows "Alerts are not ready yet" and nothing else changes.

-- 1 row per browser or phone with alerts switched on. Whoever switched on last on that device owns it.
CREATE TABLE IF NOT EXISTS o2s_push_devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ep_hash CHAR(40) CHARACTER SET ascii NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  username VARCHAR(191) NOT NULL,
  device VARCHAR(120) NULL,
  created_at DATETIME NOT NULL,
  last_ok_at DATETIME NULL,
  fails INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_o2s_push_ep (ep_hash),
  KEY ix_o2s_push_user (username)
) DEFAULT CHARSET=utf8mb4;

-- 1 row per job and person while the job stays open: the "never twice" record. Removed when the job is gone.
CREATE TABLE IF NOT EXISTS o2s_push_open (
  key_hash CHAR(40) CHARACTER SET ascii NOT NULL,
  username VARCHAR(150) NOT NULL,
  job_key VARCHAR(500) NOT NULL,
  opened_at DATETIME NOT NULL,
  sent_at DATETIME NULL,
  PRIMARY KEY (key_hash, username)
) DEFAULT CHARSET=utf8mb4;

-- Alerts made between 10 pm and 7 am for office roles, sent at 7 am as 1 summary per person, then removed.
CREATE TABLE IF NOT EXISTS o2s_push_held (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(191) NOT NULL,
  title VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL,
  KEY ix_o2s_held_user (username)
) DEFAULT CHARSET=utf8mb4;

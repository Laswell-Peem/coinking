const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./db');

//---ตัองค่าระบบอัปโหลดรูปภาพ (Multer) ---
const multer = require('multer');
const path = require('path');
const fs = require('fs');

if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, 'slip_' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });


const app = express();
app.use(cors());
app.use(express.json());

// คีย์ลับสำหรับสร้าง Token (ในการใช้งานจริงควรดึงจาก .env)
const JWT_SECRET = 'coinking_secret_key_2026';

// ==========================================
// 1. API สมัครสมาชิก (Register)
// ==========================================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // เช็กว่ามี username หรือ email นี้ในระบบหรือยัง
        const userCheck = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ message: 'ชื่อผู้ใช้งาน หรือ อีเมลนี้ มีในระบบแล้ว' });
        }

        // เข้ารหัสผ่าน
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // บันทึกลงฐานข้อมูล
        const newUser = await pool.query(
            'INSERT INTO users (username, email, password, balance) VALUES ($1, $2, $3, $4) RETURNING id, username, email, balance',
            [username, email, hashedPassword, 0]
        );

        res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ!', user: newUser.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
});

// ==========================================
// 2. API เข้าสู่ระบบ (Login)
// ==========================================
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // ค้นหาผู้ใช้จาก username (หรือ email ก็ได้ตามที่ออกแบบไว้)
        const user = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $1', [username]);
        if (user.rows.length === 0) {
            return res.status(400).json({ message: 'ชื่อผู้ใช้งาน หรือ รหัสผ่าน ไม่ถูกต้อง' });
        }

        // ตรวจสอบรหัสผ่านว่าตรงกันไหม
        const validPassword = await bcrypt.compare(password, user.rows[0].password);
        if (!validPassword) {
            return res.status(400).json({ message: 'ชื่อผู้ใช้งาน หรือ รหัสผ่าน ไม่ถูกต้อง' });
        }

        // สร้าง JWT Token
        const token = jwt.sign({ id: user.rows[0].id, role: 'user' }, JWT_SECRET, { expiresIn: '1d' });

        // ส่งข้อมูลกลับไปให้หน้าบ้าน
        res.json({
            message: 'เข้าสู่ระบบสำเร็จ',
            token,
            user: {
                id: user.rows[0].id,
                username: user.rows[0].username,
                balance: user.rows[0].balance
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
});

// API ดึงรายชื่อแพ็กเกจเกมทั้งหมด (ของเดิมที่ทำไว้)
app.get('/api/packages', async (req, res) => {
    try {

        const { game } = req.query;
        let query = 'SELECT * FROM game_packages';
        let values = [];

        if (game) {
            query += ' WHERE game = $1';
            values.push(game);
        }

        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.use('/uploads', express.static('uploads'));

// ==========================================
// 3. API แจ้งเติมเงิน (Upload Slip)
// ==========================================
app.post('/api/deposits', upload.single('slip'), async (req, res) => {
    try {
        const { user_id, amount } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: 'กรุณาแนบไฟล์สลิป' });
        }

        const slipUrl = `/uploads/${req.file.filename}`;

        const newDeposit = await pool.query(
            'INSERT INTO deposits (user_id, coins, slip_url, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [user_id, amount, slipUrl, 'pending']
        );

        res.status(201).json({ message: 'ส่งข้อมูลแจ้งเติมเงินสำเร็จ', deposit: newDeposit.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปโหลดสลิป' });
    }
});

// ==========================================
// 4. API สำหรับแอดมิน (Admin)
// ==========================================

// 4.0 API เข้าสู่ระบบแอดมิน
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        // ค้นหาแอดมินจากฐานข้อมูล (รหัสผ่านตั้งต้นของแอดมินคือ 1234 ไม่ได้เข้ารหัส)
        const adminUser = await pool.query('SELECT * FROM admin_users WHERE username = $1', [username]);

        if (adminUser.rows.length === 0 || adminUser.rows[0].password !== password) {
            return res.status(400).json({ message: 'Username หรือ Password ไม่ถูกต้อง' });
        }

        // สร้าง Token สำหรับ Admin
        const token = jwt.sign({ id: adminUser.rows[0].id, role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ message: 'เข้าสู่ระบบจัดการสำเร็จ', token });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
});


// 4.1 ดึงรายการแจ้งโอนเงินทั้งหมดมาแสดง

app.get('/api/admin/deposits', async (req, res) => {
    try {
        // ดึงข้อมูล deposits พร้อมดึง username จากตาราง users มาแสดงด้วย
        const result = await pool.query(`
            SELECT d.*, u.username 
            FROM deposits d 
            JOIN users u ON d.user_id = u.id 
            ORDER BY d.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสลิป' });
    }
});

// 4.2 อนุมัติ (Approve) หรือ ปฏิเสธ (Reject) สลิป
app.put('/api/admin/deposits/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // รับค่า 'approve' หรือ 'reject'

        // เช็กก่อนว่ามีสลิปนี้ไหม
        const depositCheck = await pool.query('SELECT * FROM deposits WHERE id = $1', [id]);
        if (depositCheck.rows.length === 0) {
            return res.status(404).json({ message: 'ไม่พบรายการแจ้งเติมเงินนี้' });
        }

        const deposit = depositCheck.rows[0];
        // ถ้าสถานะไม่ใช่ pending แปลว่าแอดมินกดไปแล้ว
        if (deposit.status !== 'pending') {
            return res.status(400).json({ message: 'รายการนี้ถูกตรวจสอบไปแล้ว' });
        }

        if (action === 'approve') {
            // 1. เปลี่ยนสถานะสลิปเป็น approved
            await pool.query("UPDATE deposits SET status = 'approved' WHERE id = $1", [id]);

            // 2. อัปเดตยอดเหรียญให้ผู้ใช้ (+ เพิ่มเหรียญเข้าไป)
            await pool.query(
                "UPDATE users SET balance = balance + $1 WHERE id = $2",
                [deposit.coins, deposit.user_id]
            );
            res.json({ message: 'อนุมัติสลิปและเพิ่มเหรียญสำเร็จ' });

        } else if (action === 'reject') {
            // เปลี่ยนสถานะเป็น rejected อย่างเดียว ไม่เพิ่มเหรียญ
            await pool.query("UPDATE deposits SET status = 'rejected' WHERE id = $1", [id]);
            res.json({ message: 'ปฏิเสธรายการสลิปสำเร็จ' });

        } else {
            res.status(400).json({ message: 'คำสั่งไม่ถูกต้อง' });
        }

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
});

app.get('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await pool.query('SELECT id, username, balance FROM users WHERE id = $1', [id]);

        if (user.rows.length > 0) {
            res.json(user.rows[0]);
        } else {
            res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้งาน' });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
});

// 4.3 API ดึงภาพรวมสถิติ (Overview)
app.get('/api/admin/summary', async (req, res) => {
    try {
        const users = await pool.query('SELECT COUNT(*) FROM users');
        const pending = await pool.query("SELECT COUNT(*) FROM deposits WHERE status = 'pending'");
        const todayCoins = await pool.query("SELECT COALESCE(SUM(coins), 0) AS sum FROM deposits WHERE DATE(created_at) = CURRENT_DATE");
        const approvedCoins = await pool.query("SELECT COALESCE(SUM(coins), 0) AS sum FROM deposits WHERE status = 'approved' AND DATE(created_at) = CURRENT_DATE");

        // ดึง 5 รายการแจ้งโอนล่าสุดมาแสดง
        const latest = await pool.query(`
            SELECT d.id, u.username, d.coins, d.status 
            FROM deposits d JOIN users u ON d.user_id = u.id 
            ORDER BY d.created_at DESC LIMIT 5
        `);

        res.json({
            total_users: parseInt(users.rows[0].count),
            pending_count: parseInt(pending.rows[0].count),
            today_coins: parseInt(todayCoins.rows[0].sum),
            approved_coins: parseInt(approvedCoins.rows[0].sum),
            latest: latest.rows
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลภาพรวม' });
    }
});

// 4.4 API ดึงประวัติการใช้เหรียญทั้งหมด (Transactions)
app.get('/api/admin/transactions', async (req, res) => {
    try {
        // ใช้ UNION ALL รวมตาราง coin_txns (ซื้อของ) และ deposits (เติมเงิน) เข้าด้วยกัน
        const result = await pool.query(`
            SELECT 
                'TXN-' || c.id AS ref_id, u.username, c.game, c.amount, c.coins, c.type, c.created_at 
            FROM coin_txns c JOIN users u ON c.user_id = u.id
            UNION ALL
            SELECT 
                'DEP-' || d.id AS ref_id, u.username, '-' AS game, 0 AS amount, d.coins, 'เติมเหรียญ' AS type, d.created_at 
            FROM deposits d JOIN users u ON d.user_id = u.id WHERE d.status = 'approved'
            ORDER BY created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงประวัติ' });
    }
});

// ================a==========================
// 6. API สั่งซื้อแพ็กเกจเกม (Checkout)
// ==========================================
app.post('/api/checkout', async (req, res) => {
    // ใช้คำสั่ง connect เพื่อทำ Transaction (ป้องกันการกดซื้อรัวๆ หรือเงินหักแต่ของไม่ได้)
    const client = await pool.connect();

    try {
        const { user_id, game, price_coins, game_uid } = req.body;

        await client.query('BEGIN'); // เริ่มล็อกฐานข้อมูล

        // 1. เช็กยอดเหรียญปัจจุบันของผู้ใช้ (ล็อก Row ไว้ตรวจสอบ)
        const userRes = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [user_id]);
        if (userRes.rows.length === 0) throw new Error('ไม่พบผู้ใช้งาน');

        const currentBalance = userRes.rows[0].balance;

        // 2. เช็กว่าเหรียญพอจ่ายไหม
        if (currentBalance < price_coins) {
            await client.query('ROLLBACK'); // ยกเลิกการทำรายการ
            return res.status(400).json({ message: 'ยอดเหรียญไม่เพียงพอ กรุณาเติมเหรียญ' });
        }

        // 3. หักเหรียญออกจากบัญชีผู้ใช้
        await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [price_coins, user_id]);

        // 4. บันทึกประวัติการใช้เหรียญลงตาราง coin_txns
        await client.query(
            'INSERT INTO coin_txns (user_id, game, amount, coins, type) VALUES ($1, $2, $3, $4, $5)',
            [user_id, game, 1, price_coins, 'ซื้อแพ็กเกจ']
        );

        await client.query('COMMIT'); // ยืนยันการทำรายการทั้งหมดสำเร็จ!
        res.json({ message: 'สั่งซื้อแพ็กเกจสำเร็จ!' });

    } catch (err) {
        await client.query('ROLLBACK'); // ถ้าระบบพังกลางคัน คืนค่าทั้งหมด
        console.error(err.message);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสั่งซื้อ' });
    } finally {
        client.release(); // คืนการเชื่อมต่อให้ระบบ
    }
});

// ==========================================
// 7. API ระบบลืมรหัสผ่าน (Forgot Password)
// ==========================================

// 7.1 ขอ Token สำหรับรีเซ็ตรหัสผ่าน
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        // เช็กว่ามีอีเมลนี้ในฐานข้อมูลไหม
        const user = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) {
            return res.status(404).json({ message: 'ไม่พบอีเมลนี้ในระบบ' });
        }

        // สร้าง Token อายุสั้นๆ (เช่น 15 นาที) เพื่อความปลอดภัย
        const resetToken = jwt.sign({ id: user.rows[0].id }, JWT_SECRET, { expiresIn: '15m' });

        // ปัจจุบันส่ง Token กลับไปใช้ที่หน้าเว็บโดยตรง (ถ้าระบบจริงจะสั่งส่งผ่าน Email แทน)
        res.json({
            message: 'จำลองการส่งอีเมลสำเร็จ! กำลังพาท่านไปตั้งรหัสใหม่',
            token: resetToken
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
});

// 7.2 ยืนยันการตั้งรหัสผ่านใหม่
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        // 1. ตรวจสอบว่า Token ถูกต้องและยังไม่หมดอายุ
        const decoded = jwt.verify(token, JWT_SECRET);

        // 2. เข้ารหัสผ่านใหม่ (Hash)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // 3. อัปเดตรหัสผ่านใหม่ลงฐานข้อมูล
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, decoded.id]);

        res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบใหม่' });

    } catch (err) {
        // ถ้า jwt.verify ตรวจแล้วพบว่า Token หมดอายุหรือมั่วมา จะเด้งเข้า catch นี้
        res.status(400).json({ message: 'ลิงก์หมดอายุหรือไม่ถูกต้อง กรุณาทำรายการใหม่' });
    }
});

// รัน Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend Server is running on port ${PORT} 💡`);
});
app.get('/api/me/transactions', async (req, res) => {
    try {
        // 1. ดึงและตรวจสอบ Token จากฝั่งหน้าบ้าน
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'ไม่พบข้อมูลยืนยันตัวตน' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        // 2. ดึงประวัติการซื้อ (หักเหรียญ) และการเติมเงิน (เพิ่มเหรียญ) มารวมกัน
        const result = await pool.query(`
            SELECT 
                type || ' ' || game AS detail, 
                -(coins) AS amount, 
                'success' AS status, 
                created_at 
            FROM coin_txns 
            WHERE user_id = $1
            
            UNION ALL
            
            SELECT 
                'แจ้งเติมเงิน' AS detail, 
                coins AS amount, 
                status, 
                created_at 
            FROM deposits 
            WHERE user_id = $1
            
            ORDER BY created_at DESC 
            LIMIT 15
        `, [userId]);

        res.json(result.rows);
    } catch (err) {
        console.error('Error in /api/me/transactions:', err.message);
        res.status(403).json({ message: 'เซสชั่นหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
    }
});
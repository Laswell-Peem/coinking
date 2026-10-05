const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'cooking_shopdb', // ใช้ชื่อฐานข้อมูลตามที่คุณต่อใน psql ก่อนหน้านี้
    password: '230947',
    port: 5432,
});

pool.on('connect', () => {
    console.log('Connected to PostgreSQL database successfully! 🚀');
});

module.exports = pool;
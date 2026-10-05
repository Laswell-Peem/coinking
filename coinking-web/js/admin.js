const $ = id => document.getElementById(id);
const API_BASE_URL = 'http://localhost:3000/api';

const NAVS = [['overview', 'ภาพรวม'], ['deposits', 'ตรวจสอบรายการ'], ['coin-history', 'ประวัติการใช้เหรียญ']];

const views = { overview: loadOverview, deposits: fetchPendingDeposits, 'coin-history': fetchCoinHistory };

document.addEventListener('DOMContentLoaded', () => {
    $('admin-nav').innerHTML = NAVS.map(([v, l], i) => `<button onclick="switchAdminView('${v}')" data-nav="${v}" class="w-full px-4 py-3 rounded-xl font-bold transition-colors ${i ? 'text-gray-600 hover:bg-brand-50 hover:text-brand-600' : 'bg-brand-50 text-brand-600'}">${l}</button>`).join('');

    // เช็กว่ามี Token ของแอดมินจำอยู่ในระบบหรือยัง
    const adminToken = localStorage.getItem('coinking_admin_token');
    if (adminToken) {
        // ถ้าเคยล็อกอินไว้แล้ว ให้ซ่อนหน้าล็อกอินแล้วเข้า Dashboard เลย
        $('admin-login-page').classList.add('hidden'); $('admin-dashboard-page').classList.remove('hidden');
        switchAdminView('deposits');
    } else {
        // ถ้ายังไม่ได้ล็อกอิน ค่อยแสดงหน้าล็อกอิน
        focusAdminLogin();
    }
});

function focusAdminLogin() {
    $('admin-dashboard-page').classList.add('hidden'); $('admin-login-page').classList.remove('hidden', 'opacity-0');
    window.scrollTo(0, 0);
    $('admin-user').focus({ preventScroll: true });
}

// 🟢 อัปเดต: เชื่อม API ล็อกอินแอดมิน
async function handleAdminLogin(e) {
    e.preventDefault();
    const username = $('admin-user').value;
    const password = $('admin-pass').value;

    try {
        const res = await fetch(`${API_BASE_URL}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('coinking_admin_token', data.token);
            showDashboard();
        } else {
            alert(data.message || 'Username หรือ Password ไม่ถูกต้อง');
        }
    } catch (error) {
        alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
}

function handleAdminLogout() {
    localStorage.removeItem('coinking_admin_token');
    focusAdminLogin();
}

function showDashboard() {
    $('admin-login-page').classList.add('opacity-0');
    setTimeout(() => {
        $('admin-login-page').classList.add('hidden'); $('admin-dashboard-page').classList.remove('hidden');
        switchAdminView('deposits'); // พาไปหน้าตรวจสอบสลิปเป็นหน้าแรก
    }, 300);
}

function switchAdminView(view) {
    document.querySelectorAll('[data-nav]').forEach(b => b.className = `w-full px-4 py-3 rounded-xl font-bold transition-colors ${b.dataset.nav === view ? 'bg-brand-50 text-brand-600' : 'text-gray-600 hover:bg-brand-50 hover:text-brand-600'}`);
    NAVS.forEach(([v]) => $(`view-${v}`).classList.toggle('hidden', v !== view));
    views[view]();
    document.querySelector('#admin-dashboard-page main').scrollTop = 0;
}

// 🟢 อัปเดต: เชื่อม API ดึงสลิปจากฐานข้อมูลจริง
async function fetchPendingDeposits() {
    try {
        const res = await fetch(`${API_BASE_URL}/admin/deposits`);
        const data = await res.json();

        // กรองเอาเฉพาะรายการที่สถานะ pending
        const pending = data.filter(d => d.status === 'pending');

        $('slip-table-body').innerHTML = pending.map(d => `<tr id="row-${d.id}" class="border-b border-gray-50 hover:bg-brand-50/50">
            <td class="p-4 text-sm font-bold text-gray-700">#DEP-${d.id}</td>
            <td class="p-4 text-sm text-gray-600">${d.username}</td>
            <td class="p-4 font-bold text-brand-600">${d.coins} 🪙</td>
            <td class="p-4">
                <a href="http://localhost:3000${d.slip_url}" target="_blank" class="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-600 text-xs font-bold rounded mr-2 inline-block">ดูสลิป</a>
                <button onclick="resolveSlip(${d.id}, 'approve')" class="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded">อนุมัติ</button>
                <button onclick="resolveSlip(${d.id}, 'reject')" class="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded ml-2">ปฏิเสธ</button>
            </td></tr>`).join('') || '<tr><td colspan="4" class="p-4 text-center text-gray-500">ไม่มีรายการรอดำเนินการ</td></tr>';
    } catch (error) {
        console.error('Error:', error);
    }
}

// 🟢 อัปเดต: ยิงคำสั่ง อนุมัติ/ปฏิเสธ ไปที่ API
async function resolveSlip(id, action) {
    const actionText = action === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ';
    if (!confirm(`ยืนยันที่จะ "${actionText}" รายการ #${id}?`)) return;

    try {
        const res = await fetch(`${API_BASE_URL}/admin/deposits/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });

        const data = await res.json();
        if (res.ok) {
            alert(`ดำเนินการ${actionText}สำเร็จ!`);
            fetchPendingDeposits(); // โหลดตารางใหม่หลังกด
        } else {
            alert(data.message || 'เกิดข้อผิดพลาด');
        }
    } catch (error) {
        alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
}

// 🟢 โหลดข้อมูลหน้า "ภาพรวม"
async function loadOverview() {
    try {
        const res = await fetch(`${API_BASE_URL}/admin/summary`);
        const data = await res.json();

        $('overview-stats').innerHTML = `
            <div class="panel"><p class="text-sm text-gray-500 mb-1">ผู้ใช้ทั้งหมด</p><p class="text-3xl font-bold text-gray-800">${data.total_users}</p></div>
            <div class="panel"><p class="text-sm text-gray-500 mb-1">รายการรอยืนยัน</p><p class="text-3xl font-bold text-brand-600">${data.pending_count}</p></div>
            <div class="panel"><p class="text-sm text-gray-500 mb-1">ยอดขอเติมวันนี้</p><p class="text-3xl font-bold text-gray-800">${data.today_coins} 🪙</p></div>
            <div class="panel"><p class="text-sm text-gray-500 mb-1">ยอดสำเร็จวันนี้</p><p class="text-3xl font-bold text-green-500">${data.approved_coins} 🪙</p></div>
        `;

        $('overview-activity').innerHTML = data.latest.map(d => {
            const statusColor = d.status === 'approved' ? 'text-green-500' : (d.status === 'rejected' ? 'text-red-500' : 'text-gray-400');
            const statusText = d.status === 'approved' ? 'อนุมัติแล้ว' : (d.status === 'rejected' ? 'ปฏิเสธ' : 'รอยืนยัน');
            return `<li class="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl">
                <span class="text-sm font-bold text-gray-700">#DEP-${d.id} · ${d.username}</span>
                <span class="text-sm font-bold ${statusColor}">${d.coins} 🪙 · ${statusText}</span>
            </li>`;
        }).join('') || '<li class="text-sm text-gray-400 text-center py-4">ยังไม่มีรายการ</li>';
    } catch (err) {
        $('overview-stats').innerHTML = '<p class="text-red-500">ดึงข้อมูลล้มเหลว</p>';
    }
}

// 🟢 โหลดข้อมูลหน้า "ประวัติการใช้เหรียญ"
async function fetchCoinHistory() {
    try {
        const res = await fetch(`${API_BASE_URL}/admin/transactions`);
        const history = await res.json();

        const usedCoins = history.filter(h => h.type === 'ซื้อแพ็กเกจ').reduce((sum, h) => sum + h.coins, 0);
        const topupCoins = history.filter(h => h.type === 'เติมเหรียญ').reduce((sum, h) => sum + h.coins, 0);

        $('coin-stats').innerHTML = `
            <div class="panel"><p class="text-sm text-gray-500 mb-1">เหรียญที่ถูกใช้ซื้อเกม</p><p class="text-3xl font-bold text-brand-600">${usedCoins.toLocaleString()} 🪙</p></div>
            <div class="panel"><p class="text-sm text-gray-500 mb-1">เหรียญที่เติมสำเร็จทั้งหมด</p><p class="text-3xl font-bold text-green-500">${topupCoins.toLocaleString()} 🪙</p></div>
            <div class="panel"><p class="text-sm text-gray-500 mb-1">จำนวนรายการทั้งหมด</p><p class="text-3xl font-bold text-gray-800">${history.length}</p></div>
        `;

        // ตัวกรองข้อมูล
        const kw = $('coin-history-search')?.value.trim().toLowerCase() || '';
        const gameFilter = $('coin-history-game')?.value || 'all';
        const typeFilter = $('coin-history-type')?.value || 'all';

        const filtered = history.filter(h => {
            const matchKw = !kw || h.username.toLowerCase().includes(kw) || h.ref_id.toLowerCase().includes(kw);
            const matchGame = gameFilter === 'all' || h.game === gameFilter;
            const matchType = typeFilter === 'all' || h.type === typeFilter;
            return matchKw && matchGame && matchType;
        });

        $('coin-history-body').innerHTML = filtered.map(h => {
            const isTopup = h.type === 'เติมเหรียญ';
            const time = new Date(h.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
            return `<tr class="border-b border-gray-50 hover:bg-brand-50/50">
                <td class="p-4 text-sm font-bold text-gray-700">#${h.ref_id}</td>
                <td class="p-4 text-sm text-gray-600">${h.username}</td>
                <td class="p-4 text-sm text-gray-600">${h.game !== '-' ? h.game : '-'}</td>
                <td class="p-4 text-sm text-gray-700">${isTopup ? 'เติมเหรียญ' : h.amount + ' แพ็กเกจ'}</td>
                <td class="p-4"><span class="px-2 py-1 text-xs font-bold rounded-full ${isTopup ? 'bg-green-50 text-green-500' : 'bg-brand-50 text-brand-600'}">${h.type}</span></td>
                <td class="p-4 font-bold ${isTopup ? 'text-green-500' : 'text-red-500'}">${isTopup ? '+' : '-'}${h.coins} 🪙</td>
                <td class="p-4 text-sm text-gray-400">${time}</td>
            </tr>`;
        }).join('') || '<tr><td colspan="7" class="p-4 text-center text-gray-500">ไม่พบรายการ</td></tr>';
    } catch (err) {
        $('coin-history-body').innerHTML = '<tr><td colspan="7" class="p-4 text-center text-red-500">ดึงข้อมูลล้มเหลว</td></tr>';
    }
}
const API_BASE_URL = 'http://localhost:3000/api'; // TODO(DB): เปลี่ยนเป็นโดเมนจริง + แนบ Authorization: Bearer <token>
const $ = id => document.getElementById(id);
const pages = ['home', 'login', 'register', 'deposit', 'topup', 'profile', 'contact'];

const gameDb = {
    'Valorant': { icon: '💎', curr: 'VP', items: [{ amount: 150, price: 50 }, { amount: 1125, price: 349 }] },
    'Arena of Valor': { icon: '🎟️', curr: 'คูปอง', items: [{ amount: 90, price: 90 }, { amount: 460, price: 460 }] }
};

const toastDb = {
    success: ['border-green-200 text-green-700 border-l-green-500', 'text-green-500', 'M5 13l4 4L19 7'],
    error: ['border-red-200 text-red-700 border-l-red-500', 'text-red-500', 'M6 18L18 6M6 6l12 12'],
    info: ['border-brand-200 text-brand-700 border-l-brand-500', 'text-brand-500', 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z']
};

let isLoggedIn = false, currentUser = null, userBalance = 0, selectedPrice = 0, selectedDeposit = 0, slip = null;

document.addEventListener('DOMContentLoaded', () => { checkAuthStatus(); navigateTo('home'); });

function checkAuthStatus() {
    const data = localStorage.getItem('coinking_user_data');
    if (localStorage.getItem('coinking_user_token') && data) {
        currentUser = JSON.parse(data);
        userBalance = currentUser.balance || 0;
        isLoggedIn = true;
        updateBalanceUI();

        // สั่งให้ดึงยอดเหรียญล่าสุดจากฐานข้อมูลทันทีที่โหลดหน้าเว็บ
        syncBalance();
    }
    updateNavState();
}

// ฟังก์ชันใหม่: ทำหน้าที่วิ่งไปถามยอดเหรียญจากเซิร์ฟเวอร์
async function syncBalance() {
    if (!currentUser) return;
    try {
        const res = await fetch(`${API_BASE_URL}/users/${currentUser.id}`);
        const data = await res.json();

        if (res.ok) {
            userBalance = data.balance; // อัปเดตยอดเหรียญใหม่
            currentUser.balance = data.balance;
            localStorage.setItem('coinking_user_data', JSON.stringify(currentUser)); // เซฟทับของเก่า
            updateBalanceUI(); // อัปเดตตัวเลขบนหน้าจอ
        }
    } catch (err) {
        console.error('ไม่สามารถอัปเดตยอดเหรียญได้:', err);
    }
}

function navigateTo(pageId) {
    // 1. สั่งซ่อนทุกหน้าต่าง
    document.querySelectorAll('.page-section').forEach(section => {
        section.style.display = 'none';
        section.classList.remove('active');
    });

    // 2. สั่งแสดงเฉพาะหน้าที่กด
    const targetPage = document.getElementById('page-' + pageId);
    if (targetPage) {
        targetPage.style.display = 'block';
        targetPage.classList.add('active');
    }

    // 🟢 3. ถ้าเปิดหน้าโปรไฟล์ ให้ดึงประวัติมาแสดง 🟢
    if (pageId === 'profile') {
        loadHistory();
    }

    window.scrollTo(0, 0);
}

function updateNavState() {
    $('nav-guest').classList.toggle('hidden', isLoggedIn);
    $('nav-guest').classList.toggle('md:flex', !isLoggedIn);
    $('nav-user').classList.toggle('hidden', !isLoggedIn);
    $('nav-user').classList.toggle('md:flex', isLoggedIn);
    $('nav-menu-profile').classList.toggle('hidden', !isLoggedIn);
    document.querySelectorAll('#nav-username, #profile-username').forEach(el => el.textContent = currentUser?.username || 'User');
}

async function handleLogin(e) {
    e.preventDefault();
    const username = $('login-username').value, password = $('login-password').value;
    showToast('กำลังเข้าสู่ระบบ...', 'info');

    try {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            currentUser = data.user;
            userBalance = currentUser.balance;
            isLoggedIn = true;
            localStorage.setItem('coinking_user_token', data.token);
            localStorage.setItem('coinking_user_data', JSON.stringify(currentUser));
            updateNavState(); updateBalanceUI(); navigateTo('home');
            showToast(`เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับ ${currentUser.username} 💖`);
        } else {
            showToast(data.message || 'ชื่อผู้ใช้งาน หรือ รหัสผ่าน ไม่ถูกต้อง!', 'error');
        }
    } catch (error) {
        showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    // ตรวจสอบ ID ของ input ให้ตรงกับหน้า HTML ถ้ามีการแก้ชื่อ
    const username = $('reg-username').value;
    const email = $('reg-email').value;
    const password = $('reg-password').value;
    showToast('กำลังสร้างบัญชี...', 'info');

    try {
        const res = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();

        if (res.ok) {
            navigateTo('login');
            showToast('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ');
        } else {
            showToast(data.message || 'เกิดข้อผิดพลาดในการสมัคร', 'error');
        }
    } catch (error) {
        showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
    }
}

function handleLogout() {
    localStorage.removeItem('coinking_user_token');
    localStorage.removeItem('coinking_user_data');
    isLoggedIn = false; currentUser = null; userBalance = 0;
    updateNavState(); updateBalanceUI(); navigateTo('home');
    showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
}

function selectDepositAmount(amount) { setDeposit(amount, `${amount} 🪙`); }
function customDepositInput() { setDeposit(parseInt($('custom-deposit').value) || 0); }

function setDeposit(amount, label) {
    // TODO(DB): ตัวเลือกจำนวนเหรียญควรมาจาก config ของ backend (เช่น min/max/step)
    selectedDeposit = amount;
    if (label) $('custom-deposit').value = '';
    document.querySelectorAll('.deposit-btn').forEach(btn => btn.className = `deposit-btn border rounded-xl py-4 text-lg font-bold transition ${btn.textContent.trim() === label ? 'border-brand-500 bg-brand-50 text-brand-600 shadow-md' : 'border-brand-200 bg-white text-gray-700'}`);
    $('deposit-display').innerText = amount.toLocaleString();
}

function handleDepositSlip(input) {
    const file = input.files?.[0];
    if (!file) return;
    slip = file;
    $('deposit-slip-name').textContent = file.name;
    $('deposit-slip-size').textContent = `${(file.size / 1024).toFixed(1)} KB`;
    const thumb = $('deposit-slip-thumb');
    if (thumb) { thumb.src = URL.createObjectURL(file); thumb.onload = () => URL.revokeObjectURL(thumb.src); }
    $('deposit-slip-preview').classList.remove('hidden');
    $('deposit-slip-preview').classList.add('flex');
}

async function submitDeposit() {
    if (!isLoggedIn) return showToast('กรุณาเข้าสู่ระบบก่อนทำรายการ', 'error');
    if (selectedDeposit <= 0) return showToast('กรุณาระบุจำนวนเงิน', 'error');
    if (!slip) return showToast('กรุณาแนบรูปภาพสลิป', 'error');

    showToast('กำลังส่งข้อมูลสลิป...', 'info');

    // เตรียมแพ็กเกจข้อมูลแบบ FormData (สำหรับส่งไฟล์ภาพ)
    const formData = new FormData();
    formData.append('user_id', currentUser.id);
    formData.append('amount', selectedDeposit);
    formData.append('slip', slip); // ตัวแปร slip ถูกเก็บค่าไว้แล้วตอนกดเลือกไฟล์

    try {
        // ยิงข้อมูลไปหา API (ไม่ต้องใส่ Content-Type เพราะ fetch จะจัดการ FormData ให้เอง)
        const res = await fetch(`${API_BASE_URL}/deposits`, {
            method: 'POST',
            body: formData
        });

        const data = await res.json();

        if (res.ok) {
            showToast('ส่งคำขอสำเร็จ! กรุณารอแอดมินตรวจสอบ');
            // ล้างค่าและพากลับหน้าแรก
            setDeposit(0);
            slip = null;
            $('deposit-slip').value = '';
            $('deposit-slip-preview').classList.add('hidden'); $('deposit-slip-preview').classList.remove('flex');
            setTimeout(() => navigateTo('home'), 1500);
        } else {
            showToast(data.message || 'เกิดข้อผิดพลาดในการส่งข้อมูล', 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
    }
}

async function openGame(title, img) {
    $('topup-game-title').innerText = title;
    $('topup-game-icon').src = img;

    // ตั้งค่าตัวย่อสกุลเงินในเกมแบบง่ายๆ
    const currName = title === 'Valorant' ? 'VP' : (title === 'Arena of Valor' ? 'คูปอง' : 'Points');

    $('package-grid').innerHTML = '<p class="text-center col-span-2 text-gray-400">กำลังโหลดแพ็กเกจ...</p>';
    navigateTo('topup');

    try {
        // วิ่งไปดึงราคาแพ็กเกจของเกมที่เลือกจากฐานข้อมูล
        const res = await fetch(`${API_BASE_URL}/packages?game=${title}`);
        const packages = await res.json();

        if (packages.length === 0) {
            $('package-grid').innerHTML = '<p class="text-center col-span-2 text-gray-500">ยังไม่มีแพ็กเกจสำหรับเกมนี้</p>';
        } else {
            // นำข้อมูลที่ได้จากตาราง game_packages มาสร้างปุ่มกด
            $('package-grid').innerHTML = packages.map(p => `
                <div onclick="selectPackage(this, ${p.price_coins})" class="package-card border border-brand-200 bg-white rounded-2xl p-4 cursor-pointer text-center hover:border-brand-400 transition-colors">
                    <div class="text-xl font-bold text-brand-600">${p.amount} ${currName}</div>
                    <div class="mt-2 text-gray-800 font-bold bg-brand-50 rounded-lg py-1">${p.price_coins} 🪙</div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error fetching packages:', error);
        $('package-grid').innerHTML = '<p class="text-center col-span-2 text-red-500">ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้</p>';
    }

    selectedPrice = 0;
    $('total-price').innerText = '0';
}

function selectPackage(el, price) {
    document.querySelectorAll('.package-card').forEach(c => c.classList.remove('border-brand-500', 'bg-brand-50'));
    el.classList.add('border-brand-500', 'bg-brand-50');
    selectedPrice = price; $('total-price').innerText = price.toLocaleString();
}

async function handleCheckout() {
    if (!isLoggedIn) {
        navigateTo('login');
        return showToast('กรุณาเข้าสู่ระบบก่อนทำรายการ', 'error');
    }
    if (!selectedPrice) return showToast('กรุณาเลือกแพ็กเกจ', 'error');
    if (userBalance < selectedPrice) return showToast('เหรียญไม่พอ กรุณาเติมเหรียญ', 'error');

    const uid = $('topup-uid').value;
    if (!uid) return showToast('กรุณากรอก UID ของท่าน', 'error');

    showToast('กำลังประมวลผลคำสั่งซื้อ...', 'info');

    // ดึงชื่อเกมจากหน้าจอ
    const gameTitle = $('topup-game-title').innerText;

    try {
        const res = await fetch(`${API_BASE_URL}/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                game: gameTitle,
                price_coins: selectedPrice,
                game_uid: uid
            })
        });

        const data = await res.json();

        if (res.ok) {
            showToast('สั่งซื้อสำเร็จ! ขอให้สนุกกับเกมครับ 💖');
            $('topup-uid').value = ''; // ล้างช่องใส่ UID
            selectedPrice = 0; // ล้างราคาที่เลือก
            $('total-price').innerText = '0';

            // เรียกฟังก์ชันดึงยอดเงินล่าสุดมาอัปเดตบนหน้าจอทันที
            syncBalance();

            setTimeout(() => navigateTo('home'), 2000);
        } else {
            showToast(data.message || 'เกิดข้อผิดพลาด', 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
    }
}

function updateBalanceUI() {
    ['nav-balance', 'profile-coin-balance'].forEach(id => { const el = $(id); if (el) el.innerText = userBalance.toLocaleString(); });
    if (currentUser) { currentUser.balance = userBalance; localStorage.setItem('coinking_user_data', JSON.stringify(currentUser)); }
}

function filterGames(type) {
    // 1. ซ่อน/แสดงการ์ดเกม
    const cards = document.querySelectorAll('.game-card');
    cards.forEach(card => {
        if (type === 'all' || card.dataset.type === type) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });

    // 2. จัดการเปลี่ยนสีปุ่ม
    const btnAll = document.getElementById('btn-filter-all');
    const btnMobile = document.getElementById('btn-filter-mobile');
    const btnPc = document.getElementById('btn-filter-pc');

    const inactiveClass = "px-4 py-1.5 rounded-full bg-white border border-brand-200 text-sm text-gray-600 hover:text-brand-600 transition";
    const activeClass = "px-4 py-1.5 rounded-full bg-brand-500 text-sm text-white shadow-md transition";

    // รีเซ็ตทุกปุ่มเป็นสีขาว
    if (btnAll) btnAll.className = inactiveClass;
    if (btnMobile) btnMobile.className = inactiveClass;
    if (btnPc) btnPc.className = inactiveClass;

    // เปลี่ยนสีปุ่มที่ถูกกดให้เป็นสีชมพู
    if (type === 'all' && btnAll) btnAll.className = activeClass;
    if (type === 'mobile' && btnMobile) btnMobile.className = activeClass;
    if (type === 'pc' && btnPc) btnPc.className = activeClass;
}

function showToast(message, type = 'success') {
    const box = $('toast-container');
    if (!box) return alert(message);
    const [border, color, d] = toastDb[type] || toastDb.success;
    const toast = document.createElement('div');
    toast.className = `flex items-center gap-3 px-5 py-3.5 rounded-lg shadow-lg text-sm border border-l-4 font-medium transform transition-all duration-300 translate-x-full opacity-0 bg-white ${border}`;
    toast.innerHTML = `<svg class="w-5 h-5 ${color}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${d}"></path></svg> <span>${message}</span>`;
    box.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-x-full', 'opacity-0'));
    setTimeout(() => { toast.classList.add('opacity-0', 'scale-90'); setTimeout(() => toast.remove(), 300); }, 3000);
}
// ==========================================
// ระบบลืมรหัสผ่าน
// ==========================================
let tempResetToken = ''; // เก็บ Token ชั่วคราวสำหรับการตั้งรหัสใหม่

async function handleForgotPassword(e) {
    e.preventDefault();
    const email = $('forgot-email').value;
    showToast('กำลังตรวจสอบอีเมล...', 'info');

    try {
        const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (res.ok) {
            showToast(data.message, 'success');
            tempResetToken = data.token; // เก็บ Token ที่ได้จากหลังบ้านไว้
            $('forgot-email').value = '';

            // สลับพาผู้ใช้ไปหน้าตั้งรหัสผ่านใหม่ทันที
            setTimeout(() => navigateTo('reset-password'), 1000);
        } else {
            showToast(data.message || 'เกิดข้อผิดพลาด', 'error');
        }
    } catch (err) {
        showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
    }
}

async function handleResetPassword(e) {
    e.preventDefault();
    const newPassword = $('reset-new-password').value;

    if (!tempResetToken) {
        return showToast('หมดเวลาทำรายการ กรุณาขอลิงก์ใหม่', 'error');
    }

    try {
        const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: tempResetToken, newPassword })
        });
        const data = await res.json();

        if (res.ok) {
            showToast(data.message, 'success');
            tempResetToken = ''; // เคลียร์ Token ทิ้งเพื่อความปลอดภัย
            $('reset-new-password').value = '';

            // เปลี่ยนรหัสสำเร็จพากลับไปหน้า Login
            setTimeout(() => navigateTo('login'), 1500);
        } else {
            showToast(data.message || 'เกิดข้อผิดพลาด', 'error');
        }
    } catch (err) {
        showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
    }
}
// ==========================================
// ระบบดึงประวัติการทำรายการ
// ==========================================
async function loadHistory() {
    const container = document.getElementById('history-container');
    if (!container) return;

    container.innerHTML = '<p class="text-gray-500 text-center py-4">กำลังโหลดข้อมูล...</p>';

    try {
        // 🟢 แก้ไข 1: เปลี่ยนชื่อคีย์ให้ตรงกับตอนที่ Login บันทึกไว้
        const token = localStorage.getItem('coinking_user_token');
        if (!token) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">กรุณาเข้าสู่ระบบ</p>';
            return;
        }

        // 🟢 แก้ไข 2: ลบ /api ออก เพราะ API_BASE_URL มีคำว่า /api อยู่แล้ว (ป้องกัน URL เบิ้ลเป็น /api/api/...)
        const res = await fetch(`${API_BASE_URL}/me/transactions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // ถ้า API ตอบกลับเป็น 404 (หาไม่เจอ) หรือ Error อื่นๆ
        if (!res.ok) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">ไม่มีประวัติการทำรายการ</p>';
            return;
        }

        const data = await res.json();

        // ตรวจสอบว่ามีข้อมูลหรือไม่
        if (data && data.length > 0) {
            // สร้างกล่องประวัติแต่ละอัน
            container.innerHTML = data.map(item => `
                <div class="flex justify-between items-center bg-brand-50/50 p-3.5 rounded-xl border border-brand-100 mb-2">
                    <div>
                        <p class="font-bold text-gray-800">${item.detail || 'ทำรายการ'}</p>
                        <p class="text-xs text-gray-500 mt-0.5">${new Date(item.created_at).toLocaleString('th-TH')}</p>
                    </div>
                    <div class="text-right">
                        <p class="font-bold ${item.amount > 0 ? 'text-green-500' : 'text-red-500'}">
                            ${item.amount > 0 ? '+' : ''}${item.amount} 🪙
                        </p>
                        <p class="text-xs ${item.status === 'success' ? 'text-green-600' : 'text-yellow-600'} mt-0.5">${item.status || 'สำเร็จ'}</p>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">ไม่มีประวัติการทำรายการ</p>';
        }
    } catch (error) {
        console.error('โหลดประวัติล้มเหลว:', error);
        container.innerHTML = '<p class="text-red-500 text-center py-4">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>';
    }
}
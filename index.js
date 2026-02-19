const TelegramBot = require('node-telegram-bot-api');
const data = require('./data');

const BOT_TOKEN = '8381562857:AAEHhGq8lCAVR5l5kK-4B4OvPp9-B8y8vm4';
const GROUP_ID = -1003683760086;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// UZBEKISTAN TIME (UTC+5) - Har kuni soat 23:00 da kunlik hisobot
const REPORT_HOUR = 23;
const UZ_OFFSET = 5 * 60 * 60 * 1000; // UTC+5

function getUzbekistanDate() {
  const now = new Date();
  const uzNow = new Date(now.getTime() + UZ_OFFSET);
  return uzNow.toISOString().split('T')[0];
}

function getUzbekistanHour() {
  const now = new Date();
  const uzNow = new Date(now.getTime() + UZ_OFFSET);
  return uzNow.getUTCHours();
}

let lastReportDate = null;

// Kunlik hisobot - har 10 daqiqada tekshiradi
setInterval(async () => {
  const uzHour = getUzbekistanHour();
  const today = getUzbekistanDate();
  
  if (uzHour === REPORT_HOUR && lastReportDate !== today) {
    lastReportDate = today;
    await sendDailyReport();
  }
}, 10 * 60 * 1000); // 10 daqiqa

async function sendDailyReport() {
  const employees = data.getEmployees();
  const uzNow = new Date(Date.now() + UZ_OFFSET);
  const yesterday = new Date(uzNow);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);
  
  const reportedToday = data.getEmployeesWhoReportedToday(dateStr);
  const notReported = employees.filter(e => !reportedToday.includes(String(e.userId)));
  
  if (notReported.length === 0) {
    await bot.sendMessage(GROUP_ID, 
      `📅 *${dateStr}* kun uchun barcha xodimlar hisobot topshirdi! ✅`,
      { parse_mode: 'Markdown' }
    );
  } else {
    let message = `📅 *${dateStr}* kun uchun hisobot topshirmagan xodimlar:\n\n`;
    notReported.forEach((emp, i) => {
      const name = [emp.firstName, emp.lastName].filter(Boolean).join(' ') || `ID: ${emp.userId}`;
      message += `${i + 1}. ${name}\n`;
    });
    await bot.sendMessage(GROUP_ID, message, { parse_mode: 'Markdown' });
  }
}

// Start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from?.first_name || '';
  const lastName = msg.from?.last_name || '';
  
  const welcomeMessage = `<b>Assalomu alaykum! Xurmatli ${firstName} ${lastName}</b>

Bu bot orqali hisobotlarni topshirishingiz mumkin.

Marhamat hisobot matnini yozib yuboring. Men uni kerakli raxbarlarga yuboraman.

Rahmat! )`;

  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'HTML' });
});

// Barcha xabarlar (matn, rasm, fayl va hokazo)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const firstName = msg.from?.first_name || '';
  const lastName = msg.from?.last_name || '';
  
  // /start dan boshqa xabarlarni qayta ishlaymiz
  if (msg.text && msg.text.startsWith('/')) return;
  
  // Rad etilgan foydalanuvchi
  if (data.isRejected(userId)) {
    await bot.sendMessage(chatId, 
      'Raxbarlar sizni rad etishdi. Siz bu botdan foydalana olmaysiz.',
      { parse_mode: 'HTML' }
    );
    return;
  }
  
  // Xodim emas va yangi foydalanuvchi - tasdiqlash kerak
  const isNewUser = !data.isEmployee(userId);
  
  try {
    // Xabarni guruhga forward qilish (asl xabar sifatida)
    const forwardedMsg = await bot.forwardMessage(GROUP_ID, chatId, msg.message_id);
    const caption = `📤 Hisobot: ${firstName} ${lastName}`;
    await bot.sendMessage(GROUP_ID, caption, { 
      reply_to_message_id: forwardedMsg.message_id,
      parse_mode: 'HTML'
    });
    
    // Yangi foydalanuvchi bo'lsa - tasdiqlash tugmalari
    if (isNewUser) {
      data.addPending(userId, firstName, lastName);
      const keyboard = {
        inline_keyboard: [
          [
            { text: '✅ Tasdiqlash', callback_data: `approve_${userId}` },
            { text: '❌ Rad etish', callback_data: `reject_${userId}` }
          ]
        ]
      };
      await bot.sendMessage(GROUP_ID, 
        'Bu foydalanuvchini qabul qilasizmi yoki chiqarib yuboraymi?',
        { reply_markup: keyboard }
      );
    } else {
      // Xodim hisoblanadi - kunlik hisobotga qo'shish
      const today = new Date().toISOString().split('T')[0];
      data.addDailyReport(userId, today);
      
      await bot.sendMessage(chatId, 'Hisobot qabul qilindi va raxbarlarga yuborildi. Rahmat!');
    }
  } catch (err) {
    console.error('Xabar yuborishda xato:', err);
    await bot.sendMessage(chatId, 'Xatolik yuz berdi. Iltimos qayta urinib ko\'ring.');
  }
});

// Callback - Tasdiqlash yoki Rad etish
bot.on('callback_query', async (query) => {
  const dataStr = query.data;
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  
  if (dataStr.startsWith('approve_')) {
    const userId = parseInt(dataStr.replace('approve_', ''));
    const pendingUser = data.getAndRemovePending(userId);
    const firstName = pendingUser?.firstName || '';
    const lastName = pendingUser?.lastName || '';
    
    data.addEmployee(userId, firstName, lastName);
    
    await bot.answerCallbackQuery(query.id, { text: 'Foydalanuvchi qabul qilindi!' });
    await bot.editMessageText('✅ Foydalanuvchi tasdiqlandi va xodimlar ro\'yxatiga qo\'shildi.', {
      chat_id: chatId,
      message_id: messageId
    });
  } else if (dataStr.startsWith('reject_')) {
    const userId = parseInt(dataStr.replace('reject_', ''));
    
    data.addRejected(userId);
    
    await bot.answerCallbackQuery(query.id, { text: 'Foydalanuvchi rad etildi!' });
    await bot.editMessageText('❌ Foydalanuvchi rad etildi.', {
      chat_id: chatId,
      message_id: messageId
    });
    
    // Foydalanuvchiga xabar
    try {
      await bot.sendMessage(userId, 
        'Raxbarlar sizni rad etishdi. Siz bu botdan foydalana olmaysiz.',
        { parse_mode: 'HTML' }
      );
    } catch (e) {
      console.log('Rad etilgan foydalanuvchiga xabar yuborish mumkin emas (bloklagan yoki muloqot yo\'q)');
    }
  }
});

// Ishga tushganda
bot.getMe().then((me) => {
  console.log(`Bot ishga tushdi: @${me.username}`);
  console.log('Kunlik hisobot har kuni soat 23:00 (Toshkent vaqti) da yuboriladi.');
}).catch(err => {
  console.error('Bot token xato:', err.message);
});

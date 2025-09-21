const pool = require("../database/mysql/pool.js");
const dayjs = require("dayjs");

function scheduleReminders(client) {
  return new Promise((resolve, reject) => {
    const now = dayjs().format("YYYY-MM-DD HH:mm:00");

    pool.query(
      "SELECT * FROM reminders WHERE remind_at <= ? AND sent = 0",
      [now],
      function (err, results) {
        if (err) {
          console.error(err);
          return reject(err);
        }

        results.forEach((reminder) => {
          client.sendMessage(reminder.phone, `⏰ Reminder: ${reminder.message}`);
          pool.query("UPDATE reminders SET sent = 1 WHERE id = ?", [reminder.id]);
        });

        resolve(results.length);
      }
    );
  });
}

function cleanupReminders() {
  return new Promise((resolve, reject) => {
    pool.query(
      "DELETE FROM reminders WHERE sent = 1 AND remind_at < NOW() - INTERVAL 7 DAY",
      function (err, result) {
        if (err) {
          console.error("Gagal hapus reminder lama:", err);
          reject(err);
        } else {
          console.log(`${result.affectedRows} reminder lama dihapus`);
          resolve(result.affectedRows);
        }
      }
    );
  });
}


module.exports = { scheduleReminders, cleanupReminders };
// index.js
const { Client, RemoteAuth } = require("whatsapp-web.js");
const { MysqlStore } = require("wwebjs-mysql");
const qrcode = require("qrcode-terminal");
const pool = require("./database/mysql/pool.js");
const { scheduleReminders, cleanupReminders } = require("./services/scheduler.js");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
dayjs.extend(customParseFormat);
const puppeteer = require('puppeteer');
const express = require("express");
require("dotenv").config();

const tableInfo = {
  table: "wsp_sessions",
  session_column: "session_name",
  data_column: "data",
  updated_at_column: "updated_at",
};

const store = new MysqlStore({ pool, tableInfo });

const client = new Client({
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: puppeteer.executablePath(),
  },
  authStrategy: new RemoteAuth({
    store,
    backupSyncIntervalMs: 300000,
    session: "default-session",
  }),
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ Bot siap jalan!");
});

client.on("message", (msg) => {
  const from = msg.from;
  const text = msg.body;

  if (text.startsWith("reminder|")) {
    const [, message, datetime] = text.split("|");

    if (!message || !datetime) {
      client.sendMessage(
        from,
        "Format salah!.\nContoh: reminder|Meeting penting|2025-09-21 15:30"
      );
      return;
    }

const remindAt = dayjs(datetime, "YYYY-MM-DD HH:mm", true);

  if (!remindAt.isValid()) {
    client.sendMessage(from, "⚠ Format tanggal salah. Gunakan yyyy-MM-dd HH:mm");
    return;
  }

  const mysqlDatetime = remindAt.format("YYYY-MM-DD HH:mm:ss");

    pool.query(
      `INSERT INTO reminders (phone, message, remind_at) VALUES (?, ?, ?)`,
      [from, message, mysqlDatetime],
      function (err) {
        if (err) {
          console.error(err);
          client.sendMessage(from, "❌ Gagal menyimpan reminder");
        } else {
          client.sendMessage(from, `✅ Reminder tersimpan untuk ${remindAt.format("DD MMMM YYYY HH:mm")}`);
        }
      }
    );
  }
});

client.initialize();

const app = express();
const port = process.env.PORT || 3000;

app.get("/run-reminder", async (req, res) => {
  if (req.query.key !== process.env.CRON_KEY) {
    return res.status(403).send("Key anda tidak valid");
  }
  try {
    await scheduleReminders(client);
    res.send("Reminder job executed ✅");
  } catch (err) {
    console.error("Error running reminder:", err);
    res.status(500).send("Error running reminder");
  }
});

app.get("/cleanup-reminders", async (req, res) => {
  if (req.query.key !== process.env.CRON_KEY) {
    return res.status(403).send("Key anda tidak valid");
  }
  try {
    const deleted = await cleanupReminders();
    res.send(`🧹 ${deleted} reminder lama dihapus`);
  } catch (err) {
    console.error("Error running cleanup:", err);
    res.status(500).send("Error running cleanup");
  }
});

app.get("/", (req, res) => {
  res.send("Bot Whatsapp Reminder running");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
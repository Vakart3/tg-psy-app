export default async function handler(req, res) {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    if (!BOT_TOKEN) {
        return res.status(500).json({ error: "BOT_TOKEN is not configured in Vercel Environment Variables" });
    }

    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const baseUrl = process.env.WEBAPP_URL || `${protocol}://${host}`;

    // 1. Быстрая авто-настройка вебхука и кнопки меню через браузер:
    // Достаточно один раз открыть https://твой-домен.vercel.app/api/webhook?setup=1
    if (req.method === "GET") {
        if (req.query.setup === "1") {
            const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/webhook`;
            const appUrl = `${baseUrl.replace(/\/$/, "")}/`;

            const webhookRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: webhookUrl }),
            }).then((r) => r.json());

            const menuRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    menu_button: {
                        type: "web_app",
                        text: "🎯 Аудит",
                        web_app: { url: appUrl },
                    },
                }),
            }).then((r) => r.json());

            return res.status(200).json({
                status: "Webhook & Menu Button configured!",
                webhookUrl,
                appUrl,
                telegramWebhookResponse: webhookRes,
                telegramMenuResponse: menuRes,
            });
        }

        return res.status(200).json({
            status: "Telegram Bot Webhook endpoint is running.",
            tip: "Add ?setup=1 to the URL to bind the Telegram Webhook automatically.",
        });
    }

    // 2. Обработка входящих сообщений от Telegram
    if (req.method === "POST") {
        try {
            const update = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
            const message = update?.message;

            if (!message) {
                return res.status(200).json({ ok: true });
            }

            const chatId = message.chat.id;
            const text = message.text || "";
            const appUrl = `${baseUrl.replace(/\/$/, "")}/`;

            // Команда /id — чтобы легко узнать свой ADMIN_CHAT_ID
            if (text === "/id" || text === "/myid") {
                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: `Твой Telegram ID (для переменной ADMIN_CHAT_ID):\n<code>${chatId}</code>`,
                        parse_mode: "HTML",
                    }),
                });
                return res.status(200).json({ ok: true });
            }

            // Команда /start — приветствие и кнопка открытия Mini App
            if (text.startsWith("/start")) {
                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: "Привет! 👋\n\nПройди быстрый аудит бизнеса из 16 вопросов. В конце ты получишь персональную матрицу своих ограничений и точек роста.\n\nЖми на кнопку ниже, чтобы начать:",
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: "🎯 Пройти аудит бизнеса",
                                        web_app: { url: appUrl },
                                    },
                                ],
                            ],
                        },
                    }),
                });
                return res.status(200).json({ ok: true });
            }

            return res.status(200).json({ ok: true });
        } catch (err) {
            console.error("Webhook error:", err);
            return res.status(200).json({ ok: true });
        }
    }

    return res.status(405).json({ error: "Method Not Allowed" });
}

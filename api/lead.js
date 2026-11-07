const CATEGORY_NAMES = {
    control: "🏗 Контроль (Операционка)",
    scale: "🎭 Масштаб (Самозванец)",
    boundaries: "🤝 Границы (Удобный партнёр)",
    meaning: "🧭 Смыслы (На автопилоте)",
};

function escapeHtml(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const BOT_TOKEN = process.env.BOT_TOKEN;
    const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

    if (!BOT_TOKEN) {
        return res.status(500).json({ error: "BOT_TOKEN is not configured" });
    }

    try {
        const data = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        const user = data.user || {};

        // Подсчет баллов по категориям из массива answers
        const scores = { control: 0, scale: 0, boundaries: 0, meaning: 0 };
        if (Array.isArray(data.answers)) {
            for (const ans of data.answers) {
                if (ans.answer === "right" && scores[ans.category] !== undefined) {
                    scores[ans.category]++;
                }
            }
        }

        const winningCats = (data.winningCategories || [])
            .map((c) => CATEGORY_NAMES[c] || c)
            .join(", ") || "Всё чисто (0)";

        const openedTabs = (data.openedTabs || [])
            .map((c) => CATEGORY_NAMES[c] || c)
            .join(", ") || "Не открывал";

        const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ") || "Гость";
        const usernameStr = user.username ? `@${escapeHtml(user.username)}` : "нет username";
        const userLink = user.id
            ? `<a href="tg://user?id=${user.id}">${escapeHtml(fullName)}</a> (${usernameStr}, ID: <code>${user.id}</code>)`
            : `${escapeHtml(fullName)} (${usernameStr})`;

        const report = [
            `🔥 <b>Новая заявка из Mini App!</b>`,
            ``,
            `👤 <b>Пользователь:</b> ${userLink}`,
            `📞 <b>Контакт из формы:</b> <code>${escapeHtml(data.contact || "Не указан")}</code>`,
            `🎯 <b>Нажал CTA (Записаться):</b> ${data.ctaClicked ? "Да ✅" : "Нет"}`,
            ``,
            `💼 <b>Роль:</b> ${escapeHtml(data.role || "—")}`,
            `💰 <b>Доход:</b> ${escapeHtml(data.income || "—")}`,
            ``,
            `📊 <b>Результаты матрицы:</b>`,
            `• Контроль: <b>${scores.control}/4</b>`,
            `• Масштаб: <b>${scores.scale}/4</b>`,
            `• Границы: <b>${scores.boundaries}/4</b>`,
            `• Смыслы: <b>${scores.meaning}/4</b>`,
            `🏆 <b>Ведущий паттерн:</b> ${escapeHtml(winningCats)}`,
            `👀 <b>Открывал вкладки:</b> ${escapeHtml(openedTabs)}`,
            ``,
            `✍️ <b>В чём затык и задача:</b>`,
            `<i>${escapeHtml(data.problem || "—")}</i>`,
            ``,
            `💸 <b>Цена вопроса (что теряет):</b>`,
            `<i>${escapeHtml(data.cost || "—")}</i>`,
        ].join("\n");

        const targetAdminId = ADMIN_CHAT_ID || user.id;

        // 1. Отправляем полный отчёт тебе (админу)
        if (targetAdminId) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: targetAdminId,
                    text: report,
                    parse_mode: "HTML",
                }),
            });
        }

        // 2. Отправляем подтверждение самому пользователю в чат с ботом
        if (user.id) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: user.id,
                    text: "✅ <b>Спасибо за ответы!</b>\n\nЯ изучу результаты твоего аудита и скоро напишу тебе лично, чтобы выбрать удобное время для созвона.",
                    parse_mode: "HTML",
                }),
            });
        }

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error("Error in /api/lead:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

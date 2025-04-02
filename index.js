const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");
const User = require("./user.schema.js");
const token = "7719546177:AAGIijxVuqB0pn6AmsgTxBKiPOmT-leFx9Q";
const bot = new TelegramBot(token, { polling: true });

mongoose
    .connect("mongodb+srv://matuk:matuk@matuk.kbkqbez.mongodb.net/")
    .then(() => console.log("✅ MongoDB connected!"))
    .catch((err) => console.error("❌ Connection error:", err));

const waitingForUserName = new Map(); // Чекаємо введення юзерів

// ID адміністратора
const adminId = 575812908; // Заміни на ID вашого адміністратора

// Клавіатура для старту
const menuKeyboard = {
    reply_markup: {
        keyboard: [["➕ Додати юзера", "❌ Видалити юзера"], ["💸 Бухалтерія"]],
        resize_keyboard: true,
        one_time_keyboard: true,
    },
};

bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    // Видаляємо повідомлення від користувачів (адміністраторів і звичайних)
    if (userId !== bot.id) {
        bot.deleteMessage(chatId, msg.message_id);
    }

    if (text === "/start") {
        bot.sendMessage(chatId, "Виберіть дію:", menuKeyboard);
        return;
    }

    // Перевірка, чи користувач є адміністратором
    if (
        userId !== adminId &&
        (text === "➕ Додати юзера" || text === "❌ Видалити юзера")
    ) {
        return bot.sendMessage(
            chatId,
            "❌ Цю команду може виконати лише адміністратор!"
        );
    }

    if (userId !== adminId && (text === "➕" || text === "❌")) {
        return bot.sendMessage(
            chatId,
            "❌ Цю команду може виконати лише адміністратор!"
        );
    }

    if (text === "➕ Додати юзера" || text === "/add_user") {
        bot.sendMessage(chatId, "Введи ім'я юзера для додавання:");
        waitingForUserName.set(userId, "add");
        return;
    }

    if (text === "❌ Видалити юзера" || text === "/remove_user") {
        bot.sendMessage(chatId, "Введи ім'я юзера для видалення:");
        waitingForUserName.set(userId, "remove");
        return;
    }

    if (text === "💸 Бухалтерія" || text === "/money") {
        const users = await User.find({});
        if (users.length === 0) {
            return bot.sendMessage(chatId, "❌ У базі нема юзерів!");
        }

        const buttons = users.map((user) => [
            { text: user.name, callback_data: `money_${user._id}` },
        ]);

        bot.sendMessage(chatId, "Оберіть юзера:", {
            reply_markup: { inline_keyboard: buttons },
        });
        return;
    }

    if (waitingForUserName.get(userId) === "add") {
        const username = text.trim();
        waitingForUserName.delete(userId);
        let user = await User.findOne({ name: username });
        if (!user) {
            user = new User({ name: username, counter: 0 });
            await user.save();
            bot.sendMessage(chatId, `✅ Матюкальник **${username}** доданий!`);
        } else {
            bot.sendMessage(
                chatId,
                `⚠️ Матюкальник **${username}** вже є в базі!`
            );
        }
        return;
    }

    if (waitingForUserName.get(userId) === "remove") {
        const username = text.trim();
        waitingForUserName.delete(userId);
        const user = await User.findOneAndDelete({ name: username });
        if (user) {
            bot.sendMessage(chatId, `❌ Юзер **${username}** видалений!`);
        } else {
            bot.sendMessage(chatId, `⚠️ Юзер **${username}** не знайдений!`);
        }
        return;
    }
});

// Обробка кнопок
bot.on("callback_query", async (query) => {
    bot.answerCallbackQuery(query.id); // Відповідаємо одразу

    const chatId = query.message.chat.id;
    const userId = query.from.id;

    // Видаляємо повідомлення від користувачів (адміністраторів і звичайних)
    if (userId !== bot.id) {
        bot.deleteMessage(chatId, query.message.message_id);
    }

    // Перевірка, чи користувач є адміністратором
    if (
        (userId !== adminId && query.data.startsWith("increment_")) ||
        query.data.startsWith("decrement_")
    ) {
        return bot.sendMessage(
            chatId,
            "❌ Цю команду може виконати лише адміністратор!"
        );
    }

    if (query.data === "add_user") {
        bot.sendMessage(chatId, "Введи ім'я юзера для додавання:");
        waitingForUserName.set(userId, "add"); // Оновлюємо статус
    }

    if (query.data === "remove_user") {
        bot.sendMessage(chatId, "Введи ім'я юзера для видалення:");
        waitingForUserName.set(userId, "remove"); // Оновлюємо статус
    }

    if (query.data === "money") {
        // Отримуємо список юзерів
        const users = await User.find({});
        if (users.length === 0) {
            return bot.sendMessage(chatId, "❌ У базі нема юзерів!");
        }

        // Формуємо кнопки з юзерами
        const buttons = users.map((user) => [
            { text: user.name, callback_data: `money_${user._id}` },
        ]);

        const options = {
            reply_markup: {
                inline_keyboard: buttons,
            },
        };

        bot.sendMessage(chatId, "Оберіть юзера:", options);
    }

    // Обробка вибору юзера
    if (query.data.startsWith("money_")) {
        const userIdFromDb = query.data.split("_")[1];
        const user = await User.findById(userIdFromDb);

        if (!user) {
            return bot.sendMessage(chatId, "❌ Юзер не знайдений!");
        }

        // Кнопки ➕ та ➖ для зміни балансу
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "➕", callback_data: `increment_${user._id}` },
                        { text: "➖", callback_data: `decrement_${user._id}` },
                    ],
                ],
            },
        };

        bot.sendMessage(
            chatId,
            `💰 Бухалтерія для **${user.name}**\n\n🔢 Неоплачених матюків: ${user.counter}`,
            options
        );
    }

    // Обробка кнопки ➕ (додавання 1)
    if (query.data.startsWith("increment_")) {
        const userIdFromDb = query.data.split("_")[1];
        const user = await User.findByIdAndUpdate(
            userIdFromDb,
            { $inc: { counter: 1 } },
            { new: true }
        );

        if (!user) {
            return bot.sendMessage(chatId, "❌ Юзер не знайдений!");
        }

        // Оновлюємо баланс
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "➕", callback_data: `increment_${user._id}` },
                        { text: "➖", callback_data: `decrement_${user._id}` },
                    ],
                ],
            },
        };

        bot.editMessageText(
            `💰 Бухалтерія для **${user.name}**\n\n🔢 Неоплачених матюків: ${user.counter}`,
            {
                chat_id: chatId,
                message_id: query.message.message_id,
                ...options,
            }
        );
    }

    // Обробка кнопки ➖ (віднімання 1)
    if (query.data.startsWith("decrement_")) {
        const userIdFromDb = query.data.split("_")[1];
        const user = await User.findByIdAndUpdate(
            userIdFromDb,
            { $inc: { counter: -1 } },
            { new: true }
        );

        if (!user) {
            return bot.sendMessage(chatId, "❌ Юзер не знайдений!");
        }

        // Оновлюємо баланс
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "➕", callback_data: `increment_${user._id}` },
                        { text: "➖", callback_data: `decrement_${user._id}` },
                    ],
                ],
            },
        };

        bot.editMessageText(
            `💰 Бухалтерія для **${user.name}**\n\n🔢 Несплачених матюків: ${user.counter}`,
            {
                chat_id: chatId,
                message_id: query.message.message_id,
                ...options,
            }
        );
    }
});

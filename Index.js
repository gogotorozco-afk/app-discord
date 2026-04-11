const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('Bot activo');
});

app.listen(process.env.PORT || 3000, () => {
    console.log('Servidor web activo');
});
const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    SlashCommandBuilder,
    Routes,
    REST
} = require('discord.js');

const sqlite3 = require('sqlite3').verbose();

// 🔑 CONFIG
client.login(process.env.TOKEN);
const CLIENT_ID = '1492366556741632123';
const GUILD_ID = '1492038446204715141';

// 🗄️ DB
const db = new sqlite3.Database('./horas.db');

db.run(`
CREATE TABLE IF NOT EXISTS registros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    entrada INTEGER,
    salida INTEGER
)
`);

// 🧠 FORMATO TIEMPO
function formatearTiempo(ms) {
    const totalMin = Math.floor(ms / (1000 * 60));
    const horas = Math.floor(totalMin / 60);
    const minutos = totalMin % 60;
    return `${horas} horas ${minutos} minutos`;
}

// 🤖 CLIENTE
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// 📜 COMANDOS
const commands = [
    new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Crear panel de control'),

    new SlashCommandBuilder()
        .setName('horas')
        .setDescription('Ver horas semanales'),

    new SlashCommandBuilder()
        .setName('historial')
        .setDescription('Ver historial de hoy'),

    new SlashCommandBuilder()
        .setName('ranking')
        .setDescription('Ranking semanal de empleados')
].map(c => c.toJSON());

// 📡 REGISTRAR COMANDOS
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
    );
})();

// ▶️ READY
client.once('ready', () => {
    console.log(`✅ Bot listo: ${client.user.tag}`);
});

// 🎛️ BOTONES
const botones = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
        .setCustomId('entrada')
        .setLabel('🟢 Entrada')
        .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
        .setCustomId('salida')
        .setLabel('🔴 Salida')
        .setStyle(ButtonStyle.Danger)
);

// ⚙️ INTERACCIONES
client.on('interactionCreate', async interaction => {

    // 📌 COMANDOS
    if (interaction.isChatInputCommand()) {

        // PANEL
        if (interaction.commandName === 'panel') {

            const embed = new EmbedBuilder()
                .setTitle('⏱️ Control de Horas PRO')
                .setDescription('Usa los botones para registrar tu jornada laboral.')
                .setColor('Blue');

            return interaction.reply({
                embeds: [embed],
                components: [botones]
            });
        }

        // 📊 HORAS SEMANALES
        if (interaction.commandName === 'horas') {

            const semana = Date.now() - (7 * 24 * 60 * 60 * 1000);

            db.all(
                "SELECT * FROM registros WHERE userId = ? AND salida IS NOT NULL AND entrada >= ?",
                [interaction.user.id, semana],
                (err, rows) => {

                    let total = 0;
                    rows.forEach(r => total += (r.salida - r.entrada));

                    interaction.reply({
                        content: `📊 Has trabajado esta semana: ${formatearTiempo(total)}`,
                        ephemeral: true
                    });
                }
            );
        }

        // 📅 HISTORIAL DEL DÍA
        if (interaction.commandName === 'historial') {

            const inicioDia = new Date();
            inicioDia.setHours(0, 0, 0, 0);

            db.all(
                "SELECT * FROM registros WHERE userId = ? AND entrada >= ?",
                [interaction.user.id, inicioDia.getTime()],
                (err, rows) => {

                    if (!rows.length) {
                        return interaction.reply({
                            content: "📅 No tienes registros hoy.",
                            ephemeral: true
                        });
                    }

                    let texto = "";

                    rows.forEach((r, i) => {
                        const salida = r.salida || Date.now();
                        const tiempo = salida - r.entrada;

                        texto += `\n**${i + 1}.** ${formatearTiempo(tiempo)}`;
                    });

                    interaction.reply({
                        content: `📅 Historial de hoy:${texto}`,
                        ephemeral: true
                    });
                }
            );
        }

        // 🏆 RANKING SEMANAL
        if (interaction.commandName === 'ranking') {

            const semana = Date.now() - (7 * 24 * 60 * 60 * 1000);

            db.all(
                "SELECT * FROM registros WHERE salida IS NOT NULL AND entrada >= ?",
                [semana],
                (err, rows) => {

                    const usuarios = {};

                    rows.forEach(r => {
                        const tiempo = r.salida - r.entrada;
                        usuarios[r.userId] = (usuarios[r.userId] || 0) + tiempo;
                    });

                    const top = Object.entries(usuarios)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10);

                    let texto = "";

                    top.forEach((u, i) => {
                        texto += `\n**${i + 1}.** <@${u[0]}> - ${formatearTiempo(u[1])}`;
                    });

                    interaction.reply({
                        content: `🏆 Ranking semanal:${texto}`,
                        ephemeral: false
                    });
                }
            );
        }
    }

    // 🔘 BOTONES
    if (interaction.isButton()) {

        const userId = interaction.user.id;
        const ahora = Date.now();

        // 🟢 ENTRADA
        if (interaction.customId === 'entrada') {

            db.get(
                "SELECT * FROM registros WHERE userId = ? AND salida IS NULL",
                [userId],
                (err, row) => {

                    if (row) {
                        return interaction.reply({
                            content: '⚠️ Ya tienes una jornada activa.',
                            ephemeral: true
                        });
                    }

                    db.run(
                        "INSERT INTO registros (userId, entrada) VALUES (?, ?)",
                        [userId, ahora]
                    );

                    interaction.reply({
                        content: '✅ Entrada registrada',
                        ephemeral: true
                    });
                }
            );
        }

        // 🔴 SALIDA
        if (interaction.customId === 'salida') {

            db.get(
                "SELECT * FROM registros WHERE userId = ? AND salida IS NULL",
                [userId],
                (err, row) => {

                    if (!row) {
                        return interaction.reply({
                            content: '⚠️ No tienes entrada activa.',
                            ephemeral: true
                        });
                    }

                    const tiempo = ahora - row.entrada;

                    db.run(
                        "UPDATE registros SET salida = ? WHERE userId = ? AND salida IS NULL",
                        [ahora, userId]
                    );

                    interaction.reply({
                        content: `⏱️ Jornada finalizada: ${formatearTiempo(tiempo)}`,
                        ephemeral: true
                    });
                }
            );
        }
    }
});

// 🚀 LOGIN
client.login(TOKEN);
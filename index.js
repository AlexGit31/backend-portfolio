require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// 🔌 Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // Pour servir admin.html et autres fichiers

// 🔗 Connexion à PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 🔹 Enregistrement d’une visite
app.post("/log", async (req, res) => {
  const { page } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const user_agent = req.headers["user-agent"];

  try {
    await pool.query(
      "INSERT INTO visits (timestamp, page, ip, user_agent) VALUES (NOW(), $1, $2, $3)",
      [page, ip, user_agent],
    );
    res.status(200).send("OK");
  } catch (error) {
    console.error("Erreur lors de l'enregistrement :", error);
    res.status(500).send("Erreur serveur");
  }
});

// 🔸 Tableau brut des visites (HTML simple)
app.get("/admin", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM visits ORDER BY timestamp DESC LIMIT 50",
    );

    const tableRows = rows
      .map(
        (row) => `
        <tr>
          <td>${row.timestamp}</td>
          <td>${row.page}</td>
          <td>${row.ip}</td>
          <td>${row.user_agent}</td>
        </tr>`,
      )
      .join("");

    const html = `
      <html>
        <head>
          <title>Visites admin</title>
          <style>
            body { font-family: sans-serif; padding: 2rem; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ccc; padding: 8px; }
            th { background: #f0f0f0; }
          </style>
        </head>
        <body>
          <h1>Tableau des Visites</h1>
          <table>
            <thead>
              <tr><th>Heure</th><th>Page</th><th>IP</th><th>Navigateur</th></tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </body>
      </html>
    `;
    res.send(html);
  } catch (error) {
    console.error("Erreur admin :", error);
    res.status(500).send("Erreur serveur");
  }
});

// 🔍 API des statistiques
app.get("/api/stats", async (req, res) => {
  const period = req.query.period || "all";
  let dateCondition = "";

  switch (period) {
    case "1d":
      dateCondition = `WHERE timestamp > NOW() - INTERVAL '1 day'`;
      break;
    case "7d":
      dateCondition = `WHERE timestamp > NOW() - INTERVAL '7 days'`;
      break;
    case "30d":
      dateCondition = `WHERE timestamp > NOW() - INTERVAL '30 days'`;
      break;
    case "365d":
      dateCondition = `WHERE timestamp > NOW() - INTERVAL '1 year'`;
      break;
    case "all":
    default:
      dateCondition = "";
      break;
  }

  try {
    const visitsOverTime = await pool.query(`
      SELECT DATE(timestamp) AS date, COUNT(*) AS count
      FROM visits
      ${dateCondition}
      GROUP BY DATE(timestamp)
      ORDER BY DATE(timestamp)
    `);

    const visitsByHour = await pool.query(`
      SELECT EXTRACT(HOUR FROM timestamp) AS hour, COUNT(*) AS count
      FROM visits
      ${dateCondition}
      GROUP BY hour
      ORDER BY hour
    `);

    const mostVisitedPages = await pool.query(`
      SELECT page, COUNT(*) AS count
      FROM visits
      ${dateCondition}
      GROUP BY page
      ORDER BY count DESC
      LIMIT 10
    `);

    res.json({
      visitsOverTime: visitsOverTime.rows,
      visitsByHour: visitsByHour.rows,
      mostVisitedPages: mostVisitedPages.rows,
    });
  } catch (error) {
    console.error("Erreur stats :", error);
    res
      .status(500)
      .json({ error: "Erreur lors du chargement des statistiques." });
  }
});

// 🚀 Lancer le serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur lancé sur http://localhost:${PORT}`);
});

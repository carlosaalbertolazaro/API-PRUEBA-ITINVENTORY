const path = require("node:path");
const jsonServer = require("json-server");
const auth = require("json-server-auth");
const { equipoValidation } = require("./validation");

function createApp(options = {}) {
  const dbFile = path.resolve(options.dbFile || process.env.DB_FILE || path.join(__dirname, "db.json"));
  const app = jsonServer.create();
  const router = jsonServer.router(dbFile);
  const middlewares = jsonServer.defaults({ logger: options.logger !== false });

  app.db = router.db;

  app.use(middlewares);
  app.use(jsonServer.bodyParser);
  app.use(auth.rewriter({
    users: 600,
    equipos: 660,
  }));
  app.use(auth);
  app.use("/db", (req, res) => res.status(404).json({ error: "Recurso no encontrado." }));
  app.use("/equipos", equipoValidation);
  app.use(router);

  app.use((error, req, res, next) => {
    if (error.type === "entity.parse.failed") {
      res.status(400).json({ error: "El cuerpo de la petición contiene JSON inválido." });
      return;
    }

    console.error(error);
    if (res.headersSent) {
      next(error);
      return;
    }
    res.status(500).json({ error: "Error interno del servidor." });
  });

  return app;
}

function startServer() {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "0.0.0.0";

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("PORT debe ser un número entre 0 y 65535.");
  }

  const app = createApp();
  const server = app.listen(port, host, () => {
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    console.log(`JSON Server Auth disponible en http://localhost:${actualPort}`);
    console.log(`Emulador Android: http://10.0.2.2:${actualPort}`);
    console.log(`Base de datos: ${path.resolve(process.env.DB_FILE || path.join(__dirname, "db.json"))}`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { createApp, startServer };

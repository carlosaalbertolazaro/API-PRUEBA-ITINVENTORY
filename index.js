const jsonServer = require("json-server");
const server = jsonServer.create();
const router = jsonServer.router("db.json");
const middlewares = jsonServer.defaults();
const auth = require("json-server-auth");

server.db = router.db;

server.use(middlewares);
server.use(auth);
server.use(router);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 JSON Server Auth corriendo en http://localhost:${PORT}`);
  console.log(`📱 Emulador Android usa: http://10.0.2.2:${PORT}`);
});
